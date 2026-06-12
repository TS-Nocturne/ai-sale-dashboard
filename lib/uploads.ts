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

const AVATAR_SUBDIR = path.join("uploads", "avatars")
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const

/** Normalize browser-reported MIME or infer from filename extension. */
export function resolveAvatarContentType(file: { type: string; name: string }): string | null {
    const type = file.type.toLowerCase()
    if (AVATAR_ALLOWED_TYPES.includes(type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
        return type === "image/jpg" ? "image/jpeg" : type
    }
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
    if (ext === "png") return "image/png"
    if (ext === "webp") return "image/webp"
    return null
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

function publicUrl(subdir: string, filename: string): string {
    return `/${subdir.split(path.sep).join("/")}/${filename}`
}

/**
 * Save a user avatar under /public/uploads/avatars and return its public URL.
 */
export async function saveUserAvatar(
    userId: string,
    buffer: Buffer,
    contentType: string
): Promise<string | null> {
    if (buffer.length > MAX_AVATAR_BYTES) return null
    const normalized = contentType.toLowerCase() === "image/jpg" ? "image/jpeg" : contentType.toLowerCase()
    if (!["image/jpeg", "image/png", "image/webp"].includes(normalized)) {
        return null
    }

    try {
        const ext = EXT_BY_TYPE[normalized] ?? "jpg"
        const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "user"
        const filename = `${safeId}-${crypto.randomBytes(8).toString("hex")}.${ext}`
        const dir = path.join(process.cwd(), "public", AVATAR_SUBDIR)
        await mkdir(dir, { recursive: true })
        await writeFile(path.join(dir, filename), buffer)
        return publicUrl(AVATAR_SUBDIR, filename)
    } catch (error) {
        console.error("[uploads] saveUserAvatar failed:", error)
        return null
    }
}
