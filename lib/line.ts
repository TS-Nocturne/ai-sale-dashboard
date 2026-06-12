import "server-only"

import type { PaymentQr } from "@/lib/ai-service"
import { buildLinePushMessages } from "@/lib/line-payload"

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ""

/** True when a conversation/thread originated from the LINE channel. */
export function isLineThread(threadId: string): boolean {
    return threadId.startsWith("line:")
}

/**
 * Extract the LINE push target (userId / groupId / roomId) from our thread id.
 *
 * Thread ids are minted by the webhook as `line:user:<id>`,
 * `line:group:<id>` or `line:room:<id>`. Returns null for non-LINE threads.
 */
export function lineTargetFromThreadId(threadId: string): string | null {
    const match = threadId.match(/^line:(?:user|group|room):(.+)$/)
    return match ? match[1] : null
}

/**
 * Push a text message to a LINE user/group/room.
 *
 * Unlike the reply API, push messages work outside the short-lived reply-token
 * window — used to notify the customer of a manager's discount decision.
 * Returns true on success.
 */
export async function pushLineText(to: string, text: string): Promise<boolean> {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.error("[LINE] ไม่มี LINE_CHANNEL_ACCESS_TOKEN — push ไม่ได้")
        return false
    }

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
            to,
            messages: [{ type: "text", text: text.slice(0, 5000) }],
        }),
    })

    if (!res.ok) {
        const detail = await res.text().catch(() => "")
        console.error("[LINE] push ล้มเหลว:", res.status, detail)
        return false
    }
    return true
}

export interface LineProfile {
    displayName: string
    pictureUrl?: string
}

/**
 * Fetch a LINE user's public profile (display name + avatar).
 *
 * Used to title a conversation with the customer's real LINE name instead of
 * the first message text. Returns null if the token is missing or the call
 * fails (the caller should fall back gracefully).
 */
export async function getLineUserProfile(userId: string): Promise<LineProfile | null> {
    if (!LINE_CHANNEL_ACCESS_TOKEN || !userId) return null

    try {
        const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
            headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` },
            cache: "no-store",
        })
        if (!res.ok) {
            console.error("[LINE] ดึงโปรไฟล์ไม่สำเร็จ:", res.status)
            return null
        }
        const data = (await res.json()) as { displayName?: string; pictureUrl?: string }
        if (!data.displayName) return null
        return { displayName: data.displayName, pictureUrl: data.pictureUrl }
    } catch (error) {
        console.error("[LINE] ดึงโปรไฟล์ error:", error)
        return null
    }
}

/** ดึงไฟล์รูป/สลิปที่ลูกค้าส่งมาจาก LINE Content API (ไบต์ + content-type) */
export async function fetchLineMessageContent(
    messageId: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!LINE_CHANNEL_ACCESS_TOKEN || !messageId) return null

    const res = await fetch(
        `https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`,
        { headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
    )
    if (!res.ok) {
        console.error("[LINE] ดึงรูปไม่สำเร็จ:", res.status, messageId)
        return null
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg"
    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer, contentType }
}

/** แปลงไบต์รูปเป็น data URL สำหรับ Slip2Go / เก็บไฟล์ */
export function lineImageToDataUrl(buffer: Buffer, contentType: string): string {
    return `data:${contentType};base64,${buffer.toString("base64")}`
}

/** Extract the raw LINE userId from a `line:user:<id>` thread id (else null). */
export function lineUserIdFromThreadId(threadId: string): string | null {
    const match = threadId.match(/^line:user:(.+)$/)
    return match ? match[1] : null
}

/** ส่งข้อความตอบกลับไปยัง LINE ผ่าน reply token (ข้อความเดียว) */
export async function replyLineText(replyToken: string, text: string): Promise<boolean> {
    return replyLineMessages(replyToken, [{ type: "text", text: text.slice(0, 5000) }])
}

export type LineReplyMessage =
    | { type: "text"; text: string }
    | { type: "image"; originalContentUrl: string; previewImageUrl: string }

/** ส่งหลายข้อความ (ข้อความ + รูป QR) ผ่าน reply token */
export async function replyLineMessages(
    replyToken: string,
    messages: LineReplyMessage[]
): Promise<boolean> {
    if (!LINE_CHANNEL_ACCESS_TOKEN || messages.length === 0) return false

    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
            replyToken,
            messages: messages.slice(0, 5),
        }),
    })

    if (!res.ok) {
        const detail = await res.text().catch(() => "")
        console.error("[LINE] reply ล้มเหลว:", res.status, detail)
        return false
    }
    return true
}

/** Push multiple messages (text + QR image) to a LINE user/group/room. */
export async function pushLineMessages(
    to: string,
    messages: LineReplyMessage[]
): Promise<boolean> {
    if (!LINE_CHANNEL_ACCESS_TOKEN || messages.length === 0) return false

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
            to,
            messages: messages.slice(0, 5),
        }),
    })

    if (!res.ok) {
        const detail = await res.text().catch(() => "")
        console.error("[LINE] push messages ล้มเหลว:", res.status, detail)
        return false
    }
    console.log(`[LINE] push สำเร็จ ${messages.length} message(s) → ${to.slice(0, 8)}…`)
    return true
}

/** ส่งข้อความ AI พร้อม QR ผ่าน push (ใช้เมื่อ brain ใช้เวลานานกว่า reply token ~30s) */
export async function pushWithAssistantAndQr(
    to: string,
    text: string,
    paymentQr?: PaymentQr | null,
    qrImageUrl?: string | null
): Promise<void> {
    const messages = await buildLinePushMessages(text, { paymentQr, qrImageUrl })
    await pushLineMessages(to, messages)
}

/** ตอบข้อความ AI พร้อมรูป QR PromptPay (ถ้ามีจาก brain) */
export async function replyWithAssistantAndQr(
    replyToken: string,
    text: string,
    paymentQr?: PaymentQr | null,
    qrImageUrl?: string | null
): Promise<void> {
    const messages = await buildLinePushMessages(text, { paymentQr, qrImageUrl })
    await replyLineMessages(replyToken, messages)
}
