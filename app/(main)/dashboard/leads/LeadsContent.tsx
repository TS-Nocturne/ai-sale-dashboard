"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Plus,
    Search,
    MoreHorizontal,
    Filter,
    Download,
    Phone,
    MessageSquare,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST"
type LeadSource = "FACEBOOK" | "LINE" | "INSTAGRAM" | "TIKTOK" | "REFERRAL" | "WEBSITE" | "COLD_CALL" | "OTHER"

interface Lead {
    id: string
    name: string
    phone: string
    email?: string
    lineId?: string
    source: LeadSource
    status: LeadStatus
    budget?: number
    note?: string
    assignedTo?: string
    createdAt: string
}

export type LeadRow = Lead

interface LeadsContentProps {
    leads: LeadRow[]
}

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
    NEW: { label: "ใหม่", className: "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300" },
    CONTACTED: { label: "ติดต่อแล้ว", className: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400" },
    QUALIFIED: { label: "คัดกรองแล้ว", className: "bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-400" },
    PROPOSAL: { label: "เสนอราคา", className: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400" },
    NEGOTIATION: { label: "เจรจา", className: "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-400" },
    WON: { label: "ปิดการขาย ✓", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400" },
    LOST: { label: "เสียลีด", className: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-400" },
}

const sourceLabels: Record<LeadSource, string> = {
    FACEBOOK: "Facebook",
    LINE: "Line",
    INSTAGRAM: "Instagram",
    TIKTOK: "TikTok",
    REFERRAL: "แนะนำ",
    WEBSITE: "Website",
    COLD_CALL: "Cold Call",
    OTHER: "อื่นๆ",
}

// ── Add Lead Dialog ────────────────────────────────────────────────────────────

function AddLeadDialog() {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    เพิ่มลีด
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>เพิ่มลีดใหม่</DialogTitle>
                    <DialogDescription>กรอกข้อมูลลีดที่ต้องการเพิ่มเข้าระบบ</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
                            <Input id="name" placeholder="สมชาย ใจดี" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">เบอร์โทร</Label>
                            <Input id="phone" placeholder="08X-XXX-XXXX" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">อีเมล</Label>
                            <Input id="email" type="email" placeholder="email@example.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lineId">Line ID</Label>
                            <Input id="lineId" placeholder="@lineid" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>แหล่งที่มา</Label>
                            <Select defaultValue="FACEBOOK">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(sourceLabels).map(([val, label]) => (
                                        <SelectItem key={val} value={val}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="budget">งบประมาณ (฿)</Label>
                            <Input id="budget" type="number" placeholder="0" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="note">หมายเหตุ</Label>
                        <Input id="note" placeholder="รายละเอียดเพิ่มเติม..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                    <Button onClick={() => setOpen(false)}>บันทึก</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LeadsContent({ leads }: LeadsContentProps) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [sourceFilter, setSourceFilter] = useState<string>("ALL")

    const filtered = leads.filter((lead) => {
        const matchSearch =
            lead.name.toLowerCase().includes(search.toLowerCase()) ||
            lead.phone.includes(search)
        const matchStatus = statusFilter === "ALL" || lead.status === statusFilter
        const matchSource = sourceFilter === "ALL" || lead.source === sourceFilter
        return matchSearch && matchStatus && matchSource
    })

    const stats = {
        total: leads.length,
        new: leads.filter((l) => l.status === "NEW").length,
        won: leads.filter((l) => l.status === "WON").length,
        totalBudget: leads.reduce((s, l) => s + (l.budget ?? 0), 0),
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight sm:text-2xl">จัดการลีด</h1>
                    <p className="text-sm text-muted-foreground">ติดตามและจัดการลีดทั้งหมดในระบบ</p>
                </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    <AddLeadDialog />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: "ลีดทั้งหมด", value: stats.total, sub: "รายการ" },
                    { label: "ลีดใหม่วันนี้", value: stats.new, sub: "รายการ" },
                    { label: "ปิดการขายแล้ว", value: stats.won, sub: "รายการ" },
                    { label: "รวมงบประมาณ", value: `฿${stats.totalBudget.toLocaleString()}`, sub: "" },
                ].map((s) => (
                    <Card key={s.label}>
                        <CardContent className="pt-5">
                            <p className="text-sm text-muted-foreground">{s.label}</p>
                            <p className="text-2xl font-bold">
                                {s.value} <span className="text-base font-normal text-muted-foreground">{s.sub}</span>
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters + Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-base">รายการลีดทั้งหมด</CardTitle>
                        <div className="flex flex-wrap gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="ค้นหาชื่อหรือเบอร์..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-9 w-full pl-8 sm:w-52"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-9 w-full sm:w-36">
                                    <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="สถานะ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                                    {Object.entries(statusConfig).map(([val, s]) => (
                                        <SelectItem key={val} value={val}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                <SelectTrigger className="h-9 w-full sm:w-36">
                                    <SelectValue placeholder="แหล่งที่มา" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">ทุกแหล่ง</SelectItem>
                                    {Object.entries(sourceLabels).map(([val, label]) => (
                                        <SelectItem key={val} value={val}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Mobile cards */}
                    <div className="space-y-3 lg:hidden">
                        {filtered.length === 0 ? (
                            <p className="py-10 text-center text-sm text-muted-foreground">
                                ไม่พบข้อมูลลีด
                            </p>
                        ) : (
                            filtered.map((lead) => {
                                const s = statusConfig[lead.status]
                                return (
                                    <div
                                        key={lead.id}
                                        className="rounded-lg border bg-card p-4 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-medium">{lead.name}</p>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {lead.phone}
                                                    </span>
                                                    {lead.lineId && (
                                                        <span className="flex items-center gap-1">
                                                            <MessageSquare className="h-3 w-3" />
                                                            {lead.lineId}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Badge className={`shrink-0 text-xs ${s.className}`}>
                                                {s.label}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {sourceLabels[lead.source]}
                                            </Badge>
                                            {lead.assignedTo && (
                                                <span className="text-xs text-muted-foreground">
                                                    ผู้รับผิดชอบ: {lead.assignedTo}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">งบประมาณ</span>
                                            <span className="font-semibold">
                                                {lead.budget
                                                    ? `฿${lead.budget.toLocaleString()}`
                                                    : "—"}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-right text-xs text-muted-foreground">
                                            {lead.createdAt}
                                        </p>
                                        <div className="mt-3 flex justify-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 gap-1">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        จัดการ
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>ดูรายละเอียด</DropdownMenuItem>
                                                    <DropdownMenuItem>แก้ไข</DropdownMenuItem>
                                                    <DropdownMenuItem>เปลี่ยนสถานะ</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-destructive">
                                                        ลบลีด
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ชื่อ-ช่องทาง</TableHead>
                                <TableHead>แหล่งที่มา</TableHead>
                                <TableHead>สถานะ</TableHead>
                                <TableHead>ผู้รับผิดชอบ</TableHead>
                                <TableHead className="text-right">งบประมาณ</TableHead>
                                <TableHead className="text-right">วันที่</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                                        ไม่พบข้อมูลลีด
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((lead) => {
                                    const s = statusConfig[lead.status]
                                    return (
                                        <TableRow key={lead.id}>
                                            <TableCell>
                                                <div className="font-medium">{lead.name}</div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {lead.phone}
                                                    </span>
                                                    {lead.lineId && (
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <MessageSquare className="h-3 w-3" />
                                                            {lead.lineId}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {sourceLabels[lead.source]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`text-xs ${s.className}`}>
                                                    {s.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {lead.assignedTo ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {lead.budget ? `฿${lead.budget.toLocaleString()}` : "—"}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {lead.createdAt}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>ดูรายละเอียด</DropdownMenuItem>
                                                        <DropdownMenuItem>แก้ไข</DropdownMenuItem>
                                                        <DropdownMenuItem>เปลี่ยนสถานะ</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive">
                                                            ลบลีด
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>แสดง {filtered.length} จาก {leads.length} รายการ</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
