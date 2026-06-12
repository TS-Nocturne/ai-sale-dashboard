import "server-only"

import { prisma } from "@/lib/prisma"
import type { AgentResponse } from "@/lib/ai-service"

/**
 * Materialise an Order from the brain's structured shipping output.
 *
 * The Python brain extracts the customer's shipping details (name / phone /
 * address / postal code + payment method) via the `save_shipping_info`
 * structured tool and flags `order_ready`. The brain has no database access,
 * so the Next.js side persists it as an `Order` for staff to pack & ship.
 *
 * Call this after every brain reply (dashboard chat + LINE webhook). It is
 * idempotent per thread: while an order is still being fulfilled it updates the
 * existing row instead of creating duplicates.
 */
export async function syncOrder(
    threadId: string,
    result: Pick<AgentResponse, "order_ready" | "shipping_info">
): Promise<void> {
    if (!result.order_ready || !result.shipping_info) return

    const s = result.shipping_info
    const customerName = (s.customer_name ?? "").trim()
    const phone = (s.phone ?? "").trim()
    const address = (s.address ?? "").trim()

    // Need at least a name + address to be useful to staff.
    if (!customerName || !address) return

    const paymentMethod = (s.payment_method ?? "TRANSFER").toUpperCase() === "COD"
        ? "COD"
        : "TRANSFER"

    const data: {
        customerName: string
        phone: string
        address: string
        postalCode: string | null
        paymentMethod: "TRANSFER" | "COD"
        items: string | null
        amount?: number
    } = {
        customerName,
        phone,
        address,
        postalCode: (s.postal_code ?? "").trim() || null,
        paymentMethod: paymentMethod as "TRANSFER" | "COD",
        items: (s.items ?? "").trim() || null,
    }
    // Only set amount when the AI actually captured one — otherwise leave any
    // amount already taken from the verified slip untouched.
    if (typeof s.amount === "number" && s.amount > 0) {
        data.amount = s.amount
    }

    // Reuse the open order for this thread (not yet shipped/cancelled) so the
    // customer correcting their address updates the same row.
    const open = await prisma.order.findFirst({
        where: { threadId, status: { in: ["COLLECTING", "PENDING_FULFILLMENT"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
    })

    if (open) {
        await prisma.order.update({
            where: { id: open.id },
            data: { ...data, status: "PENDING_FULFILLMENT" },
        })
        return
    }

    await prisma.order.create({
        data: { threadId, ...data, status: "PENDING_FULFILLMENT" },
    })
}
