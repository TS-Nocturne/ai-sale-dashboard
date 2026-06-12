"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import {
    deleteKnowledge,
    indexKnowledgeFile,
    indexKnowledgeText,
    KnowledgeServiceError,
} from "@/lib/knowledge"

export interface KnowledgeDTO {
    id: string
    title: string
    content: string
    source: string | null
    fileType: string | null
    fileSize: number | null
    status: "PENDING" | "INDEXED" | "FAILED"
    chunkCount: number
    createdAt: string
    updatedAt: string
}

export interface ActionResult {
    ok: boolean
    message: string
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXT = ["pdf", "txt", "csv", "md"]


function toDTO(d: {
    id: string
    title: string
    content: string
    source: string | null
    fileType: string | null
    fileSize: number | null
    status: "PENDING" | "INDEXED" | "FAILED"
    chunkCount: number
    createdAt: Date
    updatedAt: Date
}): KnowledgeDTO {
    return {
        id: d.id,
        title: d.title,
        content: d.content,
        source: d.source,
        fileType: d.fileType,
        fileSize: d.fileSize,
        status: d.status,
        chunkCount: d.chunkCount,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
    }
}

export async function getKnowledgeDocuments(): Promise<KnowledgeDTO[]> {
    const manager = await getManagerOrNull()
    if (!manager) return []

    const docs = await prisma.knowledgeDocument.findMany({
        orderBy: { updatedAt: "desc" },
    })
    return docs.map(toDTO)
}

/** Create a manually-typed document and index its text into the vector DB. */
export async function createTextDocument(input: {
    title: string
    content: string
}): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์จัดการฐานความรู้" }

    const title = input.title?.trim()
    const content = input.content?.trim()
    if (!title || !content) {
        return { ok: false, message: "กรุณากรอกชื่อเอกสารและเนื้อหา" }
    }

    const doc = await prisma.knowledgeDocument.create({
        data: {
            title,
            content,
            fileType: "manual",
            createdBy: manager.id,
            status: "PENDING",
        },
    })

    return finalizeIndexing(doc.id, () => indexKnowledgeText(doc.id, title, content))
}

/** Upload a file (PDF/TXT/CSV/MD); the brain extracts + chunks + embeds it. */
export async function uploadKnowledgeFile(formData: FormData): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์จัดการฐานความรู้" }

    const file = formData.get("file")
    const title = String(formData.get("title") ?? "").trim()

    if (!(file instanceof File) || file.size === 0) {
        return { ok: false, message: "กรุณาเลือกไฟล์" }
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return { ok: false, message: "ไฟล์ใหญ่เกินไป (จำกัดที่ 10 MB)" }
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (!ALLOWED_EXT.includes(ext)) {
        return { ok: false, message: "รองรับเฉพาะไฟล์ .pdf .txt .csv .md" }
    }

    const docTitle = title || file.name
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64")

    const doc = await prisma.knowledgeDocument.create({
        data: {
            title: docTitle,
            content: "", // filled in after extraction
            source: file.name,
            fileType: ext,
            fileSize: file.size,
            createdBy: manager.id,
            status: "PENDING",
        },
    })

    return finalizeIndexing(doc.id, async () => {
        const res = await indexKnowledgeFile(doc.id, docTitle, file.name, base64)
        // Persist the extracted text for preview + future re-indexing.
        await prisma.knowledgeDocument.update({
            where: { id: doc.id },
            data: { content: (res.text ?? "").slice(0, 200_000) },
        })
        return { chunk_count: res.chunk_count }
    })
}

export async function reindexDocument(id: string): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์" }

    const doc = await prisma.knowledgeDocument.findUnique({ where: { id } })
    if (!doc) return { ok: false, message: "ไม่พบเอกสาร" }

    return finalizeIndexing(id, () => indexKnowledgeText(id, doc.title, doc.content))
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์" }

    // Best-effort vector cleanup; never block the DB delete on the brain.
    try {
        await deleteKnowledge(id)
    } catch (e) {
        console.error("[knowledge] delete vectors failed:", e)
    }

    await prisma.knowledgeDocument.delete({ where: { id } })
    revalidatePath("/admin/knowledge")
    return { ok: true, message: "ลบเอกสารและข้อมูลใน Vector DB แล้ว" }
}

/**
 * Run an indexing operation and reflect the outcome on the document row.
 * Marks INDEXED (with chunk count) on success, FAILED otherwise.
 */
async function finalizeIndexing(
    documentId: string,
    op: () => Promise<{ chunk_count: number }>
): Promise<ActionResult> {
    try {
        const { chunk_count } = await op()
        await prisma.knowledgeDocument.update({
            where: { id: documentId },
            data: { status: "INDEXED", chunkCount: chunk_count },
        })
        revalidatePath("/admin/knowledge")
        return {
            ok: true,
            message:
                chunk_count > 0
                    ? `เพิ่มเข้าฐานความรู้ AI แล้ว (${chunk_count} chunks)`
                    : "บันทึกเอกสารแล้ว แต่ไม่พบเนื้อหาที่จะ index",
        }
    } catch (e) {
        await prisma.knowledgeDocument.update({
            where: { id: documentId },
            data: { status: "FAILED" },
        })
        revalidatePath("/admin/knowledge")
        const message =
            e instanceof KnowledgeServiceError
                ? `บันทึกเอกสารแล้ว แต่ index เข้า Vector DB ไม่สำเร็จ: ${e.message}`
                : "บันทึกเอกสารแล้ว แต่ index ไม่สำเร็จ — ลองกด 'Index ใหม่' อีกครั้ง"
        return { ok: false, message }
    }
}
