import { Metadata } from "next"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import { backfillMissingOperationalData } from "@/lib/operational-sync"
import SalesContent, { type SaleRow } from "./SalesContent"

export const metadata: Metadata = {
    title: "การขาย",
    description: "ประวัติและสถานะการขายทั้งหมด",
}

export const dynamic = "force-dynamic"

function formatDate(d: Date): string {
    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(d)
}

export default async function SalesPage() {
    const manager = await getManagerOrNull()
    if (!manager) redirect("/dashboard")

    await backfillMissingOperationalData(50)

    const rows = await prisma.sale.findMany({
        include: {
            customer: { select: { name: true } },
            saleItems: {
                include: { product: { select: { name: true } } },
            },
        },
        orderBy: { soldAt: "desc" },
    })

    const sales: SaleRow[] = rows.map((s, index) => {
        const items =
            s.saleItems.length > 0
                ? s.saleItems
                      .map((item) => `${item.product.name} × ${item.qty}`)
                      .join(", ")
                : s.note ?? "—"

        return {
            id: s.id,
            orderNo: `SALE-${String(rows.length - index).padStart(4, "0")}`,
            customerName: s.customer?.name ?? "ลูกค้า",
            items,
            totalAmount: s.totalAmount,
            discount: s.discount,
            netAmount: s.netAmount,
            status: s.status,
            soldBy: s.soldBy ?? "—",
            soldAt: formatDate(s.soldAt),
        }
    })

    return <SalesContent sales={sales} />
}
