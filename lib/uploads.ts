import "server-only"

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"

/**
 * Persist customer-sent images to disk so staff can view them later.
 *
 * LINE's message-content URL is short-lived and requires the channel token, so
 * we copy the bytes into the app's `public/uploads/chat` folder and store the
 * resulting public path on the Message. Filenames are random (never derived
 * from user input) to avoid path traversal.
 */

const UPLOAD_SUBDIR = path.join("uploads", "chat")

const EXT_BY_TYPE: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}

/**
 * Save an image buffer under /public/uploads/chat and return its public URL
 * (e.g. "/uploads/chat/ab12...jpg"), or null on failure.
 */
export async function saveCustomerImage(
    buffer: Buffer,
    contentType: string
): Promise<string | null> {
    try {
        const ext = EXT_BY_TYPE[contentType.toLowerCase()] ?? "jpg"
        const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`
        const dir = path.join(process.cwd(), "public", UPLOAD_SUBDIR)
        await mkdir(dir, { recursive: true })
        await writeFile(path.join(dir, filename), buffer)
        // Public URL uses forward slashes regardless of OS.
        return `/${UPLOAD_SUBDIR.split(path.sep).join("/")}/${filename}`
    } catch (error) {
        console.error("[uploads] saveCustomerImage failed:", error)
        return null
    }
}
