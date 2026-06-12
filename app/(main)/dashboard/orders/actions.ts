"use server"

import { revalidatePath } from "next/cache"

import { confirmOverpayRefund as confirmOverpayRefundLib } from "@/lib/order-payments"
import { cancelAwaitingPaymentOrder as cancelAwaitingPaymentOrderLib } from "@/lib/order-cancel"
import { revalidateOperationalPages } from "@/lib/operational-sync"
import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import { isLineThread, lineTargetFromThreadId, pushLineText } from "@/lib/line"

export interface ShipResult {
    ok: boolean
    message: string
    trackingNumber?: string
}

export interface RefundResult {
    ok: boolean
    message: string
}

export interface CancelOrderResult {
    ok: boolean
    message: string
}

/** Generate a simple, human-readable tracking number. */
function makeTrackingNumber(): string {
    const stamp = Date.now().toString(36).toUpperCase()
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
    return `TH${stamp}${rand}`
}

/**
 * Confirm shipping for an order.
 *
 *  1. Generate a tracking number (if not already set).
 *  2. Flip the order to SHIPPED and record who/when.
 *  3. Proactively notify the customer of the tracking number over LINE.
 *
 * The "print label" part happens client-side; this action returns the tracking
 * number so the client can render the printable label.
 */
export async function confirmShipment(orderId: string): Promise<ShipResult> {
    const manager = await getManagerOrNull()
    if (!manager) {
        return {
            ok: false,
            message: "คุณไม่มีสิทธิ์ยืนยันการจัดส่ง (ต้องเป็นผู้จัดการหรือผู้ดูแลระบบ)",
        }
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
        return { ok: false, message: "ไม่พบออเดอร์นี้" }
    }
    if (order.status === "SHIPPED") {
        return {
            ok: true,
            message: "ออเดอร์นี้ถูกยืนยันการจัดส่งไปแล้ว",
            trackingNumber: order.trackingNumber ?? undefined,
        }
    }
    if (order.status === "COLLECTING") {
        return {
            ok: false,
            message: "ออเดอร์นี้ยังรอชำระเงิน ไม่สามารถจัดส่งได้จนกว่าจะชำระครบ",
        }
    }
    if (order.paymentStatus === "PENDING" || order.paymentStatus === "PARTIAL_PAID") {
        return {
            ok: false,
            message: "ออเดอร์นี้ยังชำระเงินไม่ครบ กรุณารอลูกค้าโอนเงินก่อนจัดส่ง",
        }
    }

    const trackingNumber = order.trackingNumber ?? makeTrackingNumber()

    await prisma.order.update({
        where: { id: orderId },
        data: {
            status: "SHIPPED",
            trackingNumber,
            shippedBy: manager.id,
            shippedAt: new Date(),
        },
    })

    revalidatePath("/dashboard/orders")
    revalidateOperationalPages()

    // แจ้งเลขพัสดุให้ลูกค้าทาง LINE อัตโนมัติ (ถ้าเป็นแชทจาก LINE)
    let notified = false
    if (isLineThread(order.threadId)) {
        const target = lineTargetFromThreadId(order.threadId)
        if (target) {
            const text =
                `จัดส่งพัสดุเรียบร้อยแล้วค่ะ 📦\n` +
                `คุณ ${order.customerName}\n` +
                `เลขพัสดุ: ${trackingNumber}\n` +
                `สามารถติดตามสถานะการจัดส่งได้เลยนะคะ ขอบคุณที่อุดหนุนค่ะ 🙏`
            notified = await pushLineText(target, text)
        }
    }

    return {
        ok: true,
        message: notified
            ? `ยืนยันการจัดส่งแล้ว และแจ้งเลขพัสดุให้ลูกค้าทาง LINE แล้ว 📦`
            : `ยืนยันการจัดส่งเรียบร้อยแล้ว 📦`,
        trackingNumber,
    }
}

/** Manager confirms overpaid refund was sent — marks order PAID and resumes bot. */
export async function confirmOverpayRefund(orderId: string): Promise<RefundResult> {
    const manager = await getManagerOrNull()
    if (!manager) {
        return {
            ok: false,
            message: "คุณไม่มีสิทธิ์ยืนยันการคืนเงิน (ต้องเป็นผู้จัดการหรือผู้ดูแลระบบ)",
        }
    }

    try {
        await confirmOverpayRefundLib(orderId, manager.id)
        revalidatePath("/dashboard/orders")
    revalidateOperationalPages()
        return { ok: true, message: "คืนเงินและยืนยันออเดอร์เรียบร้อยแล้ว ✅" }
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
        }
    }
}

/** Remove an unpaid order from the awaiting-payment queue (manager/admin). */
export async function cancelAwaitingPaymentOrder(
    orderId: string
): Promise<CancelOrderResult> {
    const manager = await getManagerOrNull()
    if (!manager) {
        return {
            ok: false,
            message: "คุณไม่มีสิทธิ์ยกเลิกออเดอร์ (ต้องเป็นผู้จัดการหรือผู้ดูแลระบบ)",
        }
    }

    return cancelAwaitingPaymentOrderLib(orderId)
}
