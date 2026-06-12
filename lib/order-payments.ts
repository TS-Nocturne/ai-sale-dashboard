import "server-only"

import {
    syncOperationalState,
} from "@/lib/operational-sync"
import { prisma } from "@/lib/prisma"
import { lineUserIdFromThreadId } from "@/lib/line"

const AMOUNT_TOLERANCE = 0.01

export function amountsMatch(a: number, b: number): boolean {
    return Math.abs(a - b) <= AMOUNT_TOLERANCE
}

/** Upsert a CRM customer row keyed by LINE user id (for store credit wallet). */
export async function ensureChatCustomer(
    threadId: string,
    displayName?: string | null
): Promise<string | null> {
    const lineUserId = lineUserIdFromThreadId(threadId)
    if (!lineUserId) return null

    const existing = await prisma.customer.findUnique({
        where: { lineUserId },
        select: { id: true },
    })
    if (existing) return existing.id

    const created = await prisma.customer.create({
        data: {
            name: (displayName ?? "ลูกค้า LINE").trim() || "ลูกค้า LINE",
            lineUserId,
            lineId: lineUserId,
        },
        select: { id: true },
    })
    return created.id
}

/** Link order to chat customer when we know the LINE user. */
export async function linkOrderToChatCustomer(
    orderId: string,
    threadId: string,
    displayName?: string | null
): Promise<void> {
    const customerId = await ensureChatCustomer(threadId, displayName)
    if (!customerId) return
    await prisma.order.update({
        where: { id: orderId },
        data: { customerId },
    })
}

export type ReconcileResult =
    | {
          kind: "PAID"
          orderId: string
          totalAmount: number
          paidAmount: number
          actualAmount: number
      }
    | {
          kind: "PARTIAL_PAID"
          orderId: string
          totalAmount: number
          paidAmount: number
          actualAmount: number
          missingAmount: number
      }
    | {
          kind: "OVERPAID"
          orderId: string
          totalAmount: number
          paidAmount: number
          actualAmount: number
          overpaidAmount: number
      }
    | {
          kind: "NO_EXPECTED_TOTAL"
          orderId: string
          actualAmount: number
          paidAmount: number
      }

/**
 * Apply a verified slip amount to an order — no strict eq check with Slip2Go.
 * Compares actual transfer vs our expected total in application code.
 */
export async function reconcileSlipPayment(
    orderId: string,
    actualAmount: number,
    slip: { imageUrl: string | null; referenceId: string | null }
): Promise<ReconcileResult> {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
        throw new Error("order not found")
    }

    const newPaid = Math.round((order.paidAmount + actualAmount) * 100) / 100

    await prisma.paymentSlip.create({
        data: {
            orderId,
            amount: actualAmount,
            imageUrl: slip.imageUrl,
            referenceId: slip.referenceId,
            isVerified: true,
        },
    })

    const totalAmount =
        order.totalAmount ?? order.amount ?? null

    const baseUpdate = {
        paidAmount: newPaid,
        slipVerified: true,
        slipReferenceId: slip.referenceId ?? order.slipReferenceId,
        slipImageUrl: slip.imageUrl ?? order.slipImageUrl,
        amount: totalAmount ?? actualAmount,
    }

    if (totalAmount == null || totalAmount <= 0) {
        await prisma.order.update({
            where: { id: orderId },
            data: {
                ...baseUpdate,
                totalAmount: newPaid,
                paymentStatus: "PAID",
            },
        })
        await syncOperationalState(order.threadId, {
            orderId,
            paymentStatus: "PAID",
        })
        return {
            kind: "NO_EXPECTED_TOTAL",
            orderId,
            actualAmount,
            paidAmount: newPaid,
        }
    }

    if (amountsMatch(newPaid, totalAmount) || newPaid > totalAmount + AMOUNT_TOLERANCE) {
        const overpaid = Math.max(0, Math.round((newPaid - totalAmount) * 100) / 100)
        if (overpaid > AMOUNT_TOLERANCE) {
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    ...baseUpdate,
                    totalAmount,
                    paymentStatus: "PENDING_REFUND",
                    overpaidAmount: overpaid,
                    overpayResolution: "PENDING_REFUND",
                },
            })
            return {
                kind: "OVERPAID",
                orderId,
                totalAmount,
                paidAmount: newPaid,
                actualAmount,
                overpaidAmount: overpaid,
            }
        }

        await prisma.order.update({
            where: { id: orderId },
            data: {
                ...baseUpdate,
                totalAmount,
                paymentStatus: "PAID",
                overpaidAmount: 0,
            },
        })
        await syncOperationalState(order.threadId, {
            orderId,
            paymentStatus: "PAID",
        })
        return {
            kind: "PAID",
            orderId,
            totalAmount,
            paidAmount: newPaid,
            actualAmount,
        }
    }

    const missing = Math.round((totalAmount - newPaid) * 100) / 100
    await prisma.order.update({
        where: { id: orderId },
        data: {
            ...baseUpdate,
            totalAmount,
            paymentStatus: "PARTIAL_PAID",
        },
    })
    await syncOperationalState(order.threadId, {
        orderId,
        paymentStatus: "PARTIAL_PAID",
    })
    return {
        kind: "PARTIAL_PAID",
        orderId,
        totalAmount,
        paidAmount: newPaid,
        actualAmount,
        missingAmount: missing,
    }
}

