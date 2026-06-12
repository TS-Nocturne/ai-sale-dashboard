"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, X, Loader2, Inbox, Percent } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { decideApproval } from "./actions"

export interface ApprovalRow {
    id: string
    threadId: string
    customerName: string
    product: string
    discountPct: number
    reason: string | null
    originalPrice: number | null
}

interface ApprovalsTableProps {
    rows: ApprovalRow[]
}

export default function ApprovalsTable({ rows }: ApprovalsTableProps) {
    const router = useRouter()
    // Track the row + action currently being processed so we can show a spinner
    // on the exact button the manager clicked.
    const [busy, setBusy] = useState<{ id: string; action: "approve" | "reject" } | null>(
        null
    )
    const [isPending, startTransition] = useTransition()

    function handleDecision(row: ApprovalRow, action: "approve" | "reject") {
        if (isPending) return
        setBusy({ id: row.id, action })

        startTransition(async () => {
            const result = await decideApproval(row.id, row.threadId, action)
            if (result.ok) {
                toast.success(result.message, {
                    description: `${row.product} • ${row.discountPct}% • ${row.customerName}`,
                })
                router.refresh()
            } else {
                toast.error(result.message)
            }
            setBusy(null)
        })
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 opacity-40" />
                <div>
                    <p className="text-sm font-medium">ไม่มีคำขอส่วนลดที่รอการอนุมัติ</p>
                    <p className="text-xs">คำขอใหม่จากผู้ช่วยขาย AI จะปรากฏที่นี่โดยอัตโนมัติ</p>
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Mobile cards */}
            <div className="space-y-3 lg:hidden">
                {rows.map((row) => {
                    const rowBusy = busy?.id === row.id
                    return (
                        <div
                            key={row.id}
                            className="rounded-lg border bg-card p-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-medium">{row.customerName}</p>
                                    <p className="mt-1 text-sm">{row.product}</p>
                                    {row.originalPrice != null && (
                                        <p className="text-xs text-muted-foreground">
                                            ราคาปกติ {row.originalPrice.toLocaleString("th-TH")} บาท
                                        </p>
                                    )}
                                </div>
                                <Badge
                                    variant="outline"
                                    className="shrink-0 gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
                                >
                                    <Percent className="h-3 w-3" />
                                    {row.discountPct}%
                                </Badge>
                            </div>

                            {row.reason && (
                                <p className="mt-3 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
                                    {row.reason}
                                </p>
                            )}

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <Button
                                    size="sm"
                                    className="h-11 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                    disabled={isPending}
                                    onClick={() => handleDecision(row, "approve")}
                                >
                                    {rowBusy && busy?.action === "approve" ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Check className="h-3.5 w-3.5" />
                                    )}
                                    อนุมัติ
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-11 gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                                    disabled={isPending}
                                    onClick={() => handleDecision(row, "reject")}
                                >
                                    {rowBusy && busy?.action === "reject" ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <X className="h-3.5 w-3.5" />
                                    )}
                                    ปฏิเสธ
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Desktop table */}
            <div className="hidden rounded-lg border lg:block">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/40">
                        <TableHead>ลูกค้า</TableHead>
                        <TableHead>สินค้า</TableHead>
                        <TableHead className="text-center">ส่วนลดที่ขอ</TableHead>
                        <TableHead>เหตุผล</TableHead>
                        <TableHead className="text-right">การดำเนินการ</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => {
                        const rowBusy = busy?.id === row.id
                        return (
                            <TableRow key={row.id}>
                                <TableCell className="font-medium">
                                    {row.customerName}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{row.product}</span>
                                        {row.originalPrice != null && (
                                            <span className="text-xs text-muted-foreground">
                                                ราคาปกติ{" "}
                                                {row.originalPrice.toLocaleString("th-TH")} บาท
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge
                                        variant="outline"
                                        className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
                                    >
                                        <Percent className="h-3 w-3" />
                                        {row.discountPct}%
                                    </Badge>
                                </TableCell>
                                <TableCell className="max-w-xs whitespace-normal text-sm text-muted-foreground">
                                    {row.reason ?? "—"}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                            disabled={isPending}
                                            onClick={() => handleDecision(row, "approve")}
                                        >
                                            {rowBusy && busy?.action === "approve" ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Check className="h-3.5 w-3.5" />
                                            )}
                                            อนุมัติ
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                                            disabled={isPending}
                                            onClick={() => handleDecision(row, "reject")}
                                        >
                                            {rowBusy && busy?.action === "reject" ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <X className="h-3.5 w-3.5" />
                                            )}
                                            ปฏิเสธ
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
            </div>
        </>
    )
}
