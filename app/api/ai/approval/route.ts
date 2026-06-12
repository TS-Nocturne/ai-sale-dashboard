import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendApprovalToBrain, AIServiceError } from "@/lib/ai-service"
import {
    finalPriceFromPending,
    resolvePendingApprovalForThread,
    syncApprovalQueue,
} from "@/lib/approvals"
import { revalidateOperationalPages } from "@/lib/operational-sync"
import { stageOrderPaymentTotal } from "@/lib/payments"
import { Prisma } from "@/app/generated/prisma/client"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

/**
 * BFF proxy for Human-in-the-Loop discount approval.
 *
 * Only managers/admins may approve or reject a pending discount. Forwards the
 * decision to the Python brain (which resumes the interrupted LangGraph run),
 * then persists the resulting reply.
 */
export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["admin", "manager"].includes(session.user.role ?? "")) {
        return NextResponse.json(
            { error: "Forbidden: ต้องเป็นผู้จัดการหรือผู้ดูแลระบบจึงจะอนุมัติส่วนลดได้" },
            { status: 403 }
        )
    }

    let body: { conversationId?: string; approved?: boolean }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { conversationId, approved } = body
    if (!conversationId || typeof approved !== "boolean") {
        return NextResponse.json(
            { error: "Missing conversationId or approved" },
            { status: 400 }
        )
    }

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
    })
    if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    try {
        const result = await sendApprovalToBrain(conversationId, approved)
        const action = approved ? "approve" : "reject"

        if (result.reply) {
            await prisma.message.create({
                data: {
                    conversationId,
                    role: "ASSISTANT",
                    content: result.reply,
                    metadata: {
                        decision: action,
                        decidedBy: session.user.id,
                        lead_score: result.lead_score,
                        pipeline_stage: result.pipeline_stage,
                    } as Prisma.InputJsonValue,
                },
            })
        }

        await resolvePendingApprovalForThread(conversationId, action, session.user.id)

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                leadScore: result.lead_score,
                pipelineStage: result.pipeline_stage,
                awaitingApproval: result.requires_approval,
            },
        })

        await syncApprovalQueue(conversationId, result)

        if (approved && result.payment_qr?.amount && result.payment_qr.amount > 0) {
            await stageOrderPaymentTotal(
                conversationId,
                result.payment_qr.amount,
                result.payment_qr.items
            )
        } else if (approved && result.pending_discount_approval) {
            const finalPrice = finalPriceFromPending(result.pending_discount_approval)
            if (finalPrice && finalPrice > 0) {
                await stageOrderPaymentTotal(
                    conversationId,
                    finalPrice,
                    result.pending_discount_approval.product
                )
            }
        }

        revalidateOperationalPages()

        return NextResponse.json({ conversationId, ...result })
    } catch (error) {
        if (error instanceof AIServiceError) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
    }
}
