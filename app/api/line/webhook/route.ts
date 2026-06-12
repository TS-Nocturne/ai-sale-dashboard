import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"

import { prisma } from "@/lib/prisma"
import { enqueueMessageToBrain, AIServiceError } from "@/lib/ai-service"
import { buildSlipSystemNote, fetchPartialPaymentQr, processSlipForThread } from "@/lib/payments"
import { syncLeadFromThread } from "@/lib/operational-sync"
import {
    cancelUnpaidOrdersForThread,
    looksLikeOrderCancellation,
} from "@/lib/order-cancel"
import { slipInvalidUserMessage } from "@/lib/slip-verification"
import {
    fetchLineMessageContent,
    getLineUserProfile,
    lineImageToDataUrl,
    lineTargetFromThreadId,
    pushLineText,
    replyLineText,
} from "@/lib/line"
import { saveCustomerImage } from "@/lib/uploads"

// LINE webhook ต้องรันบน Node runtime (ใช้ crypto + Prisma/pg ไม่ได้บน Edge)
export const runtime = "nodejs"

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? ""
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ""

// กลุ่มที่อนุญาตให้บอทตอบ (อื่นๆ จะถูกข้าม) — เว้นว่าง = ไม่ตอบในกลุ่มใดเลย
const ALLOWED_GROUP_IDS = (process.env.LINE_GROUP_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

// ข้อความมาตรฐานเมื่อเจ้าหน้าที่กำลังเข้าดูแล (ตรงกับ botStatus = PAUSED_FOR_HUMAN)
const STAFF_INTERVENING_MESSAGE =
    "ขณะนี้เจ้าหน้าที่กำลังเข้ามาดูแลการสนทนาของคุณด้วยตนเอง กรุณารอสักครู่ ทีมงานจะติดต่อกลับโดยเร็วที่สุดค่ะ 🙏"

// ── LINE helpers ───────────────────────────────────────────────────────────────

/** ตรวจสอบ Signature จาก LINE (ป้องกัน request ปลอม) */
function verifySignature(body: string, signature: string): boolean {
    if (!LINE_CHANNEL_SECRET || !signature) return false
    const hash = crypto
        .createHmac("SHA256", LINE_CHANNEL_SECRET)
        .update(body)
        .digest("base64")
    // เทียบแบบ constant-time กันการเดา signature
    const a = Buffer.from(hash)
    const b = Buffer.from(signature)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** ส่งข้อความตอบกลับไปยัง LINE ผ่าน reply token */
async function replyMessage(replyToken: string, text: string): Promise<void> {
    await replyLineText(replyToken, text)
}

// ── Conversation mapping ─────────────────────────────────────────────────────

interface LineSource {
    type?: string
    userId?: string
    groupId?: string
    roomId?: string
}

/**
 * แปลง LINE source → conversation key ที่คงที่ (ใช้เป็น LangGraph thread_id)
 * คืน null เมื่อไม่ควรตอบ (เช่น กลุ่มที่ไม่อยู่ใน allowlist หรือไม่มี id)
 */
function resolveConversationId(source: LineSource | undefined): string | null {
    if (!source) return null

    if (source.type === "group" && source.groupId) {
        return ALLOWED_GROUP_IDS.includes(source.groupId)
            ? `line:group:${source.groupId}`
            : null
    }
    if (source.type === "room" && source.roomId) {
        return ALLOWED_GROUP_IDS.includes(source.roomId)
            ? `line:room:${source.roomId}`
            : null
    }
    if (source.userId) {
        return `line:user:${source.userId}`
    }
    return null
}

/** True for an auto-generated/placeholder title we are happy to overwrite. */
function isDefaultTitle(title: string | null): boolean {
    if (!title) return true
    return title.startsWith("LINE:") || title === "รูปภาพ"
}

/**
 * หา/สร้าง Conversation สำหรับ thread นี้ (external channel → userId = null).
 *
 * ตั้งหัวข้อแชทเป็น "ชื่อ LINE ของลูกค้า" เมื่อดึงโปรไฟล์ได้ ไม่งั้น fallback
 * เป็นข้อความแรก เพื่อให้เจ้าหน้าที่เห็นชื่อลูกค้าแทนข้อความแรกที่ส่งมา
 */
async function ensureConversation(
    conversationId: string,
    firstMessage: string,
    displayName?: string | null
) {
    const fallbackTitle = `LINE: ${firstMessage.slice(0, 50)}`
    const existing = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, title: true },
    })

    if (!existing) {
        return prisma.conversation.create({
            data: {
                id: conversationId,
                title: displayName?.trim() || fallbackTitle,
            },
        })
    }

    // อัปเกรดหัวข้อเดิมที่ยังเป็น placeholder ให้เป็นชื่อ LINE เมื่อดึงได้
    if (displayName?.trim() && isDefaultTitle(existing.title)) {
        return prisma.conversation.update({
            where: { id: conversationId },
            data: { title: displayName.trim() },
        })
    }

    return existing
}

