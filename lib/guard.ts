import "server-only"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
    hasHandoffAccess,
    hasManagerAccess,
    isEmployeeOnly,
    parseRoles,
} from "@/lib/roles"

export type { MANAGER_ROLES, HANDOFF_ROLES, EMPLOYEE_ROLE } from "@/lib/roles"
export { parseRoles, isEmployeeOnly, hasHandoffAccess, hasManagerAccess } from "@/lib/roles"

export interface SessionUser {
    id: string
    role: string
    roles: string[]
    isEmployeeOnly: boolean
}

function toSessionUser(session: { user: { id: string; role?: string | null } }): SessionUser {
    const roles = parseRoles(session.user.role)
    return {
        id: session.user.id,
        role: session.user.role ?? "user",
        roles,
        isEmployeeOnly: isEmployeeOnly(roles),
    }
}

export async function getManagerOrNull(): Promise<SessionUser | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return null

    const user = toSessionUser(session)
    if (!hasManagerAccess(user.roles)) return null

    return user
}

export async function getHandoffStaffOrNull(): Promise<SessionUser | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return null

    const user = toSessionUser(session)
    if (!hasHandoffAccess(user.roles)) return null

    return user
}

export async function assertHandoffThreadAccess(
    threadId: string,
    staff: SessionUser
): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!staff.isEmployeeOnly) return { ok: true }

    const thread = await prisma.chatThread.findUnique({
        where: { id: threadId },
        select: { botStatus: true },
    })

    if (thread?.botStatus !== "PAUSED_FOR_HUMAN") {
        return {
            ok: false,
            message: "คุณสามารถดูได้เฉพาะลูกค้าที่ต้องการเจ้าหน้าที่เท่านั้น",
        }
    }

    return { ok: true }
}