/** Credit overpaid amount to the customer's wallet. */
export async function applyStoreCredit(
    customerId: string,
    amount: number
): Promise<number> {
    const updated = await prisma.customer.update({
        where: { id: customerId },
        data: { storeCredit: { increment: amount } },
        select: { storeCredit: true },
    })
    return updated.storeCredit
}

/** Apply brain overpay resolution to DB (credit wallet or pause for refund). */
export async function syncOverpayFromBrain(
    threadId: string,
    result: {
        overpay_resolution?: string | null
        overpay_credit_amount?: number
        awaiting_refund_approval?: boolean
    }
): Promise<void> {
    const resolution = result.overpay_resolution
    if (!resolution) return

    const order = await prisma.order.findFirst({
        where: {
            threadId,
            paymentStatus: { in: ["PENDING_REFUND", "PAID", "PARTIAL_PAID"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, customerId: true, overpaidAmount: true },
    })
    if (!order) return

    if (resolution === "KEPT_AS_CREDIT") {
        const credit = result.overpay_credit_amount ?? order.overpaidAmount
        if (order.customerId && credit > 0) {
            await applyStoreCredit(order.customerId, credit)
        }
        await prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: "PAID",
                overpayResolution: "KEPT_AS_CREDIT",
            },
        })
        return
    }

    if (resolution === "PENDING_REFUND" || result.awaiting_refund_approval) {
        await prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: "PENDING_REFUND",
                overpayResolution: "PENDING_REFUND",
            },
        })
        await prisma.chatThread.upsert({
            where: { id: threadId },
            create: {
                id: threadId,
                botStatus: "PAUSED_FOR_HUMAN",
                handoffReason: "รอผู้จัดการคืนเงินโอนเกิน",
                pausedAt: new Date(),
            },
            update: {
                botStatus: "PAUSED_FOR_HUMAN",
                handoffReason: "รอผู้จัดการคืนเงินโอนเกิน",
                pausedAt: new Date(),
            },
        })
    }
}

/** Manager confirms overpay refund completed — mark order paid and resume bot. */
export async function confirmOverpayRefund(orderId: string, managerId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new Error("ไม่พบออเดอร์")
    if (order.paymentStatus !== "PENDING_REFUND") {
        throw new Error("ออเดอร์นี้ไม่ได้อยู่ในสถานะรอคืนเงิน")
    }

    await prisma.$transaction([
        prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: "PAID",
                overpayResolution: "REFUNDED",
                note: `คืนเงินโอนเกินแล้วโดย ${managerId}`,
            },
        }),
        prisma.chatThread.update({
            where: { id: order.threadId },
            data: {
                botStatus: "ACTIVE",
                resumedAt: new Date(),
                handoffReason: null,
            },
        }),
    ])
}
