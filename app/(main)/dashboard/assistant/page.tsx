import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBrainState } from "@/lib/ai-service"
import { headers } from "next/headers"
import AssistantContent, {
    type AssistantInitialAgent,
    type AssistantInitialMessage,
} from "./AssistantContent"

export const metadata: Metadata = {
    title: "ผู้ช่วยขาย AI",
    description: "สนทนากับผู้ช่วยขาย AI ที่เชื่อมต่อกับสมอง LangGraph",
}

export default async function AssistantPage() {
    const session = await auth.api.getSession({ headers: await headers() })
    const userRoles = (session?.user.role ?? "user")
        .split(",")
        .map((r) => r.trim())
    const canApprove = userRoles.some((r) => r === "admin" || r === "manager")

    const conversation = session?.user.id
        ? await prisma.conversation.findFirst({
              where: { userId: session.user.id },
              orderBy: { updatedAt: "desc" },
              include: {
                  messages: { orderBy: { createdAt: "asc" } },
              },
          })
        : null

    let initialAgent: AssistantInitialAgent | null = null
    if (conversation) {
        initialAgent = {
            lead_score: conversation.leadScore,
            pipeline_stage: conversation.pipelineStage,
            requires_approval: conversation.awaitingApproval,
            pending_discount_approval: null,
        }

        if (conversation.awaitingApproval) {
            try {
                const brain = await getBrainState(conversation.id)
                initialAgent = {
                    lead_score: brain.lead_score,
                    pipeline_stage: brain.pipeline_stage,
                    requires_approval: brain.requires_approval,
                    pending_discount_approval: brain.pending_discount_approval,
                }
            } catch {
                // Brain offline — keep DB snapshot; approval banner may be incomplete.
            }
        }
    }

    const initialMessages: AssistantInitialMessage[] =
        conversation?.messages
            .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
            .map((m) => ({
                id: m.id,
                role: m.role === "USER" ? "user" : "assistant",
                content: m.content,
            })) ?? []

    return (
        <AssistantContent
            canApprove={canApprove}
            conversationId={conversation?.id ?? null}
            initialMessages={initialMessages}
            initialAgent={initialAgent}
        />
    )
}
