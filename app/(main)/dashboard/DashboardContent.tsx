"use client"

import Link from "next/link"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardEmptyState } from "@/components/dashboard/empty-state"
import {
    Users,
    TrendingUp,

    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
    BadgeCheck,
    Headset,
    MessageSquare,
    Package,
    CreditCard,
    BarChart3,
    Inbox,
    Receipt,
    UserPlus,
    type LucideIcon,
} from "lucide-react"
import {
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    ComposedChart,
    Line,
} from "recharts"
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

// ── Types ────────────────────────────────────────────────────────────────────

export type DashboardRole = "user" | "manager" | "admin"

export interface DashboardData {
    totalLeads: number
    newLeadsToday: number
    newLeadsYesterday: number
    wonLeads: number
    closeRate: number
    customerCount: number
    conversationCount: number
    lineConversationCount: number
    pausedChats: number
    pendingApprovals: number
    openOrders: number
    awaitingPaymentOrders: number
    paidOrders: number
    totalOrders: number
    userCount: number
    revenueThisMonth: number
    revenuePrevMonth: number
    totalRevenue: number
    salesCount: number
    leadsByStatus: { status: string; count: number }[]
    leadsBySource: { source: string; label: string; count: number }[]
    monthly: { month: string; revenue: number; leads: number }[]
    recentLeads: {
        id: string
        name: string
        phone: string
        source: string
        status: string
        budget: number
        createdAt: string
    }[]
}

interface DashboardContentProps {
    role: DashboardRole
    userName: string
    data: DashboardData
}

