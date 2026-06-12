"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { cn } from "@/lib/utils"
import { Plus, Search, MoreHorizontal, Package, Upload, Loader2 } from "lucide-react"
import {
    type ProductDTO,
    createProductAction,
    deleteProductAction,
    importInventoryAction,
    toggleProductActiveAction,
    updateProductAction,
} from "./actions"



interface ProductFormProps {
    product?: ProductDTO
    onClose: () => void
    onSaved: () => void
}

function ProductForm({ product, onClose, onSaved }: ProductFormProps) {
    const [sku, setSku] = useState(product?.sku ?? "")
    const [name, setName] = useState(product?.name ?? "")
    const [description, setDescription] = useState(product?.description ?? "")
    const [category, setCategory] = useState(product?.category ?? "")
    const [price, setPrice] = useState(product ? String(product.price) : "")
    const [stock, setStock] = useState(product ? String(product.stock) : "0")
    const [unit, setUnit] = useState(product?.unit ?? "ชิ้น")
    const [saving, setSaving] = useState(false)

    async function handleSubmit() {
        setSaving(true)
        const input = {
            sku: sku || undefined,
            name,
            description: description || undefined,
            category: category || undefined,
            price: Number(price),
            stock: Number(stock),
            unit: unit || undefined,
        }
        const result = product
            ? await updateProductAction(product.id, input)
            : await createProductAction(input)
        setSaving(false)
        if (result.ok) {
            toast.success(result.message)
            onSaved()
            onClose()
        } else {
            toast.error(result.message)
        }
    }

    return (
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="prod-sku">SKU / รหัสสินค้า</Label>
                    <Input id="prod-sku" placeholder="P001" value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="prod-category">หมวดหมู่</Label>
                    <Input id="prod-category" placeholder="Case, Charger..." value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="prod-name">ชื่อสินค้า/บริการ *</Label>
                <Input id="prod-name" placeholder="เคสใสกันกระแทก" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="prod-desc">คำอธิบาย</Label>
                <Input id="prod-desc" placeholder="รายละเอียดสินค้า" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <Label htmlFor="prod-price">ราคา (฿) *</Label>
                    <Input id="prod-price" type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="prod-stock">สต็อก</Label>
                    <Input id="prod-stock" type="number" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="prod-unit">หน่วย</Label>
                    <Input id="prod-unit" placeholder="ชิ้น" value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={saving}>
                    ยกเลิก
                </Button>
                <Button onClick={handleSubmit} disabled={saving || !name || !price}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    บันทึก
                </Button>
            </DialogFooter>
        </div>
    )
}

