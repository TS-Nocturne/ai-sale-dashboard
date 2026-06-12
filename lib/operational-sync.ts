import "server-only"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { lineUserIdFromThreadId } from "@/lib/line"
import type { LeadStatus } from "@/app/generated/prisma/client"

const SALE_ORDER_NOTE_PREFIX = "LINE_ORDER:"

const LEAD_STATUS_RANK: Record<LeadStatus, number> = {
    NEW: 0,
    CONTACTED: 1,
    QUALIFIED: 2,
    PROPOSAL: 3,
    NEGOTIATION: 4,
    WON: 5,
    LOST: 5,
}

/** Invalidate SSR pages that show operational KPIs after background LINE/brain updates. */
export function revalidateOperationalPages(): void {
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/sales")
    revalidatePath("/dashboard/leads")
    revalidatePath("/dashboard/customers")
    revalidatePath("/dashboard/chat")
    revalidatePath("/dashboard/approvals")
}

function mapPipelineToLeadStatus(stage?: string | null): LeadStatus {
    switch ((stage ?? "new").toLowerCase()) {
        case "qualified":
            return "QUALIFIED"
        case "negotiation":
            return "NEGOTIATION"
        case "closed_won":
            return "WON"
        case "closed_lost":
            return "LOST"
        case "proposal":
            return "PROPOSAL"
        case "contacted":
            return "CONTACTED"
        default:
            return "NEW"
    }
}

function pickLeadStatus(current: LeadStatus, next: LeadStatus): LeadStatus {
    if (next === "WON" || next === "LOST") return next
    return LEAD_STATUS_RANK[next] >= LEAD_STATUS_RANK[current] ? next : current
}

/**
 * Mirror LINE / AI pipeline activity into the CRM Lead table so dashboard KPIs
 * (ลีด, ปิดการขาย, แหล่งที่มา) reflect real chat commerce — not only manual leads.
 */
export async function syncLeadFromThread(
    threadId: string,
    options?: {
        displayName?: string | null
        pipelineStage?: string | null
        paymentStatus?: "PAID" | "PARTIAL_PAID" | "PENDING" | "PENDING_REFUND"
        phone?: string | null
        budget?: number | null
    }
): Promise<void> {
    if (!threadId.startsWith("line:") && !lineUserIdFromThreadId(threadId)) {
        return
    }

    const lineUserId = lineUserIdFromThreadId(threadId)

    const [conversation, customer, openOrder] = await Promise.all([
        prisma.conversation.findUnique({
            where: { id: threadId },
            select: { title: true, pipelineStage: true },
        }),
        lineUserId
            ? prisma.customer.findUnique({
                  where: { lineUserId },
                  select: { id: true, name: true, phone: true },
              })
            : Promise.resolve(null),
        prisma.order.findFirst({
            where: { threadId },
            orderBy: { createdAt: "desc" },
            select: {
                totalAmount: true,
                paidAmount: true,
                amount: true,
                phone: true,
                paymentStatus: true,
            },
        }),
    ])

    const name =
        (options?.displayName ?? customer?.name ?? conversation?.title ?? "ลูกค้า LINE").trim() ||
        "ลูกค้า LINE"
    const phone = options?.phone ?? openOrder?.phone ?? customer?.phone ?? null
    const budget =
        options?.budget ??
        openOrder?.totalAmount ??
        openOrder?.amount ??
        (openOrder?.paidAmount && openOrder.paidAmount > 0 ? openOrder.paidAmount : null)

    const pay = options?.paymentStatus ?? openOrder?.paymentStatus
    let status = mapPipelineToLeadStatus(
        options?.pipelineStage ?? conversation?.pipelineStage
    )
    // Pipeline `closed_won` means the deal is agreed — not that money was received.
    if (status === "WON" && pay !== "PAID") {
        status = pay === "PARTIAL_PAID" ? "NEGOTIATION" : "PROPOSAL"
    }
    if (pay === "PAID") status = "WON"
    else if (pay === "PARTIAL_PAID" && status === "NEW") status = "NEGOTIATION"

    const existing = await prisma.lead.findFirst({
        where: lineUserId
            ? { OR: [{ lineId: lineUserId }, ...(customer?.id ? [{ customerId: customer.id }] : [])] }
            : customer?.id
              ? { customerId: customer.id }
              : { id: "__none__" },
        orderBy: { updatedAt: "desc" },
    })

    if (existing) {
        const nextStatus = pickLeadStatus(existing.status, status)
        await prisma.lead.update({
            where: { id: existing.id },
            data: {
                name,
                phone: phone ?? existing.phone,
                source: "LINE",
                status: nextStatus,
                budget: budget ?? existing.budget,
                customerId: customer?.id ?? existing.customerId,
                lineId: lineUserId ?? existing.lineId,
                closedAt:
                    nextStatus === "WON" && pay === "PAID"
                        ? existing.closedAt ?? new Date()
                        : null,
            },
        })
        return
    }

    await prisma.lead.create({
        data: {
            name,
            phone,
            lineId: lineUserId,
            source: "LINE",
            status,
            budget,
            customerId: customer?.id,
            closedAt: status === "WON" && pay === "PAID" ? new Date() : undefined,
        },
    })
}

function saleAmountsFromOrder(order: {
    totalAmount: number | null
    paidAmount: number
    amount: number | null
    paymentStatus: string
}): { gross: number; net: number; discount: number } | null {
    if (order.paymentStatus !== "PAID") return null

    // Revenue KPIs must reflect money actually received — never the quoted order total.
    const net = Math.round(order.paidAmount * 100) / 100
    if (net <= 0) return null

    const expected = order.totalAmount ?? order.amount ?? net
    const gross = expected > net ? expected : net
    const discount =
        gross > net ? Math.round((gross - net) * 100) / 100 : 0

    return { gross, net, discount }
}

