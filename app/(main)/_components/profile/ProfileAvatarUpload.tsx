"use client"

import { useRef, useState, useEffect } from "react"
import { Loader2, Upload, CheckCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { authClient, useSession } from "@/lib/auth-client"

interface ProfileAvatarUploadProps {
    name: string
    image?: string | null
}

function withCacheBust(url: string): string {
    const base = url.split("?")[0]
    return `${base}?v=${Date.now()}`
}

export function ProfileAvatarUpload({ name, image }: ProfileAvatarUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const { refetch } = useSession()
    const [preview, setPreview] = useState<string | null>(image ? withCacheBust(image) : null)
    const [uploading, setUploading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState("")

    // Sync from session only when a new image URL arrives — never wipe a fresh local preview.
    useEffect(() => {
        if (!image) return
        const base = image.split("?")[0]
        setPreview((current) => {
            if (!current) return withCacheBust(image)
            if (current.split("?")[0] === base) return current
            return withCacheBust(image)
        })
    }, [image])

    const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)

    const handlePick = () => {
        setError("")
        setSuccess(false)
        inputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            setError("ไฟล์ใหญ่เกิน 2MB")
            return
        }

        setUploading(true)
        setError("")
        setSuccess(false)
        try {
            const formData = new FormData()
            formData.append("file", file)

            const res = await fetch("/api/profile/avatar", {
                method: "POST",
                body: formData,
                credentials: "include",
            })
            const data = (await res.json()) as { imageUrl?: string; error?: string }

            if (!res.ok) {
                setError(data.error || "อัปโหลดไม่สำเร็จ")
                return
            }

            if (data.imageUrl) {
                const busted = withCacheBust(data.imageUrl)
                setPreview(busted)

                // Sync better-auth session so header/menu avatar updates immediately.
                await authClient.updateUser({ image: data.imageUrl })
                await refetch()

                setSuccess(true)
                setTimeout(() => setSuccess(false), 3000)
            }
        } catch {
            setError("อัปโหลดไม่สำเร็จ กรุณาลองใหม่")
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-purple-200 dark:ring-purple-800">
                <AvatarImage src={preview ?? undefined} alt={name} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-lg text-white">
                    {initials}
                </AvatarFallback>
            </Avatar>
            <div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={uploading}
                    onClick={handlePick}
                >
                    {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WebP — ไม่เกิน 2MB</p>
                {success && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle className="h-3 w-3" />
                        อัปโหลดสำเร็จ
                    </p>
                )}
                {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            </div>
        </div>
    )
}
