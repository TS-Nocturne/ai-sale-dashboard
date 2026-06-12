import "server-only"

import { prisma } from "@/lib/prisma"
import type { AgentResponse } from "@/lib/ai-service"
import type { ApprovalAction, Prisma } from "@/app/generated/prisma/client"

type PendingDiscount = NonNullable<AgentResponse["pending_discount_approval"]>

/**
 * Keep the manager approval queue (`ApprovalRequest`) in sync with the brain.
 *
 * The Python brain signals a pending discount via `requires_approval` +
 * `pending_discount_approval` when the LangGraph run interrupts at the
 * human-approval node. The brain has no database access, so the Next.js side
 * must materialise that into an `ApprovalRequest` row for the approvals page.
 *
 * Call this after every brain reply (dashboard chat + LINE webhook). It is
 * idempotent and also clears stale PENDING rows once the brain no longer waits.
 */
export async function syncApprovalQueue(
    threadId: string,
    result: Pick<AgentResponse, "requires_approval" | "pending_discount_approval">
): Promise<void> {
    if (!result.requires_approval) {
        await closeStalePendingApprovals(threadId)
        return
    }

    if (!result.pending_discount_approval) return

    const pending = result.pending_discount_approval

    await prisma.chatThread.upsert({
        where: { id: threadId },
        update: {},
        create: { id: threadId },
    })

    const data = {
        product: pending.product?.trim() || "ไม่ระบุสินค้า",
        discountPct: pending.discount_pct ?? 0,
        originalPrice: pending.original_price ?? null,
        reason: pending.reason ?? null,
    }

    const existing = await prisma.approvalRequest.findFirst({
        where: { threadId, status: "PENDING" },
        select: { id: true },
    })

    if (existing) {
        await prisma.approvalRequest.update({
            where: { id: existing.id },
            data,
        })
        return
    }

    await prisma.approvalRequest.create({
        data: { threadId, ...data },
    })
}

/** Mark open PENDING rows resolved after a manager decision (any entry point). */
export async function resolvePendingApprovalForThread(
    threadId: string,
    action: "approve" | "reject",
    decidedBy: string
): Promise<void> {
    await prisma.approvalRequest.updateMany({
        where: { threadId, status: "PENDING" },
        data: {
            status: action === "approve" ? "APPROVED" : "REJECTED",
            decidedBy,
            decidedAt: new Date(),
        },
    })
}

/** Backfill queue state on page load — fixes rows left PENDING after assistant approval. */
export async function reconcileStaleApprovalQueue(limit = 50): Promise<void> {
    const open = await prisma.approvalRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { threadId: true },
    })

    const threadIds = [...new Set(open.map((r) => r.threadId))]
    if (threadIds.length === 0) return

    const conversations = await prisma.conversation.findMany({
        where: { id: { in: threadIds } },
        select: { id: true, awaitingApproval: true },
    })
    const awaitingByThread = new Map(conversations.map((c) => [c.id, c.awaitingApproval]))

    for (const threadId of threadIds) {
        if (awaitingByThread.get(threadId) === false) {
            await closeStalePendingApprovals(threadId)
        }
    }
}

async function closeStalePendingApprovals(threadId: string): Promise<void> {
    const pendingCount = await prisma.approvalRequest.count({
        where: { threadId, status: "PENDING" },
    })
    if (pendingCount === 0) return

    const status = await inferResolvedApprovalStatus(threadId)
    if (!status) return

    await prisma.approvalRequest.updateMany({
        where: { threadId, status: "PENDING" },
        data: { status, decidedAt: new Date() },
    })
}

async function inferResolvedApprovalStatus(
    threadId: string
): Promise<Exclude<ApprovalAction, "PENDING"> | null> {
    const recentMessages = await prisma.message.findMany({
        where: { conversationId: threadId, role: "ASSISTANT" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { content: true, metadata: true },
    })

    for (const msg of recentMessages) {
        const meta = msg.metadata as Prisma.JsonObject | null
        const decision = typeof meta?.decision === "string" ? meta.decision : null
        if (decision === "approve" || decision === "approved") return "APPROVED"
        if (decision === "reject" || decision === "rejected") return "REJECTED"
    }

    for (const msg of recentMessages) {
        const text = msg.content ?? ""
        if (text.includes("ผู้จัดการอนุมัติส่วนลดพิเศษให้แล้ว")) return "APPROVED"
        if (text.includes("ยังไม่สามารถให้ส่วนลด")) return "REJECTED"
    }

    const conversation = await prisma.conversation.findUnique({
        where: { id: threadId },
        select: { awaitingApproval: true },
    })
    if (conversation && !conversation.awaitingApproval) {
        // Brain moved on but we have no decision trail — drop from the live queue.
        return "REJECTED"
    }

    return null
}

export function finalPriceFromPending(pending: PendingDiscount): number | null {
    const original = pending.original_price ?? 0
    const pct = pending.discount_pct ?? 0
    if (original <= 0) return null
    return Math.round(original * (1 - pct / 100) * 100) / 100
}
