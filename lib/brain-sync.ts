import "server-only"

import { prisma } from "@/lib/prisma"
import type { AgentResponse } from "@/lib/ai-service"
import { syncApprovalQueue } from "@/lib/approvals"
import { syncOrder } from "@/lib/orders"
import { syncOverpayFromBrain } from "@/lib/order-payments"
import { publishPaymentQrImage, stageOrderPaymentTotal } from "@/lib/payments"
import { syncOperationalState } from "@/lib/operational-sync"
import {
    cancelUnpaidOrdersForThread,
    shouldCancelUnpaidOrders,
} from "@/lib/order-cancel"
import { stripLineQrTags } from "@/lib/line-payload"
import { Prisma } from "@/app/generated/prisma/client"

/**
 * Persist a completed brain result into PostgreSQL (messages, lead state,
 * approvals, orders). Used by the dashboard chat (sync) and the internal
 * brain-callback (async / LINE background flow).
 */
export async function applyBrainResult(
    conversationId: string,
    result: AgentResponse,
    options?: { displayName?: string | null; customerMessage?: string | null }
): Promise<{ qrImageUrl: string | null }> {
    const fallbackTitle =
        options?.displayName?.trim() ||
        (conversationId.startsWith("line:")
            ? `LINE: ${conversationId.slice(0, 50)}`
            : conversationId)

    await prisma.conversation.upsert({
        where: { id: conversationId },
        create: { id: conversationId, title: fallbackTitle },
        update: {},
    })

    if (result.reply) {
        await prisma.message.create({
            data: {
                conversationId,
                role: "ASSISTANT",
                content: stripLineQrTags(result.reply),
                metadata: {
                    channel: conversationId.startsWith("line:") ? "line" : "dashboard",
                    lead_score: result.lead_score,
                    pipeline_stage: result.pipeline_stage,
                    requires_approval: result.requires_approval,
                } as Prisma.InputJsonValue,
            },
        })
    }

    await prisma.conversation.update({
        where: { id: conversationId },
        data: {
            leadScore: result.lead_score,
            pipelineStage: result.pipeline_stage,
            awaitingApproval: result.requires_approval,
        },
    })

    await syncApprovalQueue(conversationId, result)
    await syncOrder(conversationId, result)
    await syncOverpayFromBrain(conversationId, result)

    if (result.handoff_requested) {
        const reason =
            result.handoff_reason?.trim() || "ลูกค้าขอคุยกับเจ้าหน้าที่"
        await prisma.chatThread.upsert({
            where: { id: conversationId },
            create: {
                id: conversationId,
                botStatus: "PAUSED_FOR_HUMAN",
                handoffReason: reason,
                pausedAt: new Date(),
            },
            update: {
                botStatus: "PAUSED_FOR_HUMAN",
                handoffReason: reason,
                pausedAt: new Date(),
            },
        })
    }

    const cancelUnpaid = shouldCancelUnpaidOrders({
        customerMessage: options?.customerMessage,
        pipelineStage: result.pipeline_stage,
    })

    if (cancelUnpaid) {
        await cancelUnpaidOrdersForThread(conversationId, {
            displayName: options?.displayName,
            reason: "customer_declined",
        })
    } else if (result.payment_qr?.amount && result.payment_qr.amount > 0) {
        await stageOrderPaymentTotal(
            conversationId,
            result.payment_qr.amount,
            result.payment_qr.items,
            options?.displayName
        )
    }

    const qrImageUrl = cancelUnpaid
        ? null
        : await publishPaymentQrImage(result.payment_qr)

    await syncOperationalState(conversationId, {
        displayName: options?.displayName,
        pipelineStage: result.pipeline_stage,
    })

    return { qrImageUrl }
}
