import "server-only"

import { promises as fs } from "fs"
import path from "path"
import crypto from "node:crypto"

import { fetchBrain } from "@/lib/brain-client"
import { prisma } from "@/lib/prisma"
import type { PaymentQr } from "@/lib/ai-service"
import { resolvePublicHttpsBase } from "@/lib/public-url"
import {
    ensureChatCustomer,
    linkOrderToChatCustomer,
    reconcileSlipPayment,
    type ReconcileResult,
} from "@/lib/order-payments"
import {
    buildSlipCheckCondition,
    describeSlipValidationFailure,
    isSlip2GoResponseValid,
} from "@/lib/slip-verification"



/** Public path to the fixed store PromptPay QR (Krungthai / PromptPay). */
export const STATIC_STORE_QR_PATH = "/payment-qr/store-promptpay.png"

export interface SlipOutcome {
    status: "verified" | "duplicate" | "invalid" | "error"
    amount?: number | null
    referenceId?: string | null
    receiverName?: string | null
    message?: string
    failureReason?: import("@/lib/slip-verification").SlipValidationFailure
    reconciliation?: ReconcileResult
    orderId?: string
}

type Json = Record<string, unknown>

async function callVerifySlip(
    imageBase64: string,
    checkCondition?: Record<string, unknown>
): Promise<Json> {
    const res = await fetchBrain("/payments/verify-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            image_base64: imageBase64,
            check_condition: checkCondition,
        }),
    })
    if (!res.ok) {
        let detail = `verify-slip failed (${res.status})`
        try {
            const data = (await res.json()) as { detail?: unknown }
            if (data?.detail) detail = JSON.stringify(data.detail)
        } catch {
            /* ignore */
        }
        const err = new Error(detail) as Error & { status?: number }
        err.status = res.status
        throw err
    }
    return (await res.json()) as Json
}

function asRecord(value: unknown): Json | null {
    return value && typeof value === "object" ? (value as Json) : null
}

function getSlipData(resp: Json): Json {
    return asRecord(resp.data) ?? resp
}

function pickReferenceId(data: Json): string | null {
    const candidates = [data.referenceId, data.reference, data.transRef, data.ref1]
    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim()
    }
    return null
}

function pickAmount(data: Json): number | null {
    const transfer = asRecord(data.transfer)
    const raw =
        data.amount ??
        data.amountValue ??
        data.transAmount ??
        transfer?.amount ??
        asRecord(data.amount)?.amount
    if (typeof raw === "number") return raw
    if (typeof raw === "string") {
        const n = Number(raw.replace(/,/g, ""))
        return Number.isFinite(n) ? n : null
    }
    const obj = asRecord(raw)
    if (obj && typeof obj.amount === "number") return obj.amount
    return null
}

function pickReceiverName(data: Json): string | null {
    const receiver = asRecord(data.receiver)
    if (!receiver) return null
    const candidates = [receiver.displayName, receiver.name]
    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim()
    }
    const account = asRecord(receiver.account)
    if (account && typeof account.name === "string") return account.name
    return null
}

async function saveSlipImage(name: string, imageBase64: string): Promise<string | null> {
    try {
        const match = imageBase64.match(/^data:image\/(\w+);base64,(.*)$/s)
        const ext = match ? match[1] : "jpg"
        const payload = match ? match[2] : imageBase64
        const safe = name.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || `${Date.now()}`
        const dir = path.join(process.cwd(), "public", "slips")
        await fs.mkdir(dir, { recursive: true })
        const filename = `${safe}.${ext === "jpeg" ? "jpg" : ext}`
        await fs.writeFile(path.join(dir, filename), Buffer.from(payload, "base64"))
        return `/slips/${filename}`
    } catch (err) {
        console.error("[slip] save image failed:", err)
        return null
    }
}

function publicBaseUrl(): string {
    return (
        process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
        process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
        ""
    )
}

export async function staticStoreQrPublicUrl(): Promise<string | null> {
    const base = (await resolvePublicHttpsBase()) || publicBaseUrl()
    if (!base.startsWith("https://")) return null
    return `${base}${STATIC_STORE_QR_PATH}`
}

