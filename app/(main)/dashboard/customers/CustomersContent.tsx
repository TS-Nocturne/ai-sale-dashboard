"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Plus, Search, MoreHorizontal, Users, DollarSign, ShoppingCart, Download } from "lucide-react"

interface Customer {
    id: string
    name: string
    phone?: string
    email?: string
    lineId?: string
    totalPurchased: number
    orderCount: number
    lastOrderAt: string
    createdAt: string
}

export type CustomerRow = Customer

interface CustomersContentProps {
    customers: CustomerRow[]
}

function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2)
}

function AddCustomerDialog() {
    const [open, setOpen] = useState(false)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    เพิ่มลูกค้า
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
                    <DialogDescription>กรอกข้อมูลลูกค้าที่ต้องการเพิ่มเข้าระบบ</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="cust-name">ชื่อ-นามสกุล *</Label>
                        <Input id="cust-name" placeholder="ชื่อลูกค้า" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cust-phone">เบอร์โทร</Label>
                            <Input id="cust-phone" placeholder="08X-XXX-XXXX" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cust-line">Line ID</Label>
                            <Input id="cust-line" placeholder="@lineid" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cust-email">อีเมล</Label>
                        <Input id="cust-email" type="email" placeholder="email@example.com" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cust-address">ที่อยู่</Label>
                        <Input id="cust-address" placeholder="ที่อยู่จัดส่ง" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cust-note">หมายเหตุ</Label>
                        <Input id="cust-note" placeholder="ข้อมูลเพิ่มเติม" />
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

export default function CustomersContent({ customers }: CustomersContentProps) {
    const [search, setSearch] = useState("")

    const filtered = customers.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone ?? "").includes(search) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase())
    )

    const totalRevenue = customers.reduce((s, c) => s + c.totalPurchased, 0)
    const totalOrders = customers.reduce((s, c) => s + c.orderCount, 0)
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight sm:text-2xl">ลูกค้า</h1>
                    <p className="text-sm text-muted-foreground">จัดการข้อมูลลูกค้าทั้งหมดในระบบ</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    <AddCustomerDialog />
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    { icon: Users, label: "ลูกค้าทั้งหมด", value: `${customers.length} ราย`, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
                    { icon: DollarSign, label: "รายได้รวมจากลูกค้า", value: `฿${totalRevenue.toLocaleString()}`, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" },
                    { icon: ShoppingCart, label: "ค่าเฉลี่ยต่อออเดอร์", value: `฿${Math.round(avgOrder).toLocaleString()}`, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950" },
                ].map((s) => (
                    <Card key={s.label}>
                        <CardContent className="flex items-center gap-4 pt-5">
                            <div className={`rounded-lg p-2.5 ${s.bg}`}>
                                <s.icon className={`h-5 w-5 ${s.color}`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{s.label}</p>
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
                        <CardTitle className="text-base">รายชื่อลูกค้า</CardTitle>
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="ค้นหาชื่อ อีเมล หรือเบอร์..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 w-full pl-8 sm:w-60"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Mobile / tablet cards */}
                    <div className="space-y-3 lg:hidden">
                        {filtered.map((c) => (
                            <div key={c.id} className="rounded-lg border bg-card p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Avatar className="h-9 w-9 shrink-0">
                                            <AvatarFallback className="bg-muted text-xs">
                                                {initials(c.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="font-medium">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                ลูกค้าตั้งแต่ {c.createdAt}
                                            </p>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>ดูประวัติ</DropdownMenuItem>
                                            <DropdownMenuItem>แก้ไขข้อมูล</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive">ลบ</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="mt-3 space-y-1 text-sm">
                                    {c.phone && <p>{c.phone}</p>}
                                    {c.email && (
                                        <p className="text-xs text-muted-foreground">{c.email}</p>
                                    )}
                                    {c.lineId && (
                                        <Badge variant="outline" className="text-[10px]">
                                            {c.lineId}
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-xs text-muted-foreground">ออเดอร์</p>
                                        <p className="font-medium">{c.orderCount} ครั้ง</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">ยอดซื้อรวม</p>
                                        <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                            ฿{c.totalPurchased.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-2 text-right text-xs text-muted-foreground">
                                    ออเดอร์ล่าสุด {c.lastOrderAt}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ลูกค้า</TableHead>
                                <TableHead>ช่องทางติดต่อ</TableHead>
                                <TableHead className="text-right">ออเดอร์</TableHead>
                                <TableHead className="text-right">ยอดซื้อรวม</TableHead>
                                <TableHead className="text-right">ออเดอร์ล่าสุด</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="text-xs bg-muted">
                                                    {initials(c.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium">{c.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    ลูกค้าตั้งแต่ {c.createdAt}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-0.5">
                                            {c.phone && <div className="text-sm">{c.phone}</div>}
                                            {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                                            {c.lineId && (
                                                <Badge variant="outline" className="text-[10px] h-4">
                                                    {c.lineId}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="font-medium">{c.orderCount}</span>
                                        <span className="text-muted-foreground text-xs"> ครั้ง</span>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                        ฿{c.totalPurchased.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {c.lastOrderAt}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>ดูประวัติ</DropdownMenuItem>
                                                <DropdownMenuItem>แก้ไขข้อมูล</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive">ลบ</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                        แสดง {filtered.length} จาก {customers.length} รายการ
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
