"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Printer,
    Loader2,
    Inbox,
    Truck,
    BadgeCheck,
    Banknote,
    Phone,
    MapPin,
    CheckCircle2,
    Clock,
    CreditCard,
    MessageSquare,
    Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { confirmShipment, confirmOverpayRefund, cancelAwaitingPaymentOrder } from "./actions"

export interface OrderRow {
    id: string
    customerName: string
    phone: string
    address: string
    postalCode: string | null
    paymentMethod: "TRANSFER" | "COD"
    totalAmount: number | null
    paidAmount: number
    amount: number | null
    items: string | null
    slipVerified: boolean
    slipImageUrl: string | null
    paymentStatus: "PENDING" | "PARTIAL_PAID" | "PAID" | "PENDING_REFUND" | "CANCELLED"
    overpaidAmount: number
    status: "COLLECTING" | "PENDING_FULFILLMENT" | "SHIPPED" | "CANCELLED"
    trackingNumber: string | null
    createdAt: string
}

interface OrdersTableProps {
    rows: OrderRow[]
    initialTab?: "fulfillment" | "payment"
}

const SENDER = {
    name: "Smart Electronic Shop",
    line1: "123 ถนนสุขุมวิท แขวงคลองเตย",
    line2: "เขตคลองเตย กรุงเทพฯ 10110",
    phone: "02-000-0000",
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
}

function isAwaitingPayment(order: OrderRow): boolean {
    return (
        (order.paymentStatus === "PENDING" || order.paymentStatus === "PARTIAL_PAID") &&
        order.status !== "SHIPPED" &&
        order.status !== "CANCELLED"
    )
}

function filterFulfillmentRows(rows: OrderRow[]): OrderRow[] {
    return rows.filter(
        (r) =>
            r.status === "PENDING_FULFILLMENT" ||
            r.status === "SHIPPED" ||
            r.paymentStatus === "PENDING_REFUND"
    )
}

function filterPaymentRows(rows: OrderRow[]): OrderRow[] {
    return rows.filter(isAwaitingPayment)
}

function orderTotal(order: OrderRow): number {
    return order.totalAmount ?? order.amount ?? 0
}

