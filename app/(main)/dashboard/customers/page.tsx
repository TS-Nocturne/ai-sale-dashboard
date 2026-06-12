import { Metadata } from "next"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import CustomersContent, { type CustomerRow } from "./CustomersContent"

export const metadata: Metadata = {
    title: "ลูกค้า",
    description: "จัดการข้อมูลลูกค้าทั้งหมดในระบบ",
}

export const dynamic = "force-dynamic"

function formatDate(d: Date): string {
    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(d)
}

export default async function CustomersPage() {
    const manager = await getManagerOrNull()
    if (!manager) redirect("/dashboard")

    const rows = await prisma.customer.findMany({
        include: {
            sales: { select: { netAmount: true, soldAt: true, status: true } },
            orders: { select: { createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
    })

    const customers: CustomerRow[] = rows.map((c) => {
        const paidSales = c.sales.filter(
            (s) => s.status !== "CANCELLED" && s.status !== "REFUNDED"
        )
        const totalPurchased = paidSales.reduce((sum, s) => sum + s.netAmount, 0)
        const orderCount = c.orders.length
        const lastSale = paidSales.sort(
            (a, b) => b.soldAt.getTime() - a.soldAt.getTime()
        )[0]
        const lastOrder = c.orders.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0]
        const lastAt = lastSale?.soldAt ?? lastOrder?.createdAt

        return {
            id: c.id,
            name: c.name,
            phone: c.phone ?? undefined,
            email: c.email ?? undefined,
            lineId: c.lineId ?? undefined,
            totalPurchased,
            orderCount,
            lastOrderAt: lastAt ? formatDate(lastAt) : "—",
            createdAt: formatDate(c.createdAt),
        }
    })

    return <CustomersContent customers={customers} />
}
