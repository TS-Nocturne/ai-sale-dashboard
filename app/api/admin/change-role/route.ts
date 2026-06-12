import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const VALID_ROLES = ["user", "employee", "manager", "admin"]

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin") {
        return NextResponse.json(
            { error: "Forbidden: Admin access required" },
            { status: 403 }
        )
    }

    const { userId, newRole } = await request.json()

    if (!userId || !newRole) {
        return NextResponse.json(
            { error: "Missing userId or newRole" },
            { status: 400 }
        )
    }

    if (!VALID_ROLES.includes(newRole)) {
        return NextResponse.json(
            { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
            { status: 400 }
        )
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role: newRole },
        })

        return NextResponse.json({
            message: `Role updated to ${newRole}`,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
            },
        })
    } catch {
        return NextResponse.json(
            { error: "User not found or update failed" },
            { status: 404 }
        )
    }
}