// ── Event handling ───────────────────────────────────────────────────────────

async function handleTextMessage(
    conversationId: string,
    replyToken: string,
    text: string,
    displayName?: string | null
): Promise<void> {
    await ensureConversation(conversationId, text, displayName)
    await syncLeadFromThread(conversationId, { displayName })

    // บันทึกข้อความลูกค้าเสมอ เพื่อให้เจ้าหน้าที่เห็นใน /dashboard/chat
    await prisma.message.create({
        data: { conversationId, role: "USER", content: text },
    })

    if (looksLikeOrderCancellation(text)) {
        await cancelUnpaidOrdersForThread(conversationId, {
            displayName,
            reason: "customer_declined",
        })
    }

    // เคารพระบบ handoff: ถ้าเจ้าหน้าที่กำลังดูแล อย่าเรียกบอท (ประหยัด token)
    const thread = await prisma.chatThread.findUnique({
        where: { id: conversationId },
        select: { botStatus: true },
    })
    if (thread?.botStatus === "PAUSED_FOR_HUMAN") {
        await replyMessage(replyToken, STAFF_INTERVENING_MESSAGE)
        return
    }

    // ส่งงานให้ Python brain แบบ async — ตอบ LINE webhook ทันที, Python คิดเสร็จแล้ว push เอง
    const lineTarget = lineTargetFromThreadId(conversationId)

    try {
        await enqueueMessageToBrain(conversationId, text, {
            linePushTarget: lineTarget ?? undefined,
            displayName: displayName ?? undefined,
        })
    } catch (error) {
        const message = getLineBrainErrorMessage(error)
        console.error("LINE brain enqueue error:", error)
        if (lineTarget) {
            await pushLineText(lineTarget, message)
        } else {
            await replyMessage(replyToken, message)
        }
    }
}

function getLineBrainErrorMessage(error: unknown): string {
    if (error instanceof AIServiceError) {
        if (
            error.status === 504 ||
            /timeout|timed out|ใช้เวลาตอบนาน/i.test(error.message)
        ) {
            return "ขออภัยค่ะ ระบบใช้เวลาตอบนานกว่าปกติ รบกวนลองพิมพ์ใหม่อีกครั้งนะคะ 🙏"
        }
        if (
            error.status === 503 ||
            /unavailable|high demand|overloaded|rate limit|try again/i.test(error.message)
        ) {
            return "ขออภัยค่ะ ระบบ AI มีผู้ใช้งานจำนวนมากในขณะนี้ รบกวนลองพิมพ์ใหม่อีกครั้งในอีก 1–2 นาทีนะคะ 🙏"
        }
        return "ขออภัยค่ะ ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง"
    }
    return "ขออภัยค่ะ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง"
}

