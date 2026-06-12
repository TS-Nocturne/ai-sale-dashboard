import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMessageToBrain, AIServiceError } from "@/lib/ai-service"
import { applyBrainResult } from "@/lib/brain-sync"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

/**
 * BFF proxy: receives a chat message from the browser, authenticates the
 * dashboard user, persists the conversation/message in SQL (Prisma), forwards
 * the message to the Python brain, then stores and returns the agent reply.
 */
export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { message?: string; conversationId?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const message = body.message?.trim()
    if (!message) {
        return NextResponse.json({ error: "Missing message" }, { status: 400 })
    }

    // Find or create the conversation that maps to the LangGraph thread_id.
    let conversation = body.conversationId
        ? await prisma.conversation.findUnique({ where: { id: body.conversationId } })
        : null

    if (conversation && conversation.userId && conversation.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: {
                userId: session.user.id,
                title: message.slice(0, 60),
            },
        })
    }

    // Persist the customer/user message before calling the brain.
    await prisma.message.create({
        data: {
            conversationId: conversation.id,
            role: "USER",
            content: message,
        },
    })

    // Call the Python brain using conversation.id as the thread_id.
    try {
        const result = await sendMessageToBrain(conversation.id, message)
        await applyBrainResult(conversation.id, result, { customerMessage: message })

        return NextResponse.json({ conversationId: conversation.id, ...result })
    } catch (error) {
        if (error instanceof AIServiceError) {
            return NextResponse.json(
                { error: error.message, conversationId: conversation.id },
                { status: error.status }
            )
        }
        return NextResponse.json(
            { error: "Unexpected error", conversationId: conversation.id },
            { status: 500 }
        )
    }
}
