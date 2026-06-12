import "server-only"

import { AI_SERVICE_URL, fetchBrain } from "@/lib/brain-client"

export class KnowledgeServiceError extends Error {
    constructor(
        message: string,
        public status: number
    ) {
        super(message)
        this.name = "KnowledgeServiceError"
    }
}

async function postBrain<T>(path: string, body: unknown): Promise<T> {
    let res: Response
    try {
        res = await fetchBrain(path, {
            method: "POST",
            body: JSON.stringify(body),
        })
    } catch {
        throw new KnowledgeServiceError(
            `เชื่อมต่อบริการ AI ไม่ได้ (${AI_SERVICE_URL}) — รัน 'python -m ai_sales serve' หรือยัง?`,
            503
        )
    }

    if (!res.ok) {
        let detail = `Knowledge service error (${res.status})`
        try {
            const data = (await res.json()) as { detail?: string }
            if (data?.detail) detail = data.detail
        } catch {
            // keep default
        }
        throw new KnowledgeServiceError(detail, res.status)
    }

    return (await res.json()) as T
}

/** Index a document's plain text (manual entry / re-index). */
export async function indexKnowledgeText(
    documentId: string,
    title: string,
    text: string
): Promise<{ chunk_count: number }> {
    return postBrain("/knowledge/index", { document_id: documentId, title, text })
}

/** Extract + index an uploaded file (PDF/TXT/CSV) by Base64. */
export async function indexKnowledgeFile(
    documentId: string,
    title: string,
    filename: string,
    contentBase64: string
): Promise<{ chunk_count: number; text: string }> {
    return postBrain("/knowledge/index-file", {
        document_id: documentId,
        title,
        filename,
        content_base64: contentBase64,
    })
}

/** Remove a document's vectors from Pinecone. */
export async function deleteKnowledge(documentId: string): Promise<{ deleted: number }> {
    return postBrain("/knowledge/delete", { document_id: documentId })
}
