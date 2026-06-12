import { Metadata } from "next"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import LeadsContent, { type LeadRow } from "./LeadsContent"

export const metadata: Metadata = {
    title: "จัดการลีด",
    description: "ติดตามและจัดการลีดทั้งหมดในระบบ",
}

export const dynamic = "force-dynamic"

function formatLeadDate(d: Date): string {
    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(d)
}

export default async function LeadsPage() {
    const manager = await getManagerOrNull()
    if (!manager) redirect("/dashboard")

    const rows = await prisma.lead.findMany({
        orderBy: { createdAt: "desc" },
    })

    const leads: LeadRow[] = rows.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone ?? "",
        email: l.email ?? undefined,
        lineId: l.lineId ?? undefined,
        source: l.source,
        status: l.status,
        budget: l.budget ?? undefined,
        note: l.note ?? undefined,
        assignedTo: l.assignedTo ?? undefined,
        createdAt: formatLeadDate(l.createdAt),
    }))

    return <LeadsContent leads={leads} />
}