export async function stageOrderPaymentTotal(
    threadId: string,
    totalAmount: number,
    items?: string | null,
    displayName?: string | null
): Promise<string> {
    await ensureChatCustomer(threadId, displayName)

    const open = await prisma.order.findFirst({
        where: {
            threadId,
            status: { in: ["COLLECTING", "PENDING_FULFILLMENT"] },
            paymentStatus: { in: ["PENDING", "PARTIAL_PAID"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
    })

    const payload = {
        totalAmount,
        amount: totalAmount,
        items: items?.trim() || undefined,
        paymentMethod: "TRANSFER" as const,
        paymentStatus: "PENDING" as const,
    }

    if (open) {
        await prisma.order.update({ where: { id: open.id }, data: payload })
        await linkOrderToChatCustomer(open.id, threadId, displayName)
        return open.id
    }

    const created = await prisma.order.create({
        data: {
            threadId,
            customerName: (displayName ?? "").trim() || "ลูกค้า LINE",
            phone: "",
            address: "",
            status: "COLLECTING",
            ...payload,
        },
        select: { id: true },
    })
    await linkOrderToChatCustomer(created.id, threadId, displayName)
    return created.id
}

export async function processSlipForThread(
    threadId: string,
    imageBase64: string,
    displayName?: string | null
): Promise<SlipOutcome> {
    let open = await prisma.order.findFirst({
        where: {
            threadId,
            status: { in: ["COLLECTING", "PENDING_FULFILLMENT"] },
            paymentStatus: { in: ["PENDING", "PARTIAL_PAID", "PENDING_REFUND"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            totalAmount: true,
            amount: true,
            paidAmount: true,
        },
    })

    if (!open) {
        const created = await prisma.order.create({
            data: {
                threadId,
                customerName: (displayName ?? "").trim() || "ลูกค้า LINE",
                phone: "",
                address: "",
                status: "COLLECTING",
                paymentMethod: "TRANSFER",
                paymentStatus: "PENDING",
            },
            select: {
                id: true,
                totalAmount: true,
                amount: true,
                paidAmount: true,
            },
        })
        await linkOrderToChatCustomer(created.id, threadId, displayName)
        open = created
    }

    const checkCondition = buildSlipCheckCondition()

    let resp: Json
    try {
        resp = await callVerifySlip(imageBase64, checkCondition)
    } catch (err) {
        const status = (err as { status?: number }).status
        console.error("[slip] verify-slip failed:", (err as Error).message)
        return {
            status: status && status >= 400 && status < 500 ? "invalid" : "error",
            message: (err as Error).message,
            failureReason: "provider_rejected",
        }
    }

    if (!isSlip2GoResponseValid(resp)) {
        const failureReason = describeSlipValidationFailure(resp)
        console.warn(
            "[slip] Slip2Go rejected slip:",
            failureReason,
            JSON.stringify(resp).slice(0, 400)
        )
        return {
            status: failureReason === "duplicate" ? "duplicate" : "invalid",
            message: "Slip2Go validation failed",
            failureReason,
        }
    }

    const data = getSlipData(resp)
    const referenceId = pickReferenceId(data)
    const amount = pickAmount(data)
    const receiverName = pickReceiverName(data)

    if (amount == null || amount <= 0) {
        return {
            status: "invalid",
            referenceId,
            amount,
            receiverName,
            failureReason: "unreadable",
        }
    }

    if (referenceId) {
        const dupSlip = await prisma.paymentSlip.findUnique({
            where: { referenceId },
            select: { order: { select: { threadId: true } } },
        })
        if (dupSlip && dupSlip.order.threadId !== threadId) {
            return { status: "duplicate", referenceId, amount, receiverName }
        }
        const dupOnOrder = await prisma.paymentSlip.findFirst({
            where: { orderId: open.id, referenceId },
            select: { id: true },
        })
        if (dupOnOrder) {
            return { status: "duplicate", referenceId, amount, receiverName }
        }
        const dupOrder = await prisma.order.findFirst({
            where: { slipReferenceId: referenceId, threadId: { not: threadId } },
            select: { id: true },
        })
        if (dupOrder) {
            return { status: "duplicate", referenceId, amount, receiverName }
        }
    }

    const imageUrl = await saveSlipImage(
        referenceId ?? `${threadId}-${Date.now()}`,
        imageBase64
    )

    const reconciliation = await reconcileSlipPayment(open.id, amount, {
        imageUrl,
        referenceId,
    })

    return {
        status: "verified",
        amount,
        referenceId,
        receiverName,
        reconciliation,
        orderId: open.id,
    }
}

export async function publishPaymentQrImage(
    paymentQr: PaymentQr | null | undefined
): Promise<string | null> {
    if (paymentQr?.static_url) {
        return paymentQr.static_url
    }

    const dataUrl = paymentQr?.image_base64
    if (!dataUrl) {
        if (paymentQr?.use_static) {
            const staticUrl = await staticStoreQrPublicUrl()
            if (staticUrl) {
                console.log(`[payment-qr] ใช้รูปร้านค้า: ${staticUrl}`)
                return staticUrl
            }
            console.error(
                "[payment-qr] ไม่พบ URL สำหรับ store-promptpay.png — ตั้ง PUBLIC_APP_URL หรือรัน ngrok ชี้พอร์ต 3000"
            )
        }
        return null
    }

    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s)
    const ext = match?.[1] === "jpeg" ? "jpg" : match?.[1] || "png"
    const payload = match?.[2] ?? dataUrl

    const base = await resolvePublicHttpsBase()
    if (!base?.startsWith("https://")) {
        console.error(
            "[payment-qr] ต้องมี HTTPS สาธารณะ — ตั้ง PUBLIC_APP_URL หรือรัน ngrok ชี้พอร์ต 3000"
        )
        return null
    }

    try {
        const filename = `${crypto.randomBytes(12).toString("hex")}.${ext}`
        const dir = path.join(process.cwd(), "public", "payment-qr")
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(path.join(dir, filename), Buffer.from(payload, "base64"))
        const url = `${base}/payment-qr/${filename}`
        console.log(`[payment-qr] published ${url}`)
        return url
    } catch (err) {
        console.error("[payment-qr] save failed:", err)
        return null
    }
}

export function buildSlipSystemNote(outcome: SlipOutcome): string {
    const r = outcome.reconciliation
    const actual = outcome.amount ?? 0

    if (!r) {
        return (
            `(ระบบยืนยันสลิป: ลูกค้าโอน ${actual.toLocaleString("th-TH")} บาท) ` +
            `กรุณาขอบคุณและขอข้อมูลจัดส่ง`
        )
    }

    if (r.kind === "PAID") {
        return (
            `[ข้อมูลระบบ: สลิปถูกต้อง ได้รับยอดโอน ${r.paidAmount.toLocaleString("th-TH")} บาท ` +
            `ครบยอด ${r.totalAmount.toLocaleString("th-TH")} บาทแล้ว ` +
            `กรุณาขอบคุณลูกค้าและขอชื่อ-ที่อยู่ พร้อมเบอร์โทรศัพท์สำหรับจัดส่งสินค้า]`
        )
    }

    if (r.kind === "PARTIAL_PAID") {
        return (
            `(ระบบชำระเงินบางส่วน: สลิปนี้ ${actual.toLocaleString("th-TH")} บาท ` +
            `รวมแล้ว ${r.paidAmount.toLocaleString("th-TH")} จาก ${r.totalAmount.toLocaleString("th-TH")} บาท ` +
            `ยังขาดอีก ${r.missingAmount.toLocaleString("th-TH")} บาท) ` +
            `กรุณาขอบคุณลูกค้าอย่างสุภาพ แจ้งยอดที่ขาด และบอกว่าส่ง QR สำหรับยอดที่เหลือให้แล้ว ` +
            `อย่าขอข้อมูลจัดส่งจนกว่าจะชำระครบ`
        )
    }

    if (r.kind === "OVERPAID") {
        return (
            `(ระบบตรวจพบโอนเกิน: สลิปนี้ ${actual.toLocaleString("th-TH")} บาท ` +
            `รวมแล้ว ${r.paidAmount.toLocaleString("th-TH")} บาท เกินมา ${r.overpaidAmount.toLocaleString("th-TH")} บาท ` +
            `จากยอด ${r.totalAmount.toLocaleString("th-TH")} บาท) ` +
            `กรุณาถามลูกค้าอย่างสุภาพว่าต้องการ 1) เก็บเป็นเครดิตสำหรับซื้อครั้งหน้า ` +
            `หรือ 2) ให้ผู้จัดการโอนเงินส่วนเกินคืน อย่าขอข้อมูลจัดส่งจนกว่าจะจัดการยอดเกินเสร็จ`
        )
    }

    return (
        `(ระบบรับสลิป ${actual.toLocaleString("th-TH")} บาท) ` +
        `กรุณาขอบคุณและดำเนินการต่อ`
    )
}

/** Generate a dynamic PromptPay QR PNG for a partial/missing balance. */
export async function fetchPartialPaymentQr(
    amount: number,
    items?: string
): Promise<PaymentQr | null> {
    if (amount <= 0) return null
    try {
        const res = await fetchBrain("/payments/partial-qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount, items: items ?? "" }),
        })
        if (!res.ok) return null
        return (await res.json()) as PaymentQr
    } catch {
        return null
    }
}
