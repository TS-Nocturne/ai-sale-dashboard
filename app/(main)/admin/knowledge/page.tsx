import { redirect } from "next/navigation"

import { getManagerOrNull } from "@/lib/guard"
import KnowledgeContent from "./KnowledgeContent"
import { getKnowledgeDocuments } from "./actions"

export const metadata = {
    title: "ฐานความรู้ AI",
    description: "จัดการเอกสารฐานความรู้สำหรับ AI (RAG)",
}

export default async function KnowledgePage() {
    const manager = await getManagerOrNull()
    if (!manager) redirect("/dashboard")

    const documents = await getKnowledgeDocuments()
    return <KnowledgeContent initialDocuments={documents} />
}
