"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
    AlertTriangle,
    Bot,
    ChevronLeft,
    Hand,
    Headset,
    Inbox,
    Loader2,
    MessageSquare,
    Send,
    User,
    Zap,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
    getThreadMessages,
    pauseAiAgent,
    resumeAiAgent,
    sendStaffMessage,
    type StaffMessage,
} from "./actions"

export interface ThreadSummary {
    id: string
    customerName: string
    lastMessage: string
    lastAt: string
    botStatus: "ACTIVE" | "PAUSED_FOR_HUMAN"
    handoffReason: string | null
}

interface ChatDashboardProps {
    threads: ThreadSummary[]
    /** พนักงานไม่เห็นปุ่ม Resume AI */
    canResumeAi?: boolean
    /** มุมมองพนักงาน — แสดงเฉพาะคิว handoff */
    employeeView?: boolean
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "short",
        })
    } catch {
        return ""
    }
}

export default function ChatDashboard({
    threads: initialThreads,
    canResumeAi = true,
    employeeView = false,
}: ChatDashboardProps) {
    // Local copy so we can flip a thread's status to ACTIVE after "Resume AI".
    const [threads, setThreads] = useState<ThreadSummary[]>(initialThreads)
    const [selectedId, setSelectedId] = useState<string | null>(
        initialThreads[0]?.id ?? null
    )
    const [messages, setMessages] = useState<StaffMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [input, setInput] = useState("")
    const [sending, setSending] = useState(false)
    const [, startTransition] = useTransition()
    const [resuming, setResuming] = useState(false)
    const [pausing, setPausing] = useState(false)

    const endRef = useRef<HTMLDivElement>(null)

    const [prevInitialThreads, setPrevInitialThreads] = useState(initialThreads)
    if (prevInitialThreads !== initialThreads) {
        setPrevInitialThreads(initialThreads)
        setThreads(initialThreads)
    }

    // Paused threads bubble to the top so staff see urgent handoffs first.
    const sortedThreads = useMemo(() => {
        return [...threads].sort((a, b) => {
            const aPaused = a.botStatus === "PAUSED_FOR_HUMAN" ? 1 : 0
            const bPaused = b.botStatus === "PAUSED_FOR_HUMAN" ? 1 : 0
            if (aPaused !== bPaused) return bPaused - aPaused
            return b.lastAt.localeCompare(a.lastAt)
        })
    }, [threads])

    const selected = threads.find((t) => t.id === selectedId) ?? null
    const pausedCount = threads.filter((t) => t.botStatus === "PAUSED_FOR_HUMAN").length

    const [prevSelectedId, setPrevSelectedId] = useState(selectedId)
    if (prevSelectedId !== selectedId) {
        setPrevSelectedId(selectedId)
        setMessages([])
        setLoadingMessages(true)
    }

    useEffect(() => {
        if (!selectedId) {
            return
        }
        let cancelled = false
        getThreadMessages(selectedId)
            .then((msgs) => {
                if (!cancelled) setMessages(msgs)
            })
            .finally(() => {
                if (!cancelled) setLoadingMessages(false)
            })
        return () => {
            cancelled = true
        }
    }, [selectedId])

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, [messages, loadingMessages])

    async function handleSend() {
        const text = input.trim()
        if (!text || !selectedId || sending) return
        setSending(true)
        setInput("")

        const result = await sendStaffMessage(selectedId, text)
        if (result.ok && result.created) {
            setMessages((prev) => [...prev, result.created as StaffMessage])
        } else {
            toast.error(result.message)
            setInput(text) // restore so the staff member doesn't lose their text
        }
        setSending(false)
    }

    function handleResume() {
        if (!selectedId || resuming) return
        setResuming(true)
        const id = selectedId
        startTransition(async () => {
            const result = await resumeAiAgent(id)
            if (result.ok) {
                toast.success(result.message)
                setThreads((prev) =>
                    prev.map((t) =>
                        t.id === id ? { ...t, botStatus: "ACTIVE", handoffReason: null } : t
                    )
                )
            } else {
                toast.error(result.message)
            }
            setResuming(false)
        })
    }

    function handlePause() {
        if (!selectedId || pausing) return
        setPausing(true)
        const id = selectedId
        startTransition(async () => {
            const result = await pauseAiAgent(id)
            if (result.ok) {
                toast.success(result.message)
                setThreads((prev) =>
                    prev.map((t) =>
                        t.id === id
                            ? {
                                  ...t,
                                  botStatus: "PAUSED_FOR_HUMAN",
                                  handoffReason: "เจ้าหน้าที่เข้าดูแลด้วยตนเอง",
                              }
                            : t
                    )
                )
            } else {
                toast.error(result.message)
            }
            setPausing(false)
        })
    }

    return (
        <div
            className={cn(
                "flex flex-col gap-4 lg:h-[calc(100vh-7rem)]",
                selectedId
                    ? "max-lg:h-[calc(100dvh-3.5rem-var(--mobile-nav-height,0px)-env(safe-area-inset-bottom,0px)-2rem)] max-lg:min-h-0 max-lg:gap-2"
                    : "min-h-[calc(100dvh-8rem)]"
            )}
        >
            <div
                className={cn(
                    "flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
                    selectedId && "max-lg:hidden"
                )}
            >
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                        <Headset className="h-5 w-5 shrink-0 text-violet-500 sm:h-6 sm:w-6" />
                        <span className="truncate">
                            {employeeView ? "ลูกค้ารอเจ้าหน้าที่" : "แชทสด & การส่งต่อเจ้าหน้าที่"}
                        </span>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {employeeView
                            ? "รายการลูกค้าที่ต้องการให้เจ้าหน้าที่เข้ามาดูแล — ตอบแชทได้จากที่นี่"
                            : "ติดตามบทสนทนาของบอท และเข้าดูแลลูกค้าด้วยตนเองเมื่อจำเป็น"}
                    </p>
                </div>
                {pausedCount > 0 && (
                    <Badge className="gap-1.5 bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {employeeView ? `รอดูแล ${pausedCount} ราย` : `ต้องการเจ้าหน้าที่ ${pausedCount} รายการ`}
                    </Badge>
                )}
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
                {/* Inbox */}
                <Card
                    className={cn(
                        "flex min-h-0 flex-col overflow-hidden",
                        selectedId ? "hidden lg:flex" : "flex"
                    )}
                >
                    <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3 text-sm font-medium">
                        <Inbox className="h-4 w-4 text-muted-foreground" />
                        {employeeView ? "คิวรอเจ้าหน้าที่" : "กล่องข้อความ"} ({threads.length})
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        {sortedThreads.length === 0 ? (
                            <p className="p-6 text-center text-sm text-muted-foreground">
                                {employeeView
                                    ? "ขณะนี้ไม่มีลูกค้าที่รอเจ้าหน้าที่"
                                    : "ยังไม่มีบทสนทนา"}
                            </p>
                        ) : (
                            <ul className="divide-y">
                                {sortedThreads.map((t) => {
                                    const paused = t.botStatus === "PAUSED_FOR_HUMAN"
                                    const active = t.id === selectedId
                                    return (
                                        <li key={t.id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedId(t.id)}
                                                className={cn(
                                                    "flex min-h-[3.25rem] w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted/80",
                                                    active && "bg-muted",
                                                    paused &&
                                                        "border-l-2 border-l-red-500 bg-red-50/60 dark:bg-red-950/20"
                                                )}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-sm font-medium">
                                                        {t.customerName}
                                                    </span>
                                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                                        {formatTime(t.lastAt)}
                                                    </span>
                                                </div>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {t.lastMessage || "—"}
                                                </p>
                                                {paused && (
                                                    <Badge className="mt-1 w-fit gap-1 bg-red-100 text-[10px] text-red-700 dark:bg-red-950/50 dark:text-red-400">
                                                        <AlertTriangle className="h-2.5 w-2.5" />
                                                        Human Intervention Required
                                                    </Badge>
                                                )}
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </ScrollArea>
                </Card>

                {/* Conversation */}
                <Card
                    className={cn(
                        "flex min-h-0 flex-col overflow-hidden",
                        selectedId ? "flex" : "hidden lg:flex"
                    )}
                >
                    {!selected ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                            <MessageSquare className="h-10 w-10 opacity-40" />
                            <p className="text-sm">เลือกบทสนทนาจากกล่องข้อความ</p>
                        </div>
                    ) : (
                        <>
                            {/* Thread header */}
                            <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 shrink-0 lg:hidden"
                                        aria-label="กลับไปรายการแชท"
                                        onClick={() => setSelectedId(null)}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <Avatar>
                                        <AvatarFallback className="bg-violet-100 text-violet-600 dark:bg-violet-950">
                                            <User className="h-4 w-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {selected.customerName}
                                        </p>
                                        {selected.botStatus === "PAUSED_FOR_HUMAN" ? (
                                            <span className="text-xs text-red-600 dark:text-red-400">
                                                บอทถูกหยุด — เจ้าหน้าที่กำลังดูแล
                                            </span>
                                        ) : (
                                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                                บอทกำลังทำงานอัตโนมัติ
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {canResumeAi &&
                                    (selected.botStatus === "PAUSED_FOR_HUMAN" ? (
                                        <Button
                                            size="sm"
                                            className="w-full gap-1.5 bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"
                                            disabled={resuming}
                                            onClick={handleResume}
                                        >
                                            {resuming ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Zap className="h-3.5 w-3.5" />
                                            )}
                                            Resume AI Agent
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 sm:w-auto dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                            disabled={pausing}
                                            onClick={handlePause}
                                        >
                                            {pausing ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Hand className="h-3.5 w-3.5" />
                                            )}
                                            เข้าดูแลเอง (หยุดบอท)
                                        </Button>
                                    ))}
                            </div>

                            {/* Handoff alert */}
                            {selected.botStatus === "PAUSED_FOR_HUMAN" && (
                                <div className="flex shrink-0 items-start gap-2 border-b bg-amber-50 px-4 py-2.5 text-sm dark:bg-amber-950/30">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <span>
                                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                                            Human Intervention Required
                                        </span>
                                        {selected.handoffReason
                                            ? ` — ${selected.handoffReason}`
                                            : " — ลูกค้าต้องการการดูแลจากเจ้าหน้าที่"}
                                    </span>
                                </div>
                            )}

                            {/* Messages */}
                            <ScrollArea className="min-h-0 flex-1">
                                <div className="flex flex-col gap-4 p-4">
                                    {loadingMessages ? (
                                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            กำลังโหลดข้อความ...
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <p className="py-10 text-center text-sm text-muted-foreground">
                                            ยังไม่มีข้อความในบทสนทนานี้
                                        </p>
                                    ) : (
                                        messages.map((m) => <Bubble key={m.id} message={m} />)
                                    )}
                                    <div ref={endRef} />
                                </div>
                            </ScrollArea>

                            {/* Composer */}
                            <div className="shrink-0 border-t p-3 pb-3">
                                <form
                                    className="flex items-center gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        handleSend()
                                    }}
                                >
                                    <Input
                                        placeholder="พิมพ์ข้อความถึงลูกค้าในฐานะเจ้าหน้าที่..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        disabled={sending}
                                        className="h-11"
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        className="h-11 w-11 shrink-0"
                                        disabled={sending || !input.trim()}
                                    >
                                        {sending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </form>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </div>
    )
}

function Bubble({ message }: { message: StaffMessage }) {
    const isCustomer = message.role === "user"

    return (
        <div className={cn("flex items-start gap-3", !isCustomer && "flex-row-reverse")}>
            <Avatar>
                <AvatarFallback
                    className={cn(
                        isCustomer
                            ? "bg-slate-200 text-slate-600 dark:bg-slate-800"
                            : message.fromStaff
                              ? "bg-amber-100 text-amber-600 dark:bg-amber-950"
                              : "bg-violet-100 text-violet-600 dark:bg-violet-950"
                    )}
                >
                    {isCustomer ? (
                        <User className="h-4 w-4" />
                    ) : message.fromStaff ? (
                        <Headset className="h-4 w-4" />
                    ) : (
                        <Bot className="h-4 w-4" />
                    )}
                </AvatarFallback>
            </Avatar>
            <div className="flex max-w-[80%] flex-col gap-0.5">
                {!isCustomer && (
                    <span className="px-1 text-[10px] font-medium text-muted-foreground">
                        {message.fromStaff ? "เจ้าหน้าที่" : "AI Agent"}
                    </span>
                )}
                <div
                    className={cn(
                        "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                        isCustomer
                            ? "bg-muted text-foreground"
                            : message.fromStaff
                              ? "bg-amber-500 text-white"
                              : "bg-primary text-primary-foreground"
                    )}
                >
                    {message.imageUrl ? (
                        <a
                            href={message.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                        >
                            {/* รูปที่ลูกค้าส่งมา (สลิป/รูปสินค้า) — กดเพื่อดูเต็มจอ */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={message.imageUrl}
                                alt="รูปจากลูกค้า"
                                className="max-h-64 w-auto rounded-lg object-contain"
                                loading="lazy"
                            />
                        </a>
                    ) : (
                        message.content
                    )}
                </div>
            </div>
        </div>
    )
}
