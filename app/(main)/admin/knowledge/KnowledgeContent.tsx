"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    BrainCircuit,
    ChevronLeft,
    FileText,
    Loader2,
    Plus,
    RefreshCw,
    Trash2,
    Upload,
    Search,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
    type KnowledgeDTO,
    createTextDocument,
    deleteDocumentAction,
    reindexDocument,
    uploadKnowledgeFile,
} from "./actions"

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
    } catch {
        return "—"
    }
}

const STATUS_META: Record<KnowledgeDTO["status"], { label: string; className: string }> = {
    INDEXED: {
        label: "พร้อมใช้กับ AI",
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    },
    PENDING: {
        label: "รอ index",
        className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    },
    FAILED: {
        label: "index ไม่สำเร็จ",
        className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    },
}

function AddTextDialog({ onSaved }: { onSaved: () => void }) {
    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        setSaving(true)
        const result = await createTextDocument({ title, content })
        setSaving(false)
        if (result.ok) {
            toast.success(result.message)
            setTitle("")
            setContent("")
            setOpen(false)
            onSaved()
        } else {
            toast.error(result.message)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    เพิ่มเอกสาร
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>เพิ่มเอกสารฐานความรู้</DialogTitle>
                    <DialogDescription>
                        พิมพ์เนื้อหา เช่น นโยบายร้าน / FAQ — ระบบจะย่อยเป็น chunk แล้วเก็บลง Vector DB ให้ AI ใช้ตอบ
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="kb-title">ชื่อเอกสาร *</Label>
                        <Input
                            id="kb-title"
                            placeholder="นโยบายการคืนสินค้า"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="kb-content">เนื้อหา *</Label>
                        <textarea
                            id="kb-content"
                            rows={8}
                            className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="ลูกค้าสามารถคืนสินค้าได้ภายใน 7 วัน..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !title || !content}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        บันทึก & Index
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function UploadDialog({ onSaved }: { onSaved: () => void }) {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [title, setTitle] = useState("")
    const [saving, setSaving] = useState(false)

    async function handleUpload() {
        if (!file) {
            toast.error("กรุณาเลือกไฟล์")
            return
        }
        setSaving(true)
        const formData = new FormData()
        formData.append("file", file)
        formData.append("title", title)
        const result = await uploadKnowledgeFile(formData)
        setSaving(false)
        if (result.ok) {
            toast.success(result.message)
            setFile(null)
            setTitle("")
            setOpen(false)
            onSaved()
        } else {
            toast.error(result.message)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    อัปโหลดไฟล์
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>อัปโหลดไฟล์ฐานความรู้</DialogTitle>
                    <DialogDescription>
                        รองรับ PDF / TXT / CSV / MD — ใช้สำหรับข้อมูลแบบไม่มีโครงสร้าง (คู่มือ, FAQ, นโยบาย).
                        สำหรับไฟล์สินค้า/สต็อก ให้ไปที่หน้า &quot;สินค้า/บริการ&quot; แทน
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="kb-file">ไฟล์เอกสาร *</Label>
                        <Input
                            id="kb-file"
                            type="file"
                            accept=".pdf,.txt,.csv,.md"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="kb-file-title">ชื่อเอกสาร (ไม่บังคับ)</Label>
                        <Input
                            id="kb-file-title"
                            placeholder="ถ้าเว้นว่างจะใช้ชื่อไฟล์"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleUpload} disabled={saving || !file}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        อัปโหลด & Index
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function KnowledgeContent({
    initialDocuments,
}: {
    initialDocuments: KnowledgeDTO[]
}) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [selectedId, setSelectedId] = useState<string | null>(initialDocuments[0]?.id ?? null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [, startTransition] = useTransition()

    const refresh = () => startTransition(() => router.refresh())

    const filtered = initialDocuments.filter(
        (d) =>
            d.title.toLowerCase().includes(search.toLowerCase()) ||
            d.content.toLowerCase().includes(search.toLowerCase())
    )
    const selected = initialDocuments.find((d) => d.id === selectedId) ?? null
    const indexedCount = initialDocuments.filter((d) => d.status === "INDEXED").length

    async function handleReindex(id: string) {
        setBusyId(id)
        const result = await reindexDocument(id)
        setBusyId(null)
        if (result.ok) {
            toast.success(result.message)
        } else {
            toast.error(result.message)
        }
        refresh()
    }

    async function handleDelete(id: string) {
        setBusyId(id)
        const result = await deleteDocumentAction(id)
        setBusyId(null)
        if (result.ok) {
            toast.success(result.message)
            if (selectedId === id) setSelectedId(null)
            refresh()
        } else {
            toast.error(result.message)
        }
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
                        <BrainCircuit className="h-5 w-5 shrink-0 text-violet-500 sm:h-6 sm:w-6" />
                        ฐานความรู้ AI (Knowledge Base)
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        เอกสารแบบไม่มีโครงสร้าง (คู่มือ / FAQ / นโยบาย) สำหรับให้ AI ใช้ค้นหาบริบทตอบแชท (RAG)
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5">
                        <BrainCircuit className="h-3.5 w-3.5" />
                        {indexedCount} เอกสารพร้อมใช้
                    </Badge>
                    <UploadDialog onSaved={refresh} />
                    <AddTextDialog onSaved={refresh} />
                </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
                {/* List */}
                <Card
                    className={cn(
                        "flex min-h-0 flex-col overflow-hidden",
                        selectedId ? "hidden lg:flex" : "flex"
                    )}
                >
                    <div className="shrink-0 border-b p-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="ค้นหาเอกสาร..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 pl-8"
                            />
                        </div>
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        {filtered.length === 0 ? (
                            <p className="p-6 text-center text-sm text-muted-foreground">
                                {initialDocuments.length === 0
                                    ? "ยังไม่มีเอกสาร — เพิ่มหรืออัปโหลดไฟล์เพื่อเริ่มต้น"
                                    : "ไม่พบเอกสารที่ค้นหา"}
                            </p>
                        ) : (
                            <ul className="divide-y">
                                {filtered.map((d) => {
                                    const meta = STATUS_META[d.status]
                                    return (
                                        <li key={d.id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedId(d.id)}
                                                className={cn(
                                                    "flex min-h-[3.25rem] w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted/80",
                                                    selectedId === d.id && "bg-muted"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <span className="truncate text-sm font-medium">{d.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2 pl-6">
                                                    <Badge className={cn("text-[10px]", meta.className)}>
                                                        {meta.label}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {d.chunkCount > 0 ? `${d.chunkCount} chunks · ` : ""}
                                                        {formatDate(d.updatedAt)}
                                                    </span>
                                                </div>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </ScrollArea>
                </Card>

                {/* Detail */}
                <Card
                    className={cn(
                        "flex min-h-0 flex-col overflow-hidden",
                        selectedId ? "flex" : "hidden lg:flex"
                    )}
                >
                    {!selected ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                            <FileText className="h-10 w-10 opacity-40" />
                            <p className="text-sm">เลือกเอกสารเพื่อดูรายละเอียด</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 items-start gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 shrink-0 lg:hidden"
                                        aria-label="กลับไปรายการเอกสาร"
                                        onClick={() => setSelectedId(null)}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <div className="min-w-0">
                                        <p className="truncate text-base font-semibold">{selected.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {selected.source ?? "พิมพ์ด้วยตนเอง"} · อัปเดต {formatDate(selected.updatedAt)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5"
                                        disabled={busyId === selected.id}
                                        onClick={() => handleReindex(selected.id)}
                                    >
                                        {busyId === selected.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        )}
                                        Index ใหม่
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                                        disabled={busyId === selected.id}
                                        onClick={() => handleDelete(selected.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        ลบ
                                    </Button>
                                </div>
                            </div>
                            <ScrollArea className="min-h-0 flex-1">
                                <pre className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-foreground">
                                    {selected.content || "(ไม่มีเนื้อหาแสดงตัวอย่าง)"}
                                </pre>
                            </ScrollArea>
                        </>
                    )}
                </Card>
            </div>
        </div>
    )
}
