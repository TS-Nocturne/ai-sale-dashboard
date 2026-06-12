import { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isEmployeeOnly, parseRoles, topDashboardRole } from "@/lib/roles"
import { backfillMissingOperationalData } from "@/lib/operational-sync"
import { APP_TAGLINE } from "@/lib/brand"
import DashboardContent, {
    type DashboardData,
    type DashboardRole,
} from "./DashboardContent"
import DashboardLiveRefresh from "./DashboardLiveRefresh"

export const metadata: Metadata = {
    title: "Dashboard",
    description: APP_TAGLINE,
}

// The overview reflects live operational data — always render fresh.
export const dynamic = "force-dynamic"

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const SOURCE_LABELS: Record<string, string> = {
    FACEBOOK: "Facebook",
    LINE: "Line",
    INSTAGRAM: "Instagram",
    TIKTOK: "TikTok",
    REFERRAL: "แนะนำ",
    WEBSITE: "Website",
    COLD_CALL: "Cold Call",
    OTHER: "อื่นๆ",
}

/** Resolve the highest-privilege role for view selection. */
function topRole(roles: string[]): "admin" | "manager" | "user" {
    const r = topDashboardRole(roles)
    return r === "employee" ? "user" : r
}

async function loadDashboardData(role: DashboardRole): Promise<DashboardData> {
    const now = new Date()
    const today = startOfDay(now)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const isStaff = role === "manager" || role === "admin"

    // Shared queries (all roles).
    const [
        totalLeads,
        newLeadsToday,
        newLeadsYesterday,
        wonLeads,
        leadsByStatusRaw,
        leadsBySourceRaw,
        recentLeadsRaw,
        customerCount,
        conversationCount,
        lineConversationCount,
        pausedChats,
        pendingApprovals,
        openOrders,
        awaitingPaymentOrders,
        paidOrders,
        totalOrders,
    ] = await Promise.all([
        prisma.lead.count(),
        prisma.lead.count({ where: { createdAt: { gte: today } } }),
        prisma.lead.count({
            where: { createdAt: { gte: yesterday, lt: today } },
        }),
        prisma.lead.count({ where: { status: "WON" } }),
        prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.lead.groupBy({ by: ["source"], _count: { _all: true } }),
        prisma.lead.findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
                id: true,
                name: true,
                phone: true,
                source: true,
                status: true,
                budget: true,
                createdAt: true,
            },
        }),
        prisma.customer.count(),
        prisma.conversation.count(),
        prisma.conversation.count({ where: { id: { startsWith: "line:" } } }),
        prisma.chatThread.count({ where: { botStatus: "PAUSED_FOR_HUMAN" } }),
        prisma.approvalRequest.count({ where: { status: "PENDING" } }),
        prisma.order.count({
            where: { status: { in: ["COLLECTING", "PENDING_FULFILLMENT"] } },
        }),
        prisma.order.count({
            where: {
                status: { notIn: ["SHIPPED", "CANCELLED"] },
                paymentStatus: { in: ["PENDING", "PARTIAL_PAID"] },
            },
        }),
        prisma.order.count({ where: { paymentStatus: "PAID" } }),
        prisma.order.count(),
    ])

    // Manager/Admin financials.
    let revenueThisMonth = 0
    let revenuePrevMonth = 0
    let totalRevenue = 0
    let salesCount = 0
    let monthly: DashboardData["monthly"] = []

    if (isStaff) {
        await backfillMissingOperationalData(30)
        const [thisMonthAgg, prevMonthAgg, totalAgg, recentSales] =
            await Promise.all([
                prisma.sale.aggregate({
                    _sum: { netAmount: true },
                    where: {
                        soldAt: { gte: startOfMonth },
                        status: { in: ["CONFIRMED", "DELIVERED"] },
                    },
                }),
                prisma.sale.aggregate({
                    _sum: { netAmount: true },
                    where: {
                        soldAt: { gte: startOfPrevMonth, lt: startOfMonth },
                        status: { in: ["CONFIRMED", "DELIVERED"] },
                    },
                }),
                prisma.sale.aggregate({
                    _sum: { netAmount: true },
                    _count: { _all: true },
                    where: { status: { in: ["CONFIRMED", "DELIVERED"] } },
                }),
                prisma.sale.findMany({
                    where: {
                        soldAt: { gte: sixMonthsAgo },
                        status: { in: ["CONFIRMED", "DELIVERED"] },
                    },
                    select: { netAmount: true, soldAt: true },
                }),
            ])

        revenueThisMonth = thisMonthAgg._sum.netAmount ?? 0
        revenuePrevMonth = prevMonthAgg._sum.netAmount ?? 0
        totalRevenue = totalAgg._sum.netAmount ?? 0
        salesCount = totalAgg._count._all

        // Build 6 monthly buckets for revenue, and leads created per month.
        const leadsInRange = await prisma.lead.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true },
        })

        const monthFmt = new Intl.DateTimeFormat("th-TH", { month: "short" })
        const buckets = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
            return { key: `${d.getFullYear()}-${d.getMonth()}`, label: monthFmt.format(d), revenue: 0, leads: 0 }
        })
        const byKey = new Map(buckets.map((b) => [b.key, b]))
        for (const s of recentSales) {
            const k = `${s.soldAt.getFullYear()}-${s.soldAt.getMonth()}`
            const b = byKey.get(k)
            if (b) b.revenue += s.netAmount
        }
        for (const l of leadsInRange) {
            const k = `${l.createdAt.getFullYear()}-${l.createdAt.getMonth()}`
            const b = byKey.get(k)
            if (b) b.leads += 1
        }
        monthly = buckets.map(({ label, revenue, leads }) => ({ month: label, revenue, leads }))
    }

    // Admin-only: total platform users.
    const userCount = role === "admin" ? await prisma.user.count() : 0

    const dateFmt = new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
    })

    return {
        totalLeads,
        newLeadsToday,
        newLeadsYesterday,
        wonLeads,
        closeRate: totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0,
        customerCount,
        conversationCount,
        lineConversationCount,
        pausedChats,
        pendingApprovals,
        openOrders,
        awaitingPaymentOrders,
        paidOrders,
        totalOrders,
        userCount,
        revenueThisMonth,
        revenuePrevMonth,
        totalRevenue,
        salesCount,
        leadsByStatus: leadsByStatusRaw.map((r) => ({
            status: r.status,
            count: r._count._all,
        })),
        leadsBySource: leadsBySourceRaw
            .map((r) => ({
                source: r.source,
                label: SOURCE_LABELS[r.source] ?? r.source,
                count: r._count._all,
            }))
            .sort((a, b) => b.count - a.count),
        monthly,
        recentLeads: recentLeadsRaw.map((l) => ({
            id: l.id,
            name: l.name,
            phone: l.phone ?? "",
            source: l.source,
            status: l.status,
            budget: l.budget ?? 0,
            createdAt: dateFmt.format(l.createdAt),
        })),
    }
}

export default async function DashboardPage() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) redirect("/auth/signin")

    const roles = parseRoles(session.user.role)
    if (isEmployeeOnly(roles)) redirect("/dashboard/chat")

    const role = topRole(roles)
    const data = await loadDashboardData(role)

    return (
        <>
            <DashboardLiveRefresh />
            <DashboardContent
                role={role}
                userName={session.user.name ?? "ผู้ใช้งาน"}
                data={data}
            />
        </>
    )
}