async function handleImageMessage(
    conversationId: string,
    replyToken: string,
    messageId: string,
    displayName?: string | null
): Promise<void> {
    await ensureConversation(conversationId, "รูปภาพ", displayName)

    // ① ดึงรูปจาก LINE Content API ด้วย message.id
    console.log(`[LINE] สลิป: ดึงรูป messageId=${messageId}`)
    const image = await fetchLineMessageContent(messageId)
    if (!image) {
        await prisma.message.create({
            data: {
                conversationId,
                role: "USER",
                content: "[ลูกค้าส่งรูปภาพ — ระบบโหลดรูปไม่สำเร็จ]",
            },
        })
        await replyMessage(
            replyToken,
            "ขออภัยค่ะ ระบบโหลดรูปไม่สำเร็จ รบกวนส่งใหม่อีกครั้งนะคะ 🙏"
        )
        return
    }

    const imageUrl = await saveCustomerImage(image.buffer, image.contentType)
    await prisma.message.create({
        data: {
            conversationId,
            role: "USER",
            content: "[ลูกค้าส่งรูปสลิป]",
            imageUrl,
        },
    })

    const thread = await prisma.chatThread.findUnique({
        where: { id: conversationId },
        select: { botStatus: true },
    })
    if (thread?.botStatus === "PAUSED_FOR_HUMAN") {
        await replyMessage(replyToken, STAFF_INTERVENING_MESSAGE)
        return
    }

    // ② ส่งรูปให้ Slip2Go ตรวจ (ยอด/บัญชี/สลิปซ้ำ ตาม checkCondition)
    const imageBase64 = lineImageToDataUrl(image.buffer, image.contentType)
    console.log(`[LINE] สลิป: ตรวจสอบผ่าน Slip2Go thread=${conversationId}`)
    const outcome = await processSlipForThread(conversationId, imageBase64, displayName)

    if (outcome.status === "duplicate") {
        await replyMessage(
            replyToken,
            "สลิปนี้เคยถูกใช้ยืนยันการชำระเงินไปแล้วค่ะ 🙏 หากเป็นการโอนครั้งใหม่ รบกวนส่งสลิปการโอนล่าสุดให้ทางร้านตรวจสอบอีกครั้งนะคะ"
        )
        return
    }

    if (outcome.status === "invalid") {
        await replyMessage(
            replyToken,
            slipInvalidUserMessage(outcome.failureReason ?? "unreadable")
        )
        return
    }

    if (outcome.status === "error") {
        await replyMessage(
            replyToken,
            "ขออภัยค่ะ ระบบตรวจสอบสลิปขัดข้องชั่วคราว รบกวนลองส่งใหม่อีกครั้งในอีกสักครู่นะคะ 🙏"
        )
        return
    }

    // ③④ สลิปผ่าน → กระซิบ LangGraph แล้ว push คำตอบเมื่อ AI คิดเสร็จ
    const note = buildSlipSystemNote(outcome)
    const lineTarget = lineTargetFromThreadId(conversationId)

    let attachPaymentQr = null
    if (outcome.reconciliation?.kind === "PARTIAL_PAID") {
        attachPaymentQr = await fetchPartialPaymentQr(
            outcome.reconciliation.missingAmount,
            "ยอดค้างชำระ"
        )
    }

    let paymentContext = undefined
    if (outcome.reconciliation?.kind === "OVERPAID") {
        paymentContext = {
            overpaid_amount: outcome.reconciliation.overpaidAmount,
            total_amount: outcome.reconciliation.totalAmount,
            paid_amount: outcome.reconciliation.paidAmount,
        }
    }

    console.log(`[LINE] สลิป: ส่งต่อ brain async (${outcome.reconciliation?.kind ?? "verified"})`)

    try {
        await enqueueMessageToBrain(conversationId, note, {
            linePushTarget: lineTarget ?? undefined,
            displayName: displayName ?? undefined,
            attachPaymentQr: attachPaymentQr ?? undefined,
        }, paymentContext)
    } catch (error) {
        console.error("LINE slip brain enqueue error:", error)
        const fallback =
            outcome.reconciliation?.kind === "PAID"
                ? "ได้รับสลิปและตรวจสอบการชำระเงินเรียบร้อยแล้วค่ะ ✅ รบกวนแจ้งชื่อผู้รับ ที่อยู่จัดส่ง เบอร์โทร และรหัสไปรษณีย์ เพื่อจัดส่งสินค้าให้นะคะ 🙏"
                : "ได้รับสลิปเรียบร้อยแล้วค่ะ กรุณารอสักครู่นะคะ"
        if (lineTarget) {
            await pushLineText(lineTarget, fallback)
        } else {
            await replyMessage(replyToken, fallback)
        }
    }
}

// ── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN) {
        console.error("[LINE] missing LINE_CHANNEL_SECRET / ACCESS_TOKEN in .env")
        return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const body = await request.text()
    const signature = request.headers.get("x-line-signature") ?? ""

    if (!verifySignature(body, signature)) {
        // log ให้เห็นชัด: ปกติเกิดจากใช้ Channel Secret ผิด channel
        // (ต้องใช้ของ "Messaging API" ไม่ใช่ของ "LINE Login")
        console.warn(
            "[LINE] signature ไม่ผ่าน — ตรวจสอบ LINE_CHANNEL_SECRET ให้ตรงกับ Messaging API channel",
            { hasSignature: Boolean(signature), bodyLength: body.length }
        )
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    let data: { events?: unknown[] }
    try {
        data = JSON.parse(body)
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const events = Array.isArray(data.events) ? data.events : []
    console.log(`[LINE] รับ ${events.length} event(s)`)
    if (events.length === 0) {
        // มักเป็น webhook verification ping จากหน้า LINE Console (ปกติ)
        console.log("[LINE] ไม่มี event (น่าจะเป็น Verify ping) — ตอบ 200")
    }

    // ประมวลผลทุก event — ห่อ try/catch ราย event เพื่อไม่ให้ทั้ง batch ล้ม
    // (ถ้าตอบ non-200 LINE จะ retry ซ้ำ ทำให้ข้อความซ้ำ)
    await Promise.all(
        events.map(async (raw) => {
            try {
                const event = raw as {
                    type?: string
                    replyToken?: string
                    source?: LineSource
                    message?: { type?: string; text?: string; id?: string }
                }

                const messageType = event.message?.type
                if (
                    event.type !== "message" ||
                    (messageType !== "text" && messageType !== "image")
                ) {
                    console.log(
                        `[LINE] ข้าม event: type=${event.type} messageType=${messageType}`
                    )
                    return
                }
                if (!event.replyToken) {
                    console.log("[LINE] ข้าม: ไม่มี replyToken")
                    return
                }

                const conversationId = resolveConversationId(event.source)
                if (!conversationId) {
                    console.log(
                        `[LINE] ข้าม: source ไม่รองรับ/ไม่อยู่ใน allowlist`,
                        event.source
                    )
                    return
                }

                // ดึงชื่อ LINE ของลูกค้า (เฉพาะแชท 1:1) เพื่อใช้เป็นหัวข้อแชท
                const displayName =
                    event.source?.type === "user" && event.source.userId
                        ? (await getLineUserProfile(event.source.userId))?.displayName ?? null
                        : null

                if (messageType === "image") {
                    if (!event.message?.id) {
                        console.log("[LINE] ข้าม: image ไม่มี messageId")
                        return
                    }
                    console.log(
                        `[LINE] รับรูปสลิปจาก ${conversationId} messageId=${event.message.id}`
                    )
                    await handleImageMessage(
                        conversationId,
                        event.replyToken,
                        event.message.id,
                        displayName
                    )
                    return
                }

                if (!event.message?.text) {
                    console.log("[LINE] ข้าม: ไม่มี text")
                    return
                }

                console.log(
                    `[LINE] ประมวลผลข้อความจาก ${conversationId}: "${event.message.text.slice(0, 50)}"`
                )
                await handleTextMessage(
                    conversationId,
                    event.replyToken,
                    event.message.text,
                    displayName
                )
            } catch (err) {
                console.error("LINE event error:", err)
            }
        })
    )

    return NextResponse.json({ status: "ok" })
}
