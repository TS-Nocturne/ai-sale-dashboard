import { Metadata } from "next"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { getHandoffStaffOrNull } from "@/lib/guard"
import ChatDashboard, { type ThreadSummary } from "./ChatDashboard"

export const metadata: Metadata = {
    title: "แชทสด & การส่งต่อเจ้าหน้าที่",
    description: "ติดตามบทสนทนาของบอทแบบเรียลไทม์ และเข้าดูแลลูกค้าด้วยตนเองเมื่อจำเป็น",
}

export const dynamic = "force-dynamic"

export default async function ChatDashboardPage() {
    const staff = await getHandoffStaffOrNull()
    if (!staff) redirect("/dashboard")

    const employeeView = staff.isEmployeeOnly

    // พนักงาน: เฉพาะ thread ที่ bot หยุดรอเจ้าหน้าที่
    const pausedThreads = await prisma.chatThread.findMany({
        where: { botStatus: "PAUSED_FOR_HUMAN" },
        orderBy: { pausedAt: "desc" },
        take: 50,
        select: { id: true, handoffReason: true, pausedAt: true },
    })

    if (employeeView) {
        if (pausedThreads.length === 0) {
            return (
                <ChatDashboard
                    threads={[]}
                    canResumeAi={false}
                    employeeView
                />
            )
        }

        const conversations = await prisma.conversation.findMany({
            where: { id: { in: pausedThreads.map((t) => t.id) } },
            select: {
                id: true,
                title: true,
                customerId: true,
                updatedAt: true,
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { content: true, createdAt: true },
                },
            },
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

        const threads: ThreadSummary[] = pausedThreads.map((t) => {
            const c = convById.get(t.id)
            const last = c?.messages[0]
            const customerName =
                (c?.customerId && customerNameById.get(c.customerId)) ||
                c?.title ||
                `ลูกค้า #${t.id.slice(0, 6)}`
            return {
                id: t.id,
                customerName,
                lastMessage: last?.content ?? "",
                lastAt: (last?.createdAt ?? t.pausedAt ?? c?.updatedAt ?? new Date()).toISOString(),
                botStatus: "PAUSED_FOR_HUMAN" as const,
                handoffReason: t.handoffReason,
            }
        })

        return (
            <ChatDashboard
                threads={threads}
                canResumeAi={false}
                employeeView
            />
        )
    }

    // ผู้จัดการ / admin: ดูบทสนทนาทั้งหมด
    const conversations = await prisma.conversation.findMany({
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
            id: true,
            title: true,
            customerId: true,
            updatedAt: true,
            messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { content: true, role: true, createdAt: true },
            },
        },
    })

    const ids = conversations.map((c) => c.id)
    const threadRows = ids.length
        ? await prisma.chatThread.findMany({
              where: { id: { in: ids } },
              select: { id: true, botStatus: true, handoffReason: true },
          })
        : []
    const statusById = new Map(threadRows.map((t) => [t.id, t]))

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

    const threads: ThreadSummary[] = conversations.map((c) => {
        const status = statusById.get(c.id)
        const last = c.messages[0]
        const customerName =
            (c.customerId && customerNameById.get(c.customerId)) ||
            c.title ||
            `ลูกค้า #${c.id.slice(0, 6)}`
        return {
            id: c.id,
            customerName,
            lastMessage: last?.content ?? "",
            lastAt: (last?.createdAt ?? c.updatedAt).toISOString(),
            botStatus:
                status?.botStatus === "PAUSED_FOR_HUMAN"
                    ? "PAUSED_FOR_HUMAN"
                    : "ACTIVE",
            handoffReason: status?.handoffReason ?? null,
        }
    })

    return (
        <ChatDashboard
            threads={threads}
            canResumeAi
            employeeView={false}
        />
    )
}
