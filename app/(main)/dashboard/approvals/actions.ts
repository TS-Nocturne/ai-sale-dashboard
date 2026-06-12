"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import { decideDiscountApproval, AIServiceError } from "@/lib/ai-service"
import {
    finalPriceFromPending,
    syncApprovalQueue,
} from "@/lib/approvals"
import { revalidateOperationalPages } from "@/lib/operational-sync"
import { stageOrderPaymentTotal } from "@/lib/payments"
import { isLineThread, lineTargetFromThreadId, pushLineText } from "@/lib/line"
import type { Prisma } from "@/app/generated/prisma/client"

export interface DecisionResult {
    ok: boolean
    message: string
}

/**
 * Approve or reject a pending discount request.
 *
 * Flow:
 *  1. Forward the decision to the Python brain (`POST /api/ai/v1/approve`),
 *     which resumes the interrupted LangGraph run.
 *  2. Persist the outcome on the ApprovalRequest + Conversation rows.
 *  3. Revalidate the approvals page so the row disappears from the queue.
 *
 * Returns a `{ ok, message }` payload that the client turns into a toast.
 */
export async function decideApproval(
    approvalId: string,
    threadId: string,
    action: "approve" | "reject"
): Promise<DecisionResult> {
    const manager = await getManagerOrNull()
    if (!manager) {
        return {
            ok: false,
            message: "คุณไม่มีสิทธิ์อนุมัติส่วนลด (ต้องเป็นผู้จัดการหรือผู้ดูแลระบบ)",
        }
    }

    try {
        const result = await decideDiscountApproval(threadId, action)

        // Persist the manager's decision and the brain's resumed reply.
        await prisma.$transaction(async (tx) => {
            await tx.approvalRequest.update({
                where: { id: approvalId },
                data: {
                    status: action === "approve" ? "APPROVED" : "REJECTED",
                    decidedBy: manager.id,
                    decidedAt: new Date(),
                },
            })
            await tx.approvalRequest.updateMany({
                where: {
                    threadId,
                    status: "PENDING",
                    id: { not: approvalId },
                },
                data: {
                    status: action === "approve" ? "APPROVED" : "REJECTED",
                    decidedBy: manager.id,
                    decidedAt: new Date(),
                },
            })

            await tx.conversation.update({
                where: { id: threadId },
                data: {
                    awaitingApproval: result.requires_approval,
                    leadScore: result.lead_score,
                    pipelineStage: result.pipeline_stage,
                },
            })

            if (result.reply) {
                await tx.message.create({
                    data: {
                        conversationId: threadId,
                        role: "ASSISTANT",
                        content: result.reply,
                        metadata: {
                            decision: action,
                            decidedBy: manager.id,
                        } as Prisma.InputJsonValue,
                    },
                })
            }
        })

        await syncApprovalQueue(threadId, result)

        if (action === "approve" && result.payment_qr?.amount && result.payment_qr.amount > 0) {
            await stageOrderPaymentTotal(
                threadId,
                result.payment_qr.amount,
                result.payment_qr.items
            )
        } else if (action === "approve" && result.pending_discount_approval) {
            const finalPrice = finalPriceFromPending(result.pending_discount_approval)
            if (finalPrice && finalPrice > 0) {
                await stageOrderPaymentTotal(
                    threadId,
                    finalPrice,
                    result.pending_discount_approval.product
                )
            }
        }

        revalidatePath("/dashboard/approvals")
        revalidateOperationalPages()

        // แจ้งผลการอนุมัติกลับให้ลูกค้าทาง LINE — reply token หมดอายุแล้ว
        // จึงต้องใช้ Push Message API (ไม่ใช่ reply)
        let pushedToLine = false
        if (result.reply && isLineThread(threadId)) {
            const target = lineTargetFromThreadId(threadId)
            if (target) {
                pushedToLine = await pushLineText(target, result.reply)
            }
        }

        const baseMessage =
            action === "approve"
                ? "อนุมัติส่วนลดเรียบร้อยแล้ว ✅"
                : "ปฏิเสธคำขอส่วนลดเรียบร้อยแล้ว ❌"

        return {
            ok: true,
            message: pushedToLine
                ? `${baseMessage} (แจ้งลูกค้าทาง LINE แล้ว)`
                : baseMessage,
        }
    } catch (error) {
        const message =
            error instanceof AIServiceError
                ? error.message
                : "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง"
        return { ok: false, message }
    }
}