function orderIdFromSaleNote(note: string | null | undefined): string | null {
    if (!note?.startsWith(SALE_ORDER_NOTE_PREFIX)) return null
    const id = note.slice(SALE_ORDER_NOTE_PREFIX.length).trim()
    return id || null
}

/** Drop revenue rows tied to orders that were never actually paid. */
export async function reconcileInvalidSales(): Promise<void> {
    const linked = await prisma.sale.findMany({
        where: { note: { startsWith: SALE_ORDER_NOTE_PREFIX } },
        select: { id: true, note: true },
    })

    for (const sale of linked) {
        const orderId = orderIdFromSaleNote(sale.note)
        if (!orderId) continue

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                paymentStatus: true,
                paidAmount: true,
                totalAmount: true,
                amount: true,
            },
        })

        if (
            !order ||
            order.paymentStatus !== "PAID" ||
            order.paidAmount <= 0
        ) {
            await prisma.sale.delete({ where: { id: sale.id } })
            continue
        }

        await syncSaleFromPaidOrder(orderId)
    }
}

/** Fix orders marked PAID without any verified slip amount. */
export async function reconcilePhantomPaidOrders(): Promise<void> {
    const phantoms = await prisma.order.findMany({
        where: {
            paymentStatus: "PAID",
            paidAmount: { lte: 0 },
            slips: { none: {} },
        },
        select: { id: true },
    })

    for (const order of phantoms) {
        await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: "PENDING" },
        })
        const noteKey = `${SALE_ORDER_NOTE_PREFIX}${order.id}`
        await prisma.sale.deleteMany({ where: { note: noteKey } })
    }
}

async function leadHasVerifiedPayment(lead: {
    customerId: string | null
    lineId: string | null
}): Promise<boolean> {
    if (lead.customerId) {
        const paid = await prisma.order.findFirst({
            where: {
                customerId: lead.customerId,
                paymentStatus: "PAID",
                paidAmount: { gt: 0 },
            },
            select: { id: true },
        })
        if (paid) return true
    }

    if (lead.lineId) {
        const paid = await prisma.order.findFirst({
            where: {
                threadId: `line:user:${lead.lineId}`,
                paymentStatus: "PAID",
                paidAmount: { gt: 0 },
            },
            select: { id: true },
        })
        if (paid) return true
    }

    return false
}

/** Downgrade leads marked WON before payment cleared. */
export async function reconcileWonLeadsWithoutPayment(limit = 100): Promise<void> {
    const wonLeads = await prisma.lead.findMany({
        where: { status: "WON" },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, customerId: true, lineId: true },
    })

    for (const lead of wonLeads) {
        if (await leadHasVerifiedPayment(lead)) continue

        await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "PROPOSAL", closedAt: null },
        })
    }
}

/** Create a Sale row once an order is fully paid — powers revenue KPIs on the dashboard. */
export async function syncSaleFromPaidOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { customer: { select: { id: true } } },
    })
    if (!order || order.paymentStatus !== "PAID" || order.paidAmount <= 0) return

    const amounts = saleAmountsFromOrder(order)
    if (!amounts) return

    const noteKey = `${SALE_ORDER_NOTE_PREFIX}${orderId}`
    const existing = await prisma.sale.findFirst({ where: { note: noteKey } })

    const lead = order.customerId
        ? await prisma.lead.findFirst({
              where: { customerId: order.customerId },
              orderBy: { updatedAt: "desc" },
          })
        : null

    if (existing) {
        if (
            Math.abs(existing.netAmount - amounts.net) > 0.01 ||
            Math.abs(existing.discount - amounts.discount) > 0.01
        ) {
            await prisma.sale.update({
                where: { id: existing.id },
                data: {
                    totalAmount: amounts.gross,
                    discount: amounts.discount,
                    netAmount: amounts.net,
                },
            })
        }
    } else {
        await prisma.sale.create({
            data: {
                customerId: order.customerId,
                leadId: lead?.id,
                status: "CONFIRMED",
                totalAmount: amounts.gross,
                discount: amounts.discount,
                netAmount: amounts.net,
                note: noteKey,
                soldBy: "AI Sale Bot",
            },
        })
    }

    if (lead && lead.status !== "WON") {
        await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "WON", closedAt: new Date() },
        })
    }
}

/** Backfill + reconcile CRM rows so KPIs match verified payments only. */
export async function backfillMissingOperationalData(limit = 30): Promise<void> {
    await reconcilePhantomPaidOrders()
    await reconcileInvalidSales()
    await reconcileWonLeadsWithoutPayment(limit * 3)

    const paidOrders = await prisma.order.findMany({
        where: { paymentStatus: "PAID", paidAmount: { gt: 0 } },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, threadId: true },
    })

    for (const order of paidOrders) {
        await syncSaleFromPaidOrder(order.id)
        await syncLeadFromThread(order.threadId, { paymentStatus: "PAID" })
    }
}

/** After payment / brain / slip side-effects, refresh CRM + dashboard cache. */
export async function syncOperationalState(
    threadId: string,
    options?: {
        orderId?: string
        displayName?: string | null
        pipelineStage?: string | null
        paymentStatus?: "PAID" | "PARTIAL_PAID" | "PENDING" | "PENDING_REFUND"
    }
): Promise<void> {
    if (options?.orderId) {
        await syncSaleFromPaidOrder(options.orderId)
    }
    await syncLeadFromThread(threadId, {
        displayName: options?.displayName,
        pipelineStage: options?.pipelineStage,
        paymentStatus: options?.paymentStatus,
    })
    revalidateOperationalPages()
}
