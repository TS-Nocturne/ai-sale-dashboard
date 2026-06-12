"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Bot,
    Send,
    Loader2,
    Sparkles,
    User,
    Check,
    X,
    AlertTriangle,
    Gauge,
    Plus,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

export interface AssistantInitialMessage {
    id: string
    role: "user" | "assistant"
    content: string
}

export interface PendingDiscount {
    product?: string
    discount_pct?: number
    reason?: string
    original_price?: number
}

export interface AssistantInitialAgent {
    lead_score: number
    pipeline_stage: string
    requires_approval: boolean
    pending_discount_approval: PendingDiscount | null
}

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
}

interface AgentState {
    lead_score: number
    pipeline_stage: string
    requires_approval: boolean
    pending_discount_approval: PendingDiscount | null
}

interface ApiResponse extends AgentState {
    conversationId: string
    reply: string
}

interface AssistantContentProps {
    canApprove: boolean
    conversationId?: string | null
    initialMessages?: AssistantInitialMessage[]
    initialAgent?: AssistantInitialAgent | null
}

// ── Pipeline stage labels ──────────────────────────────────────────────────────

const stageConfig: Record<string, { label: string; className: string }> = {
    new: { label: "ลูกค้าใหม่", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    qualified: { label: "คัดกรองแล้ว", className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400" },
    negotiation: { label: "กำลังเจรจา", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" },
    closed_won: { label: "ปิดการขาย ✓", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
    closed_lost: { label: "เสียลูกค้า", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
}

const defaultAgent: AgentState = {
    lead_score: 0,
    pipeline_stage: "new",
    requires_approval: false,
    pending_discount_approval: null,
}

function leadScoreColor(score: number): string {
    if (score >= 70) return "text-emerald-600 dark:text-emerald-400"
    if (score >= 40) return "text-amber-600 dark:text-amber-400"
    return "text-slate-500 dark:text-slate-400"
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AssistantContent({
    canApprove,
    conversationId: initialConversationId = null,
    initialMessages = [],
    initialAgent = null,
}: AssistantContentProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [deciding, setDeciding] = useState(false)
    const [conversationId, setConversationId] = useState<string | null>(initialConversationId)
    const [agent, setAgent] = useState<AgentState>(initialAgent ?? defaultAgent)
    const [error, setError] = useState<string | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, [messages, loading])

    function pushMessage(role: ChatMessage["role"], content: string) {
        setMessages((prev) => [
            ...prev,
            { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, content, role },
        ])
    }

    function startNewChat() {
        setMessages([])
        setConversationId(null)
        setAgent(defaultAgent)
        setError(null)
        setInput("")
    }

    async function handleSend() {
        const text = input.trim()
        if (!text || loading) return

        setError(null)
        setInput("")
        pushMessage("user", text)
        setLoading(true)

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, conversationId }),
            })
            const data = (await res.json()) as ApiResponse & { error?: string }

            if (!res.ok) {
                setError(data.error ?? "เกิดข้อผิดพลาดในการส่งข้อความ")
                if (data.conversationId) setConversationId(data.conversationId)
                return
            }

            setConversationId(data.conversationId)
            setAgent({
                lead_score: data.lead_score,
                pipeline_stage: data.pipeline_stage,
                requires_approval: data.requires_approval,
                pending_discount_approval: data.pending_discount_approval,
            })
            if (data.reply) pushMessage("assistant", data.reply)
        } catch {
            setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้")
        } finally {
            setLoading(false)
        }
    }

    async function handleDecision(approved: boolean) {
        if (!conversationId || deciding) return
        setError(null)
        setDeciding(true)

        try {
            const res = await fetch("/api/ai/approval", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId, approved }),
            })
            const data = (await res.json()) as ApiResponse & { error?: string }

            if (!res.ok) {
                setError(data.error ?? "ไม่สามารถบันทึกการตัดสินใจได้")
                return
            }

            setAgent({
                lead_score: data.lead_score,
                pipeline_stage: data.pipeline_stage,
                requires_approval: data.requires_approval,
                pending_discount_approval: data.pending_discount_approval,
            })
            if (data.reply) pushMessage("assistant", data.reply)
        } catch {
            setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้")
        } finally {
            setDeciding(false)
        }
    }

    const stage = stageConfig[agent.pipeline_stage] ?? stageConfig.new
    const pending = agent.pending_discount_approval

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Header */}
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                        <Sparkles className="h-6 w-6 shrink-0 text-violet-500" />
                        ผู้ช่วยขาย AI
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        สนทนากับสมอง AI (LangGraph) ที่ค้นหาข้อมูลสินค้าและให้คะแนนลีดแบบเรียลไทม์
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={startNewChat}>
                        <Plus className="h-3.5 w-3.5" />
                        แชทใหม่
                    </Button>
                    <Badge variant="outline" className="gap-1.5">
                        <Gauge className="h-3.5 w-3.5" />
                        คะแนน:{" "}
                        <span className={`font-bold ${leadScoreColor(agent.lead_score)}`}>
                            {agent.lead_score}
                        </span>
                        /100
                    </Badge>
                    <Badge className={`text-xs ${stage.className}`}>{stage.label}</Badge>
                </div>
            </div>

            {/* Chat area */}
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                        <div className="mx-auto flex max-w-3xl flex-col gap-4">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                                    <Bot className="h-12 w-12 opacity-40" />
                                    <p className="text-sm">
                                        เริ่มสนทนาได้เลย เช่น
                                        <br />
                                        &ldquo;มีเคส iPhone 15 Pro Max แบบกันกระแทกไหม งบไม่เกิน 1,000 บาท&rdquo;
                                    </p>
                                </div>
                            )}

                            {messages.map((m) => (
                                <MessageBubble key={m.id} message={m} />
                            ))}

                            {loading && (
                                <div className="flex items-start gap-3">
                                    <Avatar>
                                        <AvatarFallback className="bg-violet-100 text-violet-600 dark:bg-violet-950">
                                            <Bot className="h-4 w-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        กำลังคิด...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Pending approval banner */}
                    {agent.requires_approval && pending && (
                        <div className="shrink-0 border-t bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
                            <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-2 text-sm">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <span>
                                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                                            รออนุมัติส่วนลด:
                                        </span>{" "}
                                        {pending.product} — {pending.discount_pct}%
                                        {pending.reason ? ` (${pending.reason})` : ""}
                                    </span>
                                </div>
                                {canApprove ? (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                            disabled={deciding}
                                            onClick={() => handleDecision(true)}
                                        >
                                            {deciding ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Check className="h-3.5 w-3.5" />
                                            )}
                                            อนุมัติ
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5"
                                            disabled={deciding}
                                            onClick={() => handleDecision(false)}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            ปฏิเสธ
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground">
                                        ต้องให้ผู้จัดการเป็นผู้อนุมัติ
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="shrink-0 border-t bg-red-50 px-4 py-2 text-center text-sm text-red-600 dark:bg-red-950/30">
                            {error}
                        </div>
                    )}

                    {/* Input */}
                    <div className="shrink-0 border-t p-4">
                        <form
                            className="mx-auto flex max-w-3xl items-center gap-2"
                            onSubmit={(e) => {
                                e.preventDefault()
                                handleSend()
                            }}
                        >
                            <Input
                                placeholder="พิมพ์ข้อความถึงผู้ช่วยขาย AI..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={loading}
                                className="h-11"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="h-11 w-11 shrink-0"
                                disabled={loading || !input.trim()}
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === "user"
    return (
        <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
            <Avatar>
                <AvatarFallback
                    className={
                        isUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-violet-100 text-violet-600 dark:bg-violet-950"
                    }
                >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </AvatarFallback>
            </Avatar>
            <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                    isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                }`}
            >
                {message.content}
            </div>
        </div>
    )
}
