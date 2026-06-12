import { Metadata } from "next"
import { redirect } from "next/navigation"
import { Package } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import { Badge } from "@/components/ui/badge"
import OrdersTable, { type OrderRow } from "./OrdersTable"

export const metadata: Metadata = {
    title: "คำสั่งซื้อ",
    description: "จัดการออเดอร์ที่รอชำระเงิน และออเดอร์ที่พร้อมแพ็ค/จัดส่ง",
}

// Orders reflect live fulfillment state — never serve a stale cache.
export const dynamic = "force-dynamic"

type OrdersTab = "fulfillment" | "payment"

export default async function OrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>
}) {
    const manager = await getManagerOrNull()
    if (!manager) redirect("/dashboard")

    const { tab: tabParam } = await searchParams
    const initialTab: OrdersTab = tabParam === "payment" ? "payment" : "fulfillment"

    const orders = await prisma.order.findMany({
        where: {
            status: { not: "CANCELLED" },
            paymentStatus: { not: "CANCELLED" },
            OR: [
                { status: { in: ["PENDING_FULFILLMENT", "SHIPPED"] } },
                { paymentStatus: "PENDING_REFUND" },
                {
                    status: "COLLECTING",
                    paymentStatus: { in: ["PENDING", "PARTIAL_PAID"] },
                },
                {
                    status: "PENDING_FULFILLMENT",
                    paymentStatus: { in: ["PENDING", "PARTIAL_PAID"] },
                },
            ],
        },
        orderBy: [{ paymentStatus: "desc" }, { status: "asc" }, { createdAt: "desc" }],
    })

    const rows: OrderRow[] = orders.map((o) => ({
        id: o.id,
        customerName: o.customerName,
        phone: o.phone,
        address: o.address,
        postalCode: o.postalCode,
        paymentMethod: o.paymentMethod,
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount,
        amount: o.amount,
        items: o.items,
        slipVerified: o.slipVerified,
        slipImageUrl: o.slipImageUrl,
        paymentStatus: o.paymentStatus,
        overpaidAmount: o.overpaidAmount,
        status: o.status,
        trackingNumber: o.trackingNumber,
        createdAt: o.createdAt.toISOString(),
    }))

    const pendingCount = rows.filter((r) => r.status === "PENDING_FULFILLMENT").length
    const awaitingPaymentCount = rows.filter(
        (r) =>
            (r.paymentStatus === "PENDING" || r.paymentStatus === "PARTIAL_PAID") &&
            r.status !== "SHIPPED" &&
            r.status !== "CANCELLED"
    ).length

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <Package className="h-6 w-6 text-indigo-500" />
                        คำสั่งซื้อ
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        จัดการออเดอร์ที่รอชำระเงิน และออเดอร์ที่พร้อมแพ็ค/จัดส่ง
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1.5">
                        รอชำระเงิน
                        <span className="font-bold text-red-600">{awaitingPaymentCount}</span>
                    </Badge>
                    <Badge variant="outline" className="gap-1.5">
                        รอแพ็คของ
                        <span className="font-bold text-amber-600">{pendingCount}</span>
                    </Badge>
                </div>
            </div>

            <OrdersTable rows={rows} initialTab={initialTab} />
        </div>
    )
}
