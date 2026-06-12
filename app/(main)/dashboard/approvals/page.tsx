import { Metadata } from "next"
import { redirect } from "next/navigation"
import { BadgeCheck } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import { reconcileStaleApprovalQueue } from "@/lib/approvals"
import { Badge } from "@/components/ui/badge"
import ApprovalsTable, { type ApprovalRow } from "./ApprovalsTable"
import DashboardLiveRefresh from "../DashboardLiveRefresh"

export const metadata: Metadata = {
    title: "ศูนย์อนุมัติส่วนลด",
    description: "ตรวจสอบและอนุมัติคำขอส่วนลดที่ผู้ช่วยขาย AI ส่งเข้ามา",
}

// Approvals reflect live brain state — never serve a stale cache.
export const dynamic = "force-dynamic"

export default async function ApprovalsPage() {
    const manager = await getManagerOrNull()
    if (!manager) redirect("/dashboard")

    await reconcileStaleApprovalQueue()

    const pending = await prisma.approvalRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
    })

    // Resolve a human-friendly customer name for each thread. There is no FK
    // from ApprovalRequest to Conversation/Customer, so we map by thread id.
    const threadIds = pending.map((p) => p.threadId)
    const conversations = await prisma.conversation.findMany({
        where: { id: { in: threadIds } },
        select: { id: true, title: true, customerId: true },
    })
    const convById = new Map(conversations.map((c) => [c.id, c]))

    const customerIds = conversations
        .map((c) => c.customerId)
        .filter((id): id is string => Boolean(id))
    const customers = customerIds.length
        ? await prisma.customer.findMany({
              where: { id: { in: customerIds } },
              select: { id: true, name: true },
          })
        : []
    const customerNameById = new Map(customers.map((c) => [c.id, c.name]))

    const rows: ApprovalRow[] = pending.map((p) => {
        const conv = convById.get(p.threadId)
        const customerName =
            (conv?.customerId && customerNameById.get(conv.customerId)) ||
            conv?.title ||
            `ลูกค้า #${p.threadId.slice(0, 6)}`
        return {
            id: p.id,
            threadId: p.threadId,
            customerName,
            product: p.product,
            discountPct: p.discountPct,
            reason: p.reason,
            originalPrice: p.originalPrice,
        }
    })

    return (
        <div className="flex flex-col gap-6">
            <DashboardLiveRefresh intervalMs={30000} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <BadgeCheck className="h-6 w-6 text-emerald-500" />
                        ศูนย์อนุมัติส่วนลด
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        ตรวจสอบคำขอส่วนลดที่เกินเกณฑ์อัตโนมัติ
                        ก่อนปล่อยให้ผู้ช่วยขาย AI ดำเนินการต่อ
                    </p>
                </div>
                <Badge variant="outline" className="gap-1.5">
                    รออนุมัติ
                    <span className="font-bold text-amber-600">{rows.length}</span>
                </Badge>
            </div>

            <ApprovalsTable rows={rows} />
        </div>
    )
}