// ── Static config ──────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
    NEW: { label: "ใหม่", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    CONTACTED: { label: "ติดต่อแล้ว", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
    QUALIFIED: { label: "คัดกรองแล้ว", className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400" },
    PROPOSAL: { label: "เสนอราคา", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
    NEGOTIATION: { label: "เจรจา", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" },
    WON: { label: "ปิดการขาย ✓", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
    LOST: { label: "เสียลีด", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
}

const sourceLabels: Record<string, string> = {
    FACEBOOK: "Facebook",
    LINE: "Line",
    INSTAGRAM: "Instagram",
    TIKTOK: "TikTok",
    REFERRAL: "แนะนำ",
    WEBSITE: "Website",
    COLD_CALL: "Cold Call",
    OTHER: "อื่นๆ",
}

const roleBadge: Record<DashboardRole, { label: string; className: string }> = {
    admin: { label: "ผู้ดูแลระบบ", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
    manager: { label: "ผู้จัดการ", className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400" },
    user: { label: "พนักงานขาย", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
}

const revenueChartConfig = {
    revenue: { label: "รายได้ (฿)", color: "var(--chart-1)" },
    leads: { label: "ลีด", color: "var(--chart-2)" },
} satisfies ChartConfig

const PIPELINE_ORDER = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL",
    "NEGOTIATION",
    "WON",
    "LOST",
] as const

const SOURCE_BAR_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "hsl(var(--muted-foreground))",
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBaht(n: number): string {
    return `฿${Math.round(n).toLocaleString("th-TH")}`
}

function pctChange(current: number, prev: number): { text: string; positive: boolean } {
    if (prev <= 0) {
        return current > 0
            ? { text: "ใหม่", positive: true }
            : { text: "0%", positive: true }
    }
    const change = ((current - prev) / prev) * 100
    return {
        text: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
        positive: change >= 0,
    }
}

interface Kpi {
    title: string
    value: string
    change?: string
    positive?: boolean
    description: string
    icon: LucideIcon
    iconColor: string
    iconBg: string
    accent: string
    progress?: number
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DashboardContent({ role, userName, data }: DashboardContentProps) {
    const isStaff = role === "manager" || role === "admin"
    const badge = roleBadge[role]

    const revChange = pctChange(data.revenueThisMonth, data.revenuePrevMonth)
    const leadChange = pctChange(data.newLeadsToday, data.newLeadsYesterday)

    const statusCounts = new Map(data.leadsByStatus.map((s) => [s.status, s.count]))
    const pipelineData = PIPELINE_ORDER.map((status) => ({
        status,
        label: statusConfig[status]?.label ?? status,
        count: statusCounts.get(status) ?? 0,
        className: statusConfig[status]?.className ?? "",
    })).filter((s) => s.count > 0 || ["NEW", "WON", "LOST"].includes(s.status))

    const maxPipeline = Math.max(...pipelineData.map((s) => s.count), 1)
    const totalSourceLeads = data.leadsBySource.reduce((sum, s) => sum + s.count, 0)
    const sourceWithPct = data.leadsBySource.map((s) => ({
        ...s,
        pct: totalSourceLeads > 0 ? (s.count / totalSourceLeads) * 100 : 0,
    }))

    const todayLabel = new Intl.DateTimeFormat("th-TH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date())

    const hasMonthlyData = data.monthly.some((m) => m.revenue > 0 || m.leads > 0)
    const hasLeads = data.totalLeads > 0
    const hasSales = data.salesCount > 0
    const hasOrders = data.totalOrders > 0

    const kpis: Kpi[] = isStaff
        ? [
              {
                  title: "รายได้เดือนนี้",
                  value: formatBaht(data.revenueThisMonth),
                  change: revChange.text,
                  positive: revChange.positive,
                  description: "เทียบเดือนก่อน",
                  icon: DollarSign,
                  iconColor: "text-emerald-600",
                  iconBg: "bg-emerald-50 dark:bg-emerald-950",
                  accent: "border-l-emerald-500",
              },
              {
                  title: "ลีดทั้งหมด",
                  value: data.totalLeads.toLocaleString("th-TH"),
                  change: leadChange.text,
                  positive: leadChange.positive,
                  description: `ใหม่วันนี้ +${data.newLeadsToday}`,
                  icon: Users,
                  iconColor: "text-blue-600",
                  iconBg: "bg-blue-50 dark:bg-blue-950",
                  accent: "border-l-blue-500",
              },
              {
                  title: "อัตราปิดการขาย",
                  value: `${data.closeRate.toFixed(1)}%`,
                  description: `${data.wonLeads} / ${data.totalLeads} ลีด`,
                  icon: TrendingUp,
                  iconColor: "text-violet-600",
                  iconBg: "bg-violet-50 dark:bg-violet-950",
                  accent: "border-l-violet-500",
                  progress: data.closeRate,
              },
              {
                  title: "ออเดอร์ชำระแล้ว",
                  value: data.paidOrders.toLocaleString("th-TH"),
                  description: `จาก ${data.totalOrders.toLocaleString("th-TH")} ออเดอร์ทั้งหมด`,
                  icon: CreditCard,
                  iconColor: "text-emerald-600",
                  iconBg: "bg-emerald-50 dark:bg-emerald-950",
                  accent: "border-l-emerald-500",
              },
          ]
        : [
              {
                  title: "ลีดทั้งหมด",
                  value: data.totalLeads.toLocaleString("th-TH"),
                  change: leadChange.text,
                  positive: leadChange.positive,
                  description: `ใหม่วันนี้ +${data.newLeadsToday}`,
                  icon: Users,
                  iconColor: "text-blue-600",
                  iconBg: "bg-blue-50 dark:bg-blue-950",
                  accent: "border-l-blue-500",
              },
              {
                  title: "ปิดการขายแล้ว",
                  value: data.wonLeads.toLocaleString("th-TH"),
                  description: "ลีดที่ปิดสำเร็จ",
                  icon: TrendingUp,
                  iconColor: "text-emerald-600",
                  iconBg: "bg-emerald-50 dark:bg-emerald-950",
                  accent: "border-l-emerald-500",
              },
              {
                  title: "แชท LINE / AI",
                  value: data.lineConversationCount.toLocaleString("th-TH"),
                  description: `จากทั้งหมด ${data.conversationCount} บทสนทนา`,
                  icon: MessageSquare,
                  iconColor: "text-violet-600",
                  iconBg: "bg-violet-50 dark:bg-violet-950",
                  accent: "border-l-violet-500",
              },
              {
                  title: "ลูกค้าในระบบ",
                  value: data.customerCount.toLocaleString("th-TH"),
                  description: "ฐานลูกค้าทั้งหมด",
                  icon: Users,
                  iconColor: "text-sky-600",
                  iconBg: "bg-sky-50 dark:bg-sky-950",
                  accent: "border-l-sky-500",
              },
          ]

    return (
        <div className="space-y-6">
            {/* Greeting */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                        สวัสดี, {userName}
                        <Badge className={`text-xs ${badge.className}`}>{badge.label}</Badge>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {isStaff
                            ? "ภาพรวมการขายและการดูแลลูกค้าด้วย AI แบบเรียลไทม์"
                            : "ภาพรวมการทำงานของคุณ และผู้ช่วยขาย AI"}
                    </p>
                </div>
                <Button asChild size="sm" className="gap-1.5 w-fit">
                    <Link href="/dashboard/assistant">
                        <Sparkles className="h-3.5 w-3.5" />
                        เปิดผู้ช่วยขาย AI
                    </Link>
                </Button>
            </div>

            {/* Operational alerts — manager/admin only */}
            {isStaff && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <ActionCard
                        href="/dashboard/approvals"
                        icon={BadgeCheck}
                        title="รออนุมัติส่วนลด"
                        count={data.pendingApprovals}
                        cta="ศูนย์อนุมัติ"
                        tone={data.pendingApprovals > 0 ? "amber" : "neutral"}
                    />
                    <ActionCard
                        href="/dashboard/chat"
                        icon={Headset}
                        title="ลูกค้ารอเจ้าหน้าที่"
                        count={data.pausedChats}
                        cta="แชทสด"
                        tone={data.pausedChats > 0 ? "red" : "neutral"}
                    />
                    <ActionCard
                        href="/dashboard/orders"
                        icon={Package}
                        title="ออเดอร์เปิดอยู่"
                        count={data.openOrders}
                        cta="ดูออเดอร์"
                        tone={data.openOrders > 0 ? "amber" : "neutral"}
                    />
                    <ActionCard
                        href="/dashboard/orders?tab=payment"
                        icon={CreditCard}
                        title="รอชำระเงิน"
                        count={data.awaitingPaymentOrders}
                        cta="ติดตามการชำระ"
                        tone={data.awaitingPaymentOrders > 0 ? "red" : "neutral"}
                    />
                </div>
            )}

            {/* ข้อมูลสถิติ — ครอบด้วย Card เพื่อ visual hierarchy ชัด */}
            <Card>
                <CardHeader className="border-b bg-muted/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <CardTitle className="text-lg">ข้อมูลสถิติ</CardTitle>
                            <CardDescription>{todayLabel}</CardDescription>
                        </div>
                        {isStaff && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                <span>
                                    แชท LINE{" "}
                                    <strong className="text-foreground">
                                        {data.lineConversationCount.toLocaleString("th-TH")}
                                    </strong>
                                </span>
                                <span className="hidden sm:inline text-border">|</span>
                                <span>
                                    ออเดอร์{" "}
                                    <strong className="text-foreground">
                                        {data.totalOrders.toLocaleString("th-TH")}
                                    </strong>{" "}
                                    รายการ
                                </span>
                                <span className="hidden sm:inline text-border">|</span>
                                <span>
                                    ชำระแล้ว{" "}
                                    <strong className="text-foreground">
                                        {data.paidOrders.toLocaleString("th-TH")}
                                    </strong>
                                </span>
                                {role === "admin" && (
                                    <>
                                        <span className="hidden sm:inline text-border">|</span>
                                        <Link
                                            href="/admin/users"
                                            className="text-primary hover:underline"
                                        >
                                            ผู้ใช้ {data.userCount.toLocaleString("th-TH")} คน
                                        </Link>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {/* KPI Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {kpis.map((kpi) => (
                            <KpiCard key={kpi.title} kpi={kpi} />
                        ))}
                    </div>

                    {/* ยังไม่มีออเดอร์ — empty state หลัก */}
                    {isStaff && !hasOrders && (
                        <DashboardEmptyState
                            icon={Receipt}
                            title="รอรับสลิปแรกของคุณ!"
                            description="เมื่อลูกค้าโอนเงินผ่าน LINE และส่งสลิป ระบบจะบันทึกออเดอร์และแสดงสถิติยอดขายที่นี่โดยอัตโนมัติ"
                            action={{ label: "เปิดแชทสด", href: "/dashboard/chat" }}
                        />
                    )}

                    {/* Pipeline + Charts — manager/admin */}
                    {isStaff && (
                        <div className="grid gap-4 lg:grid-cols-3">
                            <Card className="border shadow-none lg:col-span-1">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">ท่อ sales pipeline</CardTitle>
                                    <CardDescription>
                                        {hasLeads
                                            ? `ลีด ${data.totalLeads.toLocaleString("th-TH")} ราย · ปิดได้ ${data.wonLeads.toLocaleString("th-TH")}`
                                            : "ติดตามสถานะลีดแต่ละขั้น"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!hasLeads ? (
                                        <DashboardEmptyState
                                            compact
                                            icon={UserPlus}
                                            title="ยังไม่มีลีด"
                                            description="ลีดจาก LINE / แชท AI จะปรากฏที่นี่เมื่อมีลูกค้าใหม่เข้ามา"
                                            action={{ label: "ดูลีดทั้งหมด", href: "/dashboard/leads" }}
                                        />
                                    ) : (
                                        <div className="space-y-3">
                                            {pipelineData.map((stage) => (
                                                <div key={stage.status} className="space-y-1">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <Badge className={`text-xs ${stage.className}`}>
                                                            {stage.label}
                                                        </Badge>
                                                        <span className="font-medium tabular-nums">
                                                            {stage.count.toLocaleString("th-TH")}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                        <div
                                                            className="h-full rounded-full bg-primary/80 transition-all"
                                                            style={{
                                                                width: `${Math.max((stage.count / maxPipeline) * 100, stage.count > 0 ? 8 : 0)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border shadow-none lg:col-span-2">
                                <Tabs defaultValue="revenue" className="flex h-full flex-col gap-0">
                                    <CardHeader className="border-b pb-3">
                                        <div className="space-y-3">
                                            <div>
                                                <CardTitle className="text-base">แนวโน้ม 6 เดือน</CardTitle>
                                                <CardDescription>
                                                    {hasSales
                                                        ? `รายได้รวม ${formatBaht(data.totalRevenue)} · ${data.salesCount.toLocaleString("th-TH")} รายการขาย`
                                                        : "กราฟจะแสดงเมื่อมีรายการขายในระบบ"}
                                                </CardDescription>
                                            </div>
                                            <TabsList className="grid h-9 w-full grid-cols-2 lg:max-w-xs lg:shrink-0">
                                                <TabsTrigger value="revenue" className="px-2 text-xs sm:text-sm">
                                                    รายได้ & ลีด
                                                </TabsTrigger>
                                                <TabsTrigger value="source" className="px-2 text-xs sm:text-sm">
                                                    แหล่งที่มา
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <TabsContent value="revenue" className="mt-0">
                                            {hasMonthlyData ? (
                                                <ChartContainer
                                                    config={revenueChartConfig}
                                                    className="h-[280px] w-full"
                                                >
                                                    <ComposedChart
                                                        data={data.monthly}
                                                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                                                    >
                                                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                                        <XAxis
                                                            dataKey="month"
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickMargin={8}
                                                            fontSize={11}
                                                        />
                                                        <YAxis
                                                            yAxisId="revenue"
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickMargin={8}
                                                            fontSize={11}
                                                            tickFormatter={(v) =>
                                                                v >= 1000
                                                                    ? `฿${(v / 1000).toFixed(0)}k`
                                                                    : `฿${v}`
                                                            }
                                                        />
                                                        <YAxis
                                                            yAxisId="leads"
                                                            orientation="right"
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickMargin={8}
                                                            fontSize={11}
                                                            allowDecimals={false}
                                                        />
                                                        <ChartTooltip
                                                            content={
                                                                <ChartTooltipContent
                                                                    formatter={(value, name) => {
                                                                        if (name === "revenue") {
                                                                            return [
                                                                                formatBaht(Number(value)),
                                                                                "รายได้",
                                                                            ]
                                                                        }
                                                                        return [
                                                                            Number(value).toLocaleString("th-TH"),
                                                                            "ลีด",
                                                                        ]
                                                                    }}
                                                                />
                                                            }
                                                        />
                                                        <Bar
                                                            yAxisId="leads"
                                                            dataKey="leads"
                                                            fill="var(--color-leads)"
                                                            radius={[4, 4, 0, 0]}
                                                            barSize={28}
                                                            opacity={0.85}
                                                        />
                                                        <Line
                                                            yAxisId="revenue"
                                                            type="monotone"
                                                            dataKey="revenue"
                                                            stroke="var(--color-revenue)"
                                                            strokeWidth={2.5}
                                                            dot={{ r: 3, fill: "var(--color-revenue)" }}
                                                        />
                                                    </ComposedChart>
                                                </ChartContainer>
                                            ) : (
                                                <DashboardEmptyState
                                                    icon={BarChart3}
                                                    title="ยังไม่มีข้อมูลรายได้"
                                                    description="เมื่อมีการปิดการขายหรือบันทึกยอดจากออเดอร์ กราฟรายได้และลีดรายเดือนจะแสดงที่นี่"
                                                    action={{
                                                        label: "เปิดผู้ช่วยขาย AI",
                                                        href: "/dashboard/assistant",
                                                    }}
                                                />
                                            )}
                                        </TabsContent>
                                        <TabsContent value="source" className="mt-0">
                                            {hasLeads && sourceWithPct.length > 0 ? (
                                                <div className="space-y-3 py-1">
                                                    {sourceWithPct.map((row, i) => (
                                                        <div key={row.source} className="space-y-1">
                                                            <div className="flex items-center justify-between text-sm">
                                                                <span className="font-medium">{row.label}</span>
                                                                <span className="tabular-nums text-muted-foreground">
                                                                    {row.count.toLocaleString("th-TH")}{" "}
                                                                    <span className="text-xs">
                                                                        ({row.pct.toFixed(0)}%)
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                                                                <div
                                                                    className="h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: `${row.pct}%`,
                                                                        backgroundColor:
                                                                            SOURCE_BAR_COLORS[
                                                                                i % SOURCE_BAR_COLORS.length
                                                                            ],
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <DashboardEmptyState
                                                    compact
                                                    icon={Inbox}
                                                    title="ยังไม่มีลีดตามแหล่งที่มา"
                                                    description="เมื่อมีลีดจาก Facebook, LINE หรือช่องทางอื่น สัดส่วนจะแสดงในแท็บนี้"
                                                    action={{ label: "เพิ่มลีด", href: "/dashboard/leads" }}
                                                />
                                            )}
                                        </TabsContent>
                                    </CardContent>
                                </Tabs>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ลีดล่าสุด */}
            <Card>
                <CardHeader className="border-b bg-muted/20">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>ลีดล่าสุด</CardTitle>
                            <CardDescription>ลีดที่เพิ่งเข้ามาในระบบ</CardDescription>
                        </div>
                        {hasLeads && (
                            <Link href="/dashboard/leads" className="text-sm text-primary hover:underline">
                                ดูทั้งหมด →
                            </Link>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    {data.recentLeads.length === 0 ? (
                        <DashboardEmptyState
                            compact
                            icon={UserPlus}
                            title="ยังไม่มีลีดล่าสุด"
                            description="เมื่อมีลูกค้าใหม่จาก LINE หรือช่องทางอื่น รายการจะแสดงในตารางนี้ทันที"
                            action={{ label: "ไปที่หน้าลีด", href: "/dashboard/leads" }}
                        />
                    ) : (
                        <>
                            {/* Mobile / tablet cards */}
                            <div className="space-y-3 lg:hidden">
                                {data.recentLeads.map((lead) => {
                                    const s = statusConfig[lead.status] ?? statusConfig.NEW
                                    return (
                                        <div
                                            key={lead.id}
                                            className="rounded-lg border bg-card p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="font-medium">{lead.name}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {lead.phone || "—"}
                                                    </p>
                                                </div>
                                                <Badge className={`shrink-0 text-xs ${s.className}`}>
                                                    {s.label}
                                                </Badge>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                                <Badge variant="outline" className="text-xs">
                                                    {sourceLabels[lead.source] ?? lead.source}
                                                </Badge>
                                                {isStaff && (
                                                    <span className="text-sm font-medium">
                                                        {lead.budget ? formatBaht(lead.budget) : "—"}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-2 text-right text-xs text-muted-foreground">
                                                {lead.createdAt}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Desktop table */}
                            <div className="hidden lg:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ชื่อ-เบอร์</TableHead>
                                            <TableHead>แหล่งที่มา</TableHead>
                                            <TableHead>สถานะ</TableHead>
                                            {isStaff && (
                                                <TableHead className="text-right">งบประมาณ</TableHead>
                                            )}
                                            <TableHead className="text-right">วันที่</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.recentLeads.map((lead) => {
                                            const s = statusConfig[lead.status] ?? statusConfig.NEW
                                            return (
                                                <TableRow key={lead.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{lead.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {lead.phone || "—"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">
                                                            {sourceLabels[lead.source] ?? lead.source}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={`text-xs ${s.className}`}>
                                                            {s.label}
                                                        </Badge>
                                                    </TableCell>
                                                    {isStaff && (
                                                        <TableCell className="text-right font-medium">
                                                            {lead.budget ? formatBaht(lead.budget) : "—"}
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                        {lead.createdAt}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const toneStyles: Record<string, { card: string; iconWrap: string; count: string }> = {
    amber: {
        card: "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20",
        iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
        count: "text-amber-700 dark:text-amber-400",
    },
    red: {
        card: "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20",
        iconWrap: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
        count: "text-red-700 dark:text-red-400",
    },
    neutral: {
        card: "",
        iconWrap: "bg-muted text-muted-foreground",
        count: "text-foreground",
    },
}

function KpiCard({ kpi }: { kpi: Kpi }) {
    return (
        <Card className={`relative overflow-hidden border-l-4 ${kpi.accent}`}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${kpi.iconBg}`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tabular-nums tracking-tight">{kpi.value}</div>
                {kpi.progress != null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-violet-500 transition-all"
                            style={{ width: `${Math.min(kpi.progress, 100)}%` }}
                        />
                    </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {kpi.change && (
                        <>
                            {kpi.positive ? (
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            ) : (
                                <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-red-600" />
                            )}
                            <span
                                className={`text-xs font-semibold tabular-nums ${kpi.positive ? "text-emerald-600" : "text-red-600"}`}
                            >
                                {kpi.change}
                            </span>
                        </>
                    )}
                    <span className="text-xs text-muted-foreground">{kpi.description}</span>
                </div>
            </CardContent>
        </Card>
    )
}

function ActionCard({
    href,
    icon: Icon,
    title,
    count,
    cta,
    tone,
}: {
    href: string
    icon: LucideIcon
    title: string
    count: number
    cta: string
    tone: "amber" | "red" | "neutral"
}) {
    const t = toneStyles[tone]
    return (
        <Link href={href}>
            <Card className={`transition-colors hover:bg-muted/40 ${t.card}`}>
                <CardContent className="flex items-center gap-4 py-5">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.iconWrap}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className={`text-2xl font-bold leading-tight ${t.count}`}>
                            {count.toLocaleString("th-TH")}
                        </p>
                    </div>
                    <span className="shrink-0 text-xs text-primary">{cta} →</span>
                </CardContent>
            </Card>
        </Link>
    )
}

