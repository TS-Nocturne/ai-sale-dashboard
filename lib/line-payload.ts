import "server-only"

import type { PaymentQr } from "@/lib/ai-service"
import type { LineReplyMessage } from "@/lib/line"
import { publishPaymentQrImage } from "@/lib/payments"

/** Machine-readable QR breadcrumb embedded by Python tools / service layer. */
export const LINE_QR_TAG_RE = /\[\[LINE_QR_IMAGE:([^\]]+)\]\]/g

export function formatLineQrTag(imageUrl: string): string {
    return `[[LINE_QR_IMAGE:${imageUrl.trim()}]]`
}

export function stripLineQrTags(text: string): string {
    const cleaned = (text || "").replace(LINE_QR_TAG_RE, "")
    return cleaned.replace(/\n{3,}/g, "\n\n").trim()
}

export function extractLineQrUrls(text: string): string[] {
    const urls: string[] = []
    for (const match of text.matchAll(LINE_QR_TAG_RE)) {
        const url = match[1]?.trim()
        if (url) urls.push(url)
    }
    return urls
}

export function embedLineQrTag(text: string, tagUrl: string | null | undefined): string {
    const body = (text || "").trim()
    if (!tagUrl?.trim()) return body
    const tag = formatLineQrTag(tagUrl)
    if (body.includes(tag)) return body
    return body ? `${body}\n${tag}` : tag
}

/**
 * Payload interception: strip QR tags from assistant text and attach a LINE
 * image message when payment metadata or tag URLs are present.
 */
export async function buildLinePushMessages(
    reply: string,
    options?: { paymentQr?: PaymentQr | null; qrImageUrl?: string | null }
): Promise<LineReplyMessage[]> {
    const taggedUrls = extractLineQrUrls(reply)
    let text = stripLineQrTags(reply)
    if (!text) {
        text = "รับทราบค่ะ กรุณาสแกน QR ด้านล่างเพื่อชำระเงินนะคะ 🙏"
    }

    const messages: LineReplyMessage[] = [{ type: "text", text: text.slice(0, 5000) }]

    let imgUrl = options?.qrImageUrl?.trim() || taggedUrls[0] || null
    if (!imgUrl && options?.paymentQr) {
        imgUrl = await publishPaymentQrImage(options.paymentQr)
    }

    if (imgUrl) {
        messages.push({
            type: "image",
            originalContentUrl: imgUrl,
            previewImageUrl: imgUrl,
        })
        console.log(`[LINE] แนบ QR image: ${imgUrl}`)
    } else if (
        options?.paymentQr &&
        (options.paymentQr.use_static ||
            options.paymentQr.image_base64 ||
            options.paymentQr.static_url)
    ) {
        console.warn(
            "[LINE] มี payment_qr แต่ resolve URL ไม่ได้ — ตั้ง PUBLIC_APP_URL หรือรัน ngrok ชี้พอร์ต 3000"
        )
    }

    return messages
}
