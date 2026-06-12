import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveAvatarContentType, saveUserAvatar } from "@/lib/uploads"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
    }

    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "กรุณาเลือกรูปภาพ" }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 2MB" }, { status: 400 })
    }

    const contentType = resolveAvatarContentType(file)
    if (!contentType) {
        return NextResponse.json(
            { error: "รองรับเฉพาะ PNG, JPG หรือ WebP" },
            { status: 400 }
        )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const imageUrl = await saveUserAvatar(session.user.id, buffer, contentType)
    if (!imageUrl) {
        return NextResponse.json({ error: "บันทึกรูปไม่สำเร็จ" }, { status: 500 })
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data: { image: imageUrl },
    })

    return NextResponse.json({ ok: true, imageUrl })
}