function ImportDialog({ onImported }: { onImported: () => void }) {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [mode, setMode] = useState<"APPEND" | "FULL_SYNC">("APPEND")
    const [importing, setImporting] = useState(false)

    async function handleImport() {
        if (!file) {
            toast.error("กรุณาเลือกไฟล์")
            return
        }
        setImporting(true)
        const formData = new FormData()
        formData.append("file", file)
        formData.append("mode", mode)
        const result = await importInventoryAction(formData)
        setImporting(false)

        if (result.ok) {
            toast.success(result.message)
            if (result.summary?.errors.length) {
                toast.warning(`มีบางแถวถูกข้าม (${result.summary.errors.length} รายการ)`)
            }
            onImported()
            setOpen(false)
            setFile(null)
        } else {
            toast.error(result.message)
        }
    }

    const modeOptions = [
        {
            value: "APPEND" as const,
            title: "อัปเดตและเพิ่มใหม่ (Append/Upsert)",
            desc: "อัปเดตสินค้าที่มี SKU ตรงกัน และเพิ่มสินค้าใหม่ — สินค้าเดิมที่ไม่อยู่ในไฟล์จะคงไว้เหมือนเดิม (ปลอดภัยที่สุด)",
        },
        {
            value: "FULL_SYNC" as const,
            title: "ซิงค์สมบูรณ์ / แทนที่คลัง (Full Sync)",
            desc: "อัปเดต/เพิ่มตามไฟล์ และปิดใช้งานสินค้าเดิมที่ไม่อยู่ในไฟล์นี้ เพื่อให้คลังตรงกับไฟล์ล่าสุดเป๊ะ",
        },
    ]

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Upload className="h-4 w-4" />
                    นำเข้าไฟล์สินค้า
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>นำเข้าสินค้าจากไฟล์ (CSV / Excel)</DialogTitle>
                    <DialogDescription>
                        ไฟล์ต้องมีคอลัมน์ SKU (หรือ id), ชื่อสินค้า (name) และราคา (price) เป็นอย่างน้อย
                        — รองรับคอลัมน์เพิ่มเติม: category, description, stock, unit
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="import-file">เลือกไฟล์</Label>
                        <Input
                            id="import-file"
                            type="file"
                            accept=".csv,.xlsx,.xls,.txt"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>โหมดการนำเข้า</Label>
                        <div className="grid gap-2">
                            {modeOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setMode(opt.value)}
                                    className={cn(
                                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                                        mode === opt.value
                                            ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40"
                                            : "hover:bg-muted/60"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                                            mode === opt.value ? "border-violet-500" : "border-muted-foreground/40"
                                        )}
                                    >
                                        {mode === opt.value && (
                                            <div className="h-2 w-2 rounded-full bg-violet-500" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{opt.title}</p>
                                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleImport} disabled={importing || !file}>
                        {importing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        นำเข้า
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function ProductsContent({ initialProducts }: { initialProducts: ProductDTO[] }) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [addOpen, setAddOpen] = useState(false)
    const [editing, setEditing] = useState<ProductDTO | null>(null)
    const [, startTransition] = useTransition()

    const refresh = () => startTransition(() => router.refresh())

    const filtered = initialProducts.filter(
        (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (p.category ?? "").toLowerCase().includes(search.toLowerCase())
    )

    const activeCount = initialProducts.filter((p) => p.isActive).length
    const totalSold = initialProducts.reduce((s, p) => s + p.soldCount, 0)
    const totalRevenue = initialProducts.reduce((s, p) => s + p.price * p.soldCount, 0)

    async function handleToggle(p: ProductDTO) {
        const result = await toggleProductActiveAction(p.id)
        if (result.ok) {
            toast.success(result.message)
            refresh()
        } else {
            toast.error(result.message)
        }
    }

    async function handleDelete(p: ProductDTO) {
        const result = await deleteProductAction(p.id)
        if (result.ok) {
            toast.success(result.message)
            refresh()
        } else {
            toast.error(result.message)
        }
    }

    const stats = [
        {
            label: "สินค้าทั้งหมด",
            value: `${initialProducts.length} รายการ`,
            sub: `${activeCount} ใช้งานอยู่`,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-950",
        },
        {
            label: "ยอดขายรวม",
            value: `${totalSold} ชิ้น`,
            sub: "ทุกสินค้า",
            color: "text-violet-600",
            bg: "bg-violet-50 dark:bg-violet-950",
        },
        {
            label: "รายได้จากการขาย",
            value: `฿${totalRevenue.toLocaleString()}`,
            sub: "จากยอดขายรวม",
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-950",
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight sm:text-2xl">สินค้า/บริการ</h1>
                    <p className="text-sm text-muted-foreground">
                        จัดการคลังสินค้าจริง — เพิ่มทีละรายการ หรือ นำเข้าจากไฟล์ CSV/Excel
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ImportDialog onImported={refresh} />
                    <Dialog open={addOpen} onOpenChange={setAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="gap-2">
                                <Plus className="h-4 w-4" />
                                เพิ่มสินค้า
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>เพิ่มสินค้า/บริการ</DialogTitle>
                                <DialogDescription>เพิ่มรายการสินค้าหรือบริการใหม่เข้าระบบ</DialogDescription>
                            </DialogHeader>
                            <ProductForm onClose={() => setAddOpen(false)} onSaved={refresh} />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((s) => (
                    <Card key={s.label}>
                        <CardContent className="flex items-center gap-4 pt-5">
                            <div className={`rounded-lg p-2.5 ${s.bg}`}>
                                <Package className={`h-5 w-5 ${s.color}`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{s.label}</p>
                                <p className="text-xl font-bold">{s.value}</p>
                                <p className="text-xs text-muted-foreground">{s.sub}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-base">รายการสินค้า/บริการ</CardTitle>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="ค้นหาชื่อ / SKU / หมวดหมู่..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 w-full pl-8 sm:w-64"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                            <Package className="h-10 w-10 opacity-40" />
                            <p className="text-sm">
                                {initialProducts.length === 0
                                    ? "ยังไม่มีสินค้า — เพิ่มสินค้าหรือ นำเข้าไฟล์ CSV/Excel เพื่อเริ่มต้น"
                                    : "ไม่พบสินค้าที่ตรงกับการค้นหา"}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile / tablet cards */}
                            <div className="space-y-3 lg:hidden">
                                {filtered.map((p) => (
                                    <div key={p.id} className="rounded-lg border bg-card p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-mono text-xs text-muted-foreground">
                                                    {p.sku ?? "—"}
                                                </p>
                                                <p className="font-medium">{p.name}</p>
                                                {p.description && (
                                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                        {p.description}
                                                    </p>
                                                )}
                                            </div>
                                            <Badge
                                                variant={p.isActive ? "default" : "secondary"}
                                                className={cn(
                                                    "shrink-0",
                                                    p.isActive &&
                                                        "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400"
                                                )}
                                            >
                                                {p.isActive ? "ใช้งาน" : "ปิด"}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {p.category && (
                                                <Badge variant="outline" className="text-xs">
                                                    {p.category}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <p className="text-xs text-muted-foreground">ราคา</p>
                                                <p className="font-semibold">
                                                    ฿{p.price.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-muted-foreground">สต็อก</p>
                                                <p className={cn("font-medium", p.stock <= 0 && "text-red-600")}>
                                                    {p.stock}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">ขายแล้ว</p>
                                                <p className="font-medium">{p.soldCount}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => setEditing(p)}
                                            >
                                                แก้ไข
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => handleToggle(p)}
                                            >
                                                {p.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop table */}
                            <div className="hidden lg:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>ชื่อสินค้า</TableHead>
                                    <TableHead>หมวดหมู่</TableHead>
                                    <TableHead className="text-right">ราคา</TableHead>
                                    <TableHead className="text-right">สต็อก</TableHead>
                                    <TableHead className="text-right">ขายแล้ว</TableHead>
                                    <TableHead>สถานะ</TableHead>
                                    <TableHead className="w-10" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {p.sku ?? "—"}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {p.name}
                                            {p.description && (
                                                <span className="block max-w-[260px] truncate text-xs font-normal text-muted-foreground">
                                                    {p.description}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {p.category ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-semibold">฿{p.price.toLocaleString()}</span>
                                            <span className="text-xs text-muted-foreground">/{p.unit}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={p.stock <= 0 ? "text-red-600" : ""}>{p.stock}</span>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{p.soldCount}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={p.isActive ? "default" : "secondary"}
                                                className={
                                                    p.isActive
                                                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400"
                                                        : ""
                                                }
                                            >
                                                {p.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setEditing(p)}>
                                                        แก้ไข
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleToggle(p)}>
                                                        {p.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleDelete(p)}
                                                    >
                                                        ลบ
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit dialog */}
            <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>แก้ไขสินค้า</DialogTitle>
                        <DialogDescription>แก้ไขรายละเอียดและราคาสินค้า</DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <ProductForm
                            product={editing}
                            onClose={() => setEditing(null)}
                            onSaved={refresh}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
