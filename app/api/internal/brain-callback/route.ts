import { NextRequest, NextResponse } from "next/server"

import type { AgentResponse } from "@/lib/ai-service"
import { applyBrainResult } from "@/lib/brain-sync"
import { lineTargetFromThreadId, pushWithAssistantAndQr } from "@/lib/line"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? ""

/**
 * Internal callback invoked by the Python brain after an async /chat job
 * finishes. Persists the agent reply + side effects; returns a public QR URL
 * so Python can push the image to LINE.
 */
export async function POST(request: NextRequest) {
    if (!INTERNAL_API_KEY) {
        return NextResponse.json(
            { error: "INTERNAL_API_KEY is not configured" },
            { status: 500 }
        )
    }

    const provided = request.headers.get("x-internal-key") ?? ""
    if (provided !== INTERNAL_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: {
        thread_id?: string
        result?: AgentResponse
        display_name?: string | null
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const threadId = body.thread_id?.trim()
    const result = body.result
    if (!threadId || !result?.thread_id) {
        return NextResponse.json({ error: "Missing thread_id or result" }, { status: 400 })
    }

    try {
        const lastUserMessage = await prisma.message.findFirst({
            where: { conversationId: threadId, role: "USER" },
            orderBy: { createdAt: "desc" },
            select: { content: true },
        })

        const { qrImageUrl } = await applyBrainResult(threadId, result, {
            displayName: body.display_name ?? null,
            customerMessage: lastUserMessage?.content ?? null,
        })

        const lineTarget = lineTargetFromThreadId(threadId)
        if (lineTarget && result.reply?.trim()) {
            if (qrImageUrl && result.payment_qr) {
                result.payment_qr = { ...result.payment_qr, static_url: qrImageUrl }
            }
            await pushWithAssistantAndQr(
                lineTarget,
                result.reply,
                result.payment_qr,
                qrImageUrl
            )
        }

        return NextResponse.json({
            ok: true,
            thread_id: threadId,
            qr_image_url: qrImageUrl,
        })
    } catch (error) {
        console.error("[brain-callback] failed:", error)
        return NextResponse.json({ error: "Failed to apply brain result" }, { status: 500 })
    }
}
