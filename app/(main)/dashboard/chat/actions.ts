"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import {
    assertHandoffThreadAccess,
    getHandoffStaffOrNull,
    getManagerOrNull,
} from "@/lib/guard"
import { isLineThread, lineTargetFromThreadId, pushLineText } from "@/lib/line"
import type { Prisma } from "@/app/generated/prisma/client"

export interface ActionResult {
    ok: boolean
    message: string
}

export interface StaffMessage {
    id: string
    role: "user" | "assistant"
    content: string
    createdAt: string
    fromStaff: boolean
    imageUrl: string | null
}

/** Load message history for a thread (handoff staff only). */
export async function getThreadMessages(threadId: string): Promise<StaffMessage[]> {
    const staff = await getHandoffStaffOrNull()
    if (!staff) return []

    const access = await assertHandoffThreadAccess(threadId, staff)
    if (!access.ok) return []

    const messages = await prisma.message.findMany({
        where: { conversationId: threadId },
        orderBy: { createdAt: "asc" },
    })

    return messages
        .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
        .map((m) => {
            const meta = (m.metadata ?? {}) as Record<string, unknown>
            return {
                id: m.id,
                role: m.role === "USER" ? "user" : "assistant",
                content: m.content,
                createdAt: m.createdAt.toISOString(),
                fromStaff: meta.sender === "staff",
                imageUrl: m.imageUrl ?? null,
            }
        })
}

export async function sendStaffMessage(
    threadId: string,
    content: string
): Promise<ActionResult & { created?: StaffMessage }> {
    const staff = await getHandoffStaffOrNull()
    if (!staff) {
        return { ok: false, message: "คุณไม่มีสิทธิ์ส่งข้อความถึงลูกค้า" }
    }

    const access = await assertHandoffThreadAccess(threadId, staff)
    if (!access.ok) {
        return { ok: false, message: access.message }
    }

    const text = content.trim()
    if (!text) {
        return { ok: false, message: "ข้อความว่างเปล่า" }
    }

    // ส่งข้อความจริงไปหาลูกค้าทาง LINE ก่อน (ใช้ Push API เพราะไม่มี reply token)
    // ถ้า push ไม่สำเร็จ อย่าบันทึกลง DB เพื่อไม่ให้เจ้าหน้าที่เข้าใจผิดว่าส่งแล้ว
    let deliveredToLine = false
    if (isLineThread(threadId)) {
        const target = lineTargetFromThreadId(threadId)
        if (!target) {
            return { ok: false, message: "ไม่พบปลายทาง LINE ของบทสนทนานี้" }
        }
        deliveredToLine = await pushLineText(target, text)
        if (!deliveredToLine) {
            return {
                ok: false,
                message:
                    "ส่งข้อความเข้า LINE ไม่สำเร็จ — ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN แล้วลองใหม่",
            }
        }
    }

    const created = await prisma.message.create({
        data: {
            conversationId: threadId,
            role: "ASSISTANT",
            content: text,
            metadata: {
                sender: "staff",
                staffId: staff.id,
                channel: isLineThread(threadId) ? "line" : undefined,
            } as Prisma.InputJsonValue,
        },
    })

    await prisma.conversation.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
    })

    revalidatePath("/dashboard/chat")

    return {
        ok: true,
        message: deliveredToLine ? "ส่งข้อความถึงลูกค้าทาง LINE แล้ว" : "ส่งข้อความถึงลูกค้าแล้ว",
        created: {
            id: created.id,
            role: "assistant",
            content: created.content,
            createdAt: created.createdAt.toISOString(),
            fromStaff: true,
            imageUrl: null,
        },
    }
}

/** เข้าดูแลเอง: หยุดบอทสำหรับ thread นี้ — manager/admin only. */
export async function pauseAiAgent(threadId: string): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) {
        return {
            ok: false,
            message: "เฉพาะผู้จัดการหรือผู้ดูแลระบบเท่านั้นที่สามารถเข้าดูแลแทนบอทได้",
        }
    }

    await prisma.chatThread.upsert({
        where: { id: threadId },
        update: {
            botStatus: "PAUSED_FOR_HUMAN",
            pausedAt: new Date(),
            handoffReason: "เจ้าหน้าที่เข้าดูแลด้วยตนเอง",
        },
        create: {
            id: threadId,
            botStatus: "PAUSED_FOR_HUMAN",
            pausedAt: new Date(),
            handoffReason: "เจ้าหน้าที่เข้าดูแลด้วยตนเอง",
        },
    })

    revalidatePath("/dashboard/chat")

    return { ok: true, message: "คุณเข้าดูแลการสนทนานี้แล้ว บอทถูกหยุดชั่วคราว 🙋" }
}

/** Resume AI — manager/admin only (พนักงานไม่มีสิทธิ์). */
export async function resumeAiAgent(threadId: string): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) {
        return {
            ok: false,
            message: "เฉพาะผู้จัดการหรือผู้ดูแลระบบเท่านั้นที่สามารถให้ AI ทำงานต่อได้",
        }
    }

    await prisma.chatThread.upsert({
        where: { id: threadId },
        update: {
            botStatus: "ACTIVE",
            resumedAt: new Date(),
        },
        create: {
            id: threadId,
            botStatus: "ACTIVE",
            resumedAt: new Date(),
        },
    })

    revalidatePath("/dashboard/chat")

    return { ok: true, message: "AI Agent กลับมาดูแลการสนทนานี้แล้ว ⚡" }
}
