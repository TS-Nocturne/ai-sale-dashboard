import "server-only"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { revalidateOperationalPages, syncLeadFromThread } from "@/lib/operational-sync"

const CANCEL_PATTERNS: RegExp[] = [
    /ไม่\s*เอา(?:แล้ว)?/i,
    /ไม่\s*สนใจ(?:แล้ว)?/i,
    /ไม่\s*ซื้อ(?:แล้ว)?/i,
    /ไม่\s*สั่ง(?:แล้ว)?/i,
    /ไม่\s*ต(?:้)?องการ(?:แล้ว)?/i,
    /ยก\s*เลิก/i,
    /cancel/i,
    /เลิก(?:ซื้อ|สั่ง)(?:แล้ว)?/i,
]

/** True when the customer clearly declines an unpaid order. */
export function looksLikeOrderCancellation(text: string): boolean {
    const trimmed = (text ?? "").trim()
    if (!trimmed) return false
    return CANCEL_PATTERNS.some((re) => re.test(trimmed))
}

export function shouldCancelUnpaidOrders(options: {
    customerMessage?: string | null
    pipelineStage?: string | null
}): boolean {
    if (options.customerMessage && looksLikeOrderCancellation(options.customerMessage)) {
        return true
    }
    return (options.pipelineStage ?? "").toLowerCase() === "closed_lost"
}

const OPEN_PAYMENT_STATUSES = ["PENDING", "PARTIAL_PAID"] as const

/** Cancel every unpaid order on a thread — removes it from the awaiting-payment queue. */
export async function cancelUnpaidOrdersForThread(
    threadId: string,
    options?: { displayName?: string | null; reason?: string }
): Promise<number> {
    const open = await prisma.order.findMany({
        where: {
            threadId,
            status: { notIn: ["SHIPPED", "CANCELLED"] },
            paymentStatus: { in: [...OPEN_PAYMENT_STATUSES] },
        },
        select: { id: true },
    })

    if (open.length === 0) return 0

    const noteSuffix = options?.reason === "customer_declined"
        ? "ลูกค้าแจ้งยกเลิก/ไม่สนใจแล้ว"
        : options?.reason === "manager"
          ? "ยกเลิกโดยผู้จัดการ"
          : "ยกเลิกออเดอร์"

    await prisma.$transaction([
        ...open.map((order) =>
            prisma.order.update({
                where: { id: order.id },
                data: {
                    status: "CANCELLED",
                    paymentStatus: "CANCELLED",
                    note: noteSuffix,
                },
            })
        ),
        prisma.approvalRequest.updateMany({
            where: { threadId, status: "PENDING" },
            data: { status: "REJECTED", decidedAt: new Date() },
        }),
    ])

    await syncLeadFromThread(threadId, {
        displayName: options?.displayName,
        pipelineStage: "closed_lost",
    })

    revalidatePath("/dashboard/orders")
    revalidateOperationalPages()

    return open.length
}

/** Manager action — cancel a single unpaid order and drop it from the payment queue. */
export async function cancelAwaitingPaymentOrder(orderId: string): Promise<{
    ok: boolean
    message: string
}> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true,
            threadId: true,
            status: true,
            paymentStatus: true,
            paidAmount: true,
            customerName: true,
        },
    })

    if (!order) {
        return { ok: false, message: "ไม่พบออเดอร์นี้" }
    }
    if (order.status === "SHIPPED") {
        return { ok: false, message: "ออเดอร์ที่จัดส่งแล้วไม่สามารถยกเลิกได้" }
    }
    if (order.paymentStatus === "PAID" && order.paidAmount > 0) {
        return { ok: false, message: "ออเดอร์ที่ชำระเงินแล้วไม่สามารถลบออกจากรายการรอชำระได้" }
    }
    if (order.status === "CANCELLED" || order.paymentStatus === "CANCELLED") {
        return { ok: true, message: "ออเดอร์นี้ถูกยกเลิกไปแล้ว" }
    }
    if (!OPEN_PAYMENT_STATUSES.includes(order.paymentStatus as (typeof OPEN_PAYMENT_STATUSES)[number])) {
        return { ok: false, message: "ออเดอร์นี้ไม่อยู่ในสถานะรอชำระเงิน" }
    }

    await prisma.order.update({
        where: { id: orderId },
        data: {
            status: "CANCELLED",
            paymentStatus: "CANCELLED",
            note: "ยกเลิกโดยผู้จัดการ",
        },
    })

    await prisma.approvalRequest.updateMany({
        where: { threadId: order.threadId, status: "PENDING" },
        data: { status: "REJECTED", decidedAt: new Date() },
    })

    await syncLeadFromThread(order.threadId, { pipelineStage: "closed_lost" })

    revalidatePath("/dashboard/orders")
    revalidateOperationalPages()

    return {
        ok: true,
        message: `ยกเลิกออเดอร์ของ ${order.customerName} และนำออกจากรายการรอชำระเงินแล้ว`,
    }
}
