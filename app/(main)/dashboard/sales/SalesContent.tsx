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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    DollarSign,
    TrendingUp,
    ShoppingCart,
    Search,
    Download,
    MoreHorizontal,
    Filter,
    CheckCircle2,
    Clock,
    XCircle,
    Truck,
} from "lucide-react"

type SaleStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED" | "REFUNDED"

interface Sale {
    id: string
    orderNo: string
    customerName: string
    items: string
    totalAmount: number
    discount: number
    netAmount: number
    status: SaleStatus
    soldBy: string
    soldAt: string
}

export type SaleRow = Sale

interface SalesContentProps {
    sales: SaleRow[]
}

const statusConfig: Record<SaleStatus, { label: string; icon: React.ElementType; className: string }> = {
    PENDING: { label: "รอดำเนินการ", icon: Clock, className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
    CONFIRMED: { label: "ยืนยันแล้ว", icon: CheckCircle2, className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
    DELIVERED: { label: "ส่งมอบแล้ว", icon: Truck, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
    CANCELLED: { label: "ยกเลิก", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
    REFUNDED: { label: "คืนเงิน", icon: XCircle, className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
}

export default function SalesContent({ sales }: SalesContentProps) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("ALL")

    const filtered = sales.filter((s) => {
        const matchSearch =
            s.customerName.toLowerCase().includes(search.toLowerCase()) ||
            s.orderNo.includes(search)
        const matchStatus = statusFilter === "ALL" || s.status === statusFilter
        return matchSearch && matchStatus
    })

    const totalRevenue = sales
        .filter((s) => s.status === "CONFIRMED" || s.status === "DELIVERED")
        .reduce((sum, s) => sum + s.netAmount, 0)
    const delivered = sales.filter((s) => s.status === "DELIVERED").length
    const pending = sales.filter((s) => s.status === "PENDING").length
    const totalDiscount = sales.reduce((sum, s) => sum + s.discount, 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight sm:text-2xl">การขาย</h1>
                    <p className="text-sm text-muted-foreground">ประวัติและสถานะการขายทั้งหมด</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                </Button>
            </div>

            {/* KPI */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { icon: DollarSign, label: "รายได้สุทธิรวม", value: `฿${totalRevenue.toLocaleString()}`, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" },
                    { icon: ShoppingCart, label: "ออเดอร์ทั้งหมด", value: `${sales.length} รายการ`, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
                    { icon: TrendingUp, label: "ส่งมอบแล้ว", value: `${delivered} รายการ`, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950" },
                    { icon: Clock, label: "รอดำเนินการ", value: `${pending} รายการ`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" },
                ].map((s) => (
                    <Card key={s.label}>
                        <CardContent className="flex items-center gap-3 pt-5">
                            <div className={`rounded-lg p-2 ${s.bg}`}>
                                <s.icon className={`h-5 w-5 ${s.color}`} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className="text-xl font-bold">{s.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-base">รายการขายทั้งหมด</CardTitle>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="ค้นหาชื่อหรือเลขออเดอร์..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-9 w-full pl-8 sm:w-52"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-9 w-full sm:w-40">
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
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Mobile cards */}
                    <div className="space-y-3 lg:hidden">
                        {filtered.length === 0 ? (
                            <p className="py-10 text-center text-sm text-muted-foreground">
                                ไม่พบข้อมูล
                            </p>
                        ) : (
                            filtered.map((sale) => {
                                const s = statusConfig[sale.status]
                                const StatusIcon = s.icon
                                return (
                                    <div
                                        key={sale.id}
                                        className="rounded-lg border bg-card p-4 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-mono text-xs text-muted-foreground">
                                                    {sale.orderNo}
                                                </p>
                                                <p className="font-medium">{sale.customerName}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {sale.items}
                                                </p>
                                            </div>
                                            <Badge className={`shrink-0 gap-1 text-xs ${s.className}`}>
                                                <StatusIcon className="h-3 w-3" />
                                                {s.label}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <p className="text-xs text-muted-foreground">ราคาเต็ม</p>
                                                <p>฿{sale.totalAmount.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">สุทธิ</p>
                                                <p className="font-semibold">
                                                    ฿{sale.netAmount.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        {sale.discount > 0 && (
                                            <p className="mt-1 text-right text-xs text-red-600">
                                                ส่วนลด -฿{sale.discount.toLocaleString()}
                                            </p>
                                        )}
                                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{sale.soldBy}</span>
                                            <span>{sale.soldAt}</span>
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
                                <TableHead>เลขออเดอร์</TableHead>
                                <TableHead>ลูกค้า</TableHead>
                                <TableHead>สินค้า/บริการ</TableHead>
                                <TableHead>สถานะ</TableHead>
                                <TableHead className="text-right">ราคาเต็ม</TableHead>
                                <TableHead className="text-right">ส่วนลด</TableHead>
                                <TableHead className="text-right">สุทธิ</TableHead>
                                <TableHead className="text-right">ผู้ขาย</TableHead>
                                <TableHead className="text-right">วันที่</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                                        ไม่พบข้อมูล
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((sale) => {
                                    const s = statusConfig[sale.status]
                                    const StatusIcon = s.icon
                                    return (
                                        <TableRow key={sale.id}>
                                            <TableCell className="font-mono text-sm font-medium">
                                                {sale.orderNo}
                                            </TableCell>
                                            <TableCell className="font-medium">{sale.customerName}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                                                {sale.items}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`gap-1 text-xs ${s.className}`}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {s.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm">
                                                ฿{sale.totalAmount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-red-600">
                                                {sale.discount > 0 ? `-฿${sale.discount.toLocaleString()}` : "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                ฿{sale.netAmount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {sale.soldBy}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {sale.soldAt}
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
                                                        <DropdownMenuItem>แก้ไขสถานะ</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive">ยกเลิก</DropdownMenuItem>
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
                    <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>แสดง {filtered.length} จาก {sales.length} รายการ</span>
                        <span>ส่วนลดรวม: ฿{totalDiscount.toLocaleString()}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