/** Open a printable shipping label in a new window and trigger print. */
function printLabel(order: OrderRow, trackingNumber: string) {
    const win = window.open("", "_blank", "width=520,height=720")
    if (!win) {
        toast.error("เบราว์เซอร์บล็อกป๊อปอัป กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์ใบปะหน้า")
        return
    }

    const codBanner =
        order.paymentMethod === "COD"
            ? `<div class="cod">เก็บเงินปลายทาง (COD): ${
                  order.amount ? order.amount.toLocaleString("th-TH") : "-"
              } บาท</div>`
            : `<div class="paid">ชำระเงินแล้ว (โอนเงิน)</div>`

    const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" />
<title>ใบปะหน้าพัสดุ ${escapeHtml(trackingNumber)}</title>
<style>
  * { box-sizing: border-box; font-family: "Sarabun", "Tahoma", sans-serif; }
  body { margin: 0; padding: 16px; }
  .label { border: 2px solid #000; border-radius: 8px; padding: 16px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; }
  .tracking { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .barcode { font-family: "Libre Barcode 39", monospace; font-size: 14px; word-break: break-all; }
  h2 { margin: 4px 0; font-size: 13px; text-transform: uppercase; color: #555; }
  .box { border-top: 1px dashed #999; margin-top: 10px; padding-top: 10px; }
  .name { font-size: 18px; font-weight: 700; }
  .addr { font-size: 15px; line-height: 1.5; }
  .cod { margin-top: 12px; padding: 8px; background: #fff3cd; border: 1px solid #f0ad4e; font-weight: 700; text-align: center; }
  .paid { margin-top: 12px; padding: 8px; background: #e6f4ea; border: 1px solid #34a853; font-weight: 700; text-align: center; }
  @media print { @page { margin: 8mm; } }
</style></head>
<body>
  <div class="label">
    <div class="row">
      <div>
        <h2>เลขพัสดุ / Tracking</h2>
        <div class="tracking">${escapeHtml(trackingNumber)}</div>
      </div>
      <div style="text-align:right">
        <h2>วันที่</h2>
        <div>${new Date().toLocaleDateString("th-TH")}</div>
      </div>
    </div>

    <div class="box">
      <h2>ผู้ส่ง / From</h2>
      <div class="name">${escapeHtml(SENDER.name)}</div>
      <div class="addr">${escapeHtml(SENDER.line1)}<br/>${escapeHtml(
          SENDER.line2
      )}<br/>โทร. ${escapeHtml(SENDER.phone)}</div>
    </div>

    <div class="box">
      <h2>ผู้รับ / To</h2>
      <div class="name">${escapeHtml(order.customerName)}</div>
      <div class="addr">${escapeHtml(order.address)} ${escapeHtml(
          order.postalCode ?? ""
      )}<br/>โทร. ${escapeHtml(order.phone)}</div>
    </div>

    ${codBanner}
  </div>
  <script>window.onload = function () { window.print(); }</script>
</body></html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
}

function PaymentBadge({ order }: { order: OrderRow }) {
    if (order.paymentStatus === "PENDING_REFUND") {
        return (
            <Badge variant="destructive" className="gap-1">
                ⚠️ รอคืนเงิน (Overpaid: {order.overpaidAmount.toLocaleString("th-TH")} THB)
            </Badge>
        )
    }
    if (order.paymentStatus === "PARTIAL_PAID") {
        return (
            <Badge variant="outline" className="gap-1 border-amber-400 bg-amber-50 text-amber-800">
                ชำระบางส่วน {order.paidAmount.toLocaleString("th-TH")}/
                {orderTotal(order).toLocaleString("th-TH")} บาท
            </Badge>
        )
    }
    if (order.paymentStatus === "PENDING" && order.paidAmount <= 0) {
        const total = orderTotal(order)
        return (
            <Badge
                variant="outline"
                className="gap-1 border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
            >
                <CreditCard className="h-3 w-3" />
                รอชำระเงิน{total > 0 ? ` ${total.toLocaleString("th-TH")} บาท` : ""}
            </Badge>
        )
    }
    if (order.paymentMethod === "COD") {
        return (
            <Badge
                variant="outline"
                className="gap-1 border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-400"
            >
                <Banknote className="h-3 w-3" />
                เก็บเงินปลายทาง
            </Badge>
        )
    }
    if (order.slipVerified) {
        return (
            <Badge
                variant="outline"
                className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
            >
                <BadgeCheck className="h-3 w-3" />
                โอนเงิน • ตรวจสอบแล้ว
            </Badge>
        )
    }
    return (
        <Badge
            variant="outline"
            className="gap-1 border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-400"
        >
            <Clock className="h-3 w-3" />
            โอนเงิน • รอตรวจสลิป
        </Badge>
    )
}

function StatusBadge({ order }: { order: OrderRow }) {
    if (order.status === "COLLECTING") {
        return (
            <Badge
                variant="outline"
                className="gap-1 border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
            >
                <CreditCard className="h-3 w-3" />
                รอชำระเงิน
            </Badge>
        )
    }
    if (order.status === "SHIPPED") {
        return (
            <div className="flex flex-col gap-0.5">
                <Badge className="w-fit gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    ส่งแล้ว
                </Badge>
                {order.trackingNumber && (
                    <span className="font-mono text-xs text-muted-foreground">
                        {order.trackingNumber}
                    </span>
                )}
            </div>
        )
    }
    if (order.status === "CANCELLED") {
        return <Badge variant="secondary">ยกเลิก</Badge>
    }
    return (
        <Badge
            variant="outline"
            className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
        >
            <Truck className="h-3 w-3" />
            รอแพ็คของ
        </Badge>
    )
}

function OrderActions({
    order,
    rowBusy,
    isPending,
    onShip,
    onRefund,
    onCancel,
    fullWidth,
}: {
    order: OrderRow
    rowBusy: boolean
    isPending: boolean
    onShip: (order: OrderRow) => void
    onRefund: (orderId: string) => void
    onCancel: (order: OrderRow) => void
    fullWidth?: boolean
}) {
    const btnClass = fullWidth ? "h-11 w-full gap-1.5" : "gap-1.5"

    if (isAwaitingPayment(order)) {
        return (
            <Button
                size="sm"
                variant="outline"
                className={`${btnClass} border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40`}
                disabled={isPending}
                onClick={() => onCancel(order)}
            >
                {rowBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                )}
                ยกเลิก / ลบออก
            </Button>
        )
    }

    if (order.status === "SHIPPED") {
        return (
            <Button
                size="sm"
                variant="outline"
                className={btnClass}
                onClick={() => order.trackingNumber && printLabel(order, order.trackingNumber)}
            >
                <Printer className="h-3.5 w-3.5" />
                {fullWidth ? "พิมพ์ใบปะหน้าซ้ำ" : "พิมพ์ซ้ำ"}
            </Button>
        )
    }

    if (order.paymentStatus === "PENDING_REFUND") {
        return (
            <Button
                size="sm"
                variant="destructive"
                className={btnClass}
                disabled={isPending}
                onClick={() => onRefund(order.id)}
            >
                {rowBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                คืนเงินและยืนยันออเดอร์
            </Button>
        )
    }

    return (
        <Button
            size="sm"
            className={`${btnClass} bg-indigo-600 hover:bg-indigo-700`}
            disabled={isPending}
            onClick={() => onShip(order)}
        >
            {rowBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Printer className="h-3.5 w-3.5" />
            )}
            {fullWidth ? (
                "พิมพ์ใบปะหน้าและยืนยันการส่ง"
            ) : (
                <>
                    <span className="hidden sm:inline">พิมพ์ใบปะหน้าและยืนยันการส่ง</span>
                    <span className="sm:hidden">ยืนยันส่ง</span>
                </>
            )}
        </Button>
    )
}

function TabEmptyState({ tab }: { tab: "fulfillment" | "payment" }) {
    if (tab === "payment") {
        return (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center text-muted-foreground">
                <CreditCard className="h-10 w-10 opacity-40" />
                <div>
                    <p className="text-sm font-medium">ไม่มีออเดอร์รอชำระเงิน</p>
                    <p className="text-xs">
                        เมื่อ AI สร้างออเดอร์และรอลูกค้าโอนเงิน รายการจะปรากฏในแท็บนี้
                    </p>
                </div>
                <Button asChild size="sm" variant="outline" className="mt-1 gap-1.5">
                    <Link href="/dashboard/chat">
                        <MessageSquare className="h-3.5 w-3.5" />
                        เปิดแชทสด
                    </Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 opacity-40" />
            <div>
                <p className="text-sm font-medium">ยังไม่มีออเดอร์พร้อมแพ็ค</p>
                <p className="text-xs">
                    เมื่อผู้ช่วยขาย AI เก็บข้อมูลจัดส่งครบและชำระเงินแล้ว ออเดอร์จะปรากฏที่นี่
                </p>
            </div>
        </div>
    )
}

function OrderList({
    rows,
    busyId,
    isPending,
    onShip,
    onRefund,
    onCancel,
}: {
    rows: OrderRow[]
    busyId: string | null
    isPending: boolean
    onShip: (order: OrderRow) => void
    onRefund: (orderId: string) => void
    onCancel: (order: OrderRow) => void
}) {
    if (rows.length === 0) return null

    return (
        <>
            <div className="space-y-3 lg:hidden">
                {rows.map((order) => {
                    const rowBusy = busyId === order.id
                    return (
                        <div key={order.id} className="rounded-lg border bg-card p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-medium">{order.customerName}</p>
                                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                        <Phone className="h-3 w-3 shrink-0" />
                                        {order.phone || "—"}
                                    </div>
                                </div>
                                <p className="shrink-0 text-right font-semibold tabular-nums">
                                    {orderTotal(order) > 0
                                        ? `${orderTotal(order).toLocaleString("th-TH")} ฿`
                                        : "—"}
                                </p>
                            </div>

                            {order.items && (
                                <p className="mt-2 text-xs text-muted-foreground">{order.items}</p>
                            )}

                            {(order.address || order.postalCode) && (
                                <div className="mt-2 flex gap-1 text-xs text-muted-foreground">
                                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>
                                        {order.address} {order.postalCode ?? ""}
                                    </span>
                                </div>
                            )}

                            <div className="mt-3 flex flex-wrap gap-2">
                                <PaymentBadge order={order} />
                                <StatusBadge order={order} />
                            </div>

                            {order.paymentMethod === "TRANSFER" && order.slipImageUrl && (
                                <a
                                    href={order.slipImageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-block"
                                    title="เปิดดูสลิปขนาดเต็ม"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={order.slipImageUrl}
                                        alt="สลิปการโอนเงิน"
                                        className="h-24 w-auto rounded-md border object-cover"
                                    />
                                </a>
                            )}

                            <div className="mt-4">
                                <OrderActions
                                    order={order}
                                    rowBusy={rowBusy}
                                    isPending={isPending}
                                    onShip={onShip}
                                    onRefund={onRefund}
                                    onCancel={onCancel}
                                    fullWidth
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border lg:block">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40">
                            <TableHead>ผู้รับ / ติดต่อ</TableHead>
                            <TableHead className="hidden lg:table-cell">ที่อยู่จัดส่ง</TableHead>
                            <TableHead>การชำระเงิน</TableHead>
                            <TableHead className="text-right">ยอด (บาท)</TableHead>
                            <TableHead className="hidden sm:table-cell text-center">สถานะ</TableHead>
                            <TableHead className="text-right">การดำเนินการ</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((order) => {
                            const rowBusy = busyId === order.id
                            return (
                                <TableRow key={order.id}>
                                    <TableCell className="align-top">
                                        <div className="font-medium">{order.customerName}</div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Phone className="h-3 w-3" />
                                            {order.phone || "—"}
                                        </div>
                                        {order.items && (
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {order.items}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-xs align-top whitespace-normal text-sm hidden lg:table-cell">
                                        <div className="flex gap-1">
                                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span>
                                                {order.address} {order.postalCode ?? ""}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex flex-col gap-1.5">
                                            <PaymentBadge order={order} />
                                            <div className="sm:hidden">
                                                <StatusBadge order={order} />
                                            </div>
                                            {order.paymentMethod === "TRANSFER" && order.slipImageUrl && (
                                                <a
                                                    href={order.slipImageUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="เปิดดูสลิปขนาดเต็ม"
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={order.slipImageUrl}
                                                        alt="สลิปการโอนเงิน"
                                                        className="h-24 w-auto rounded-md border object-cover transition hover:opacity-80"
                                                    />
                                                </a>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right align-top tabular-nums">
                                        {orderTotal(order) > 0
                                            ? orderTotal(order).toLocaleString("th-TH")
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="hidden text-center align-top sm:table-cell">
                                        <StatusBadge order={order} />
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex flex-col items-end gap-2">
                                            <OrderActions
                                                order={order}
                                                rowBusy={rowBusy}
                                                isPending={isPending}
                                                onShip={onShip}
                                                onRefund={onRefund}
                                                onCancel={onCancel}
                                            />
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

export default function OrdersTable({ rows, initialTab = "fulfillment" }: OrdersTableProps) {
    const router = useRouter()
    const [busyId, setBusyId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const fulfillmentRows = useMemo(() => filterFulfillmentRows(rows), [rows])
    const paymentRows = useMemo(() => filterPaymentRows(rows), [rows])

    function handleShip(order: OrderRow) {
        if (isPending) return
        setBusyId(order.id)
        startTransition(async () => {
            const result = await confirmShipment(order.id)
            if (result.ok) {
                toast.success(result.message, {
                    description: `${order.customerName} • ${result.trackingNumber ?? ""}`,
                })
                if (result.trackingNumber) {
                    printLabel(order, result.trackingNumber)
                }
            } else {
                toast.error(result.message)
            }
            setBusyId(null)
        })
    }

    function handleRefund(orderId: string) {
        if (isPending) return
        setBusyId(orderId)
        startTransition(async () => {
            const result = await confirmOverpayRefund(orderId)
            if (result.ok) {
                toast.success(result.message)
            } else {
                toast.error(result.message)
            }
            setBusyId(null)
        })
    }

    function handleCancel(order: OrderRow) {
        if (isPending) return
        if (
            !window.confirm(
                `ยกเลิกออเดอร์ของ ${order.customerName} และนำออกจากรายการรอชำระเงิน?`
            )
        ) {
            return
        }
        setBusyId(order.id)
        startTransition(async () => {
            const result = await cancelAwaitingPaymentOrder(order.id)
            if (result.ok) {
                toast.success(result.message)
                router.refresh()
            } else {
                toast.error(result.message)
            }
            setBusyId(null)
        })
    }

    return (
        <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className="grid h-10 w-full grid-cols-2 lg:max-w-md">
                <TabsTrigger value="fulfillment" className="gap-1.5 text-sm">
                    <Truck className="h-3.5 w-3.5" />
                    รอแพ็ค/จัดส่ง
                    {fulfillmentRows.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                            {fulfillmentRows.length}
                        </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="payment" className="gap-1.5 text-sm">
                    <CreditCard className="h-3.5 w-3.5" />
                    รอชำระเงิน
                    {paymentRows.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                            {paymentRows.length}
                        </Badge>
                    )}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="fulfillment" className="mt-4">
                {fulfillmentRows.length === 0 ? (
                    <TabEmptyState tab="fulfillment" />
                ) : (
                    <OrderList
                        rows={fulfillmentRows}
                        busyId={busyId}
                        isPending={isPending}
                        onShip={handleShip}
                        onRefund={handleRefund}
                        onCancel={handleCancel}
                    />
                )}
            </TabsContent>

            <TabsContent value="payment" className="mt-4">
                {paymentRows.length === 0 ? (
                    <TabEmptyState tab="payment" />
                ) : (
                    <OrderList
                        rows={paymentRows}
                        busyId={busyId}
                        isPending={isPending}
                        onShip={handleShip}
                        onRefund={handleRefund}
                        onCancel={handleCancel}
                    />
                )}
            </TabsContent>
        </Tabs>
    )
}
