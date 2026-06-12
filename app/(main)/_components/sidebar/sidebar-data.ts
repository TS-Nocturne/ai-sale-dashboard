import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    Package,
    PackageCheck,
    TrendingUp,
    Settings,
    HelpCircle,
    Shield,
    UserCog,
    Sparkles,
    BadgeCheck,
    Headset,
    BrainCircuit,
    type LucideIcon,
} from "lucide-react"

export interface NavItemType {
    title: string
    href: string
    icon: LucideIcon
    badge?: string
}

export interface NavSectionType {
    title?: string
    items: NavItemType[]
    allowedRoles?: string[]  // ถ้าไม่กำหนด = ทุก role เห็น
}

export const sidebarData: NavSectionType[] = [
    {
        // ไม่รวม employee — พนักงานเห็นเฉพาะคิว handoff
        items: [
            { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { title: "ผู้ช่วยขาย AI", href: "/dashboard/assistant", icon: Sparkles },
        ],
        allowedRoles: ["user", "admin", "manager"],
    },
    {
        // พนักงาน — เฉพาะลูกค้าที่ต้องการเจ้าหน้าที่
        items: [
            { title: "ลูกค้ารอเจ้าหน้าที่", href: "/dashboard/chat", icon: Headset },
        ],
        allowedRoles: ["employee"],
    },
    {
        // admin และ manager เท่านั้น
        title: "AI Operations",
        items: [
            { title: "ศูนย์อนุมัติส่วนลด", href: "/dashboard/approvals", icon: BadgeCheck },
            { title: "แชทสด & ส่งต่อเจ้าหน้าที่", href: "/dashboard/chat", icon: Headset },
            { title: "ฐานความรู้ AI", href: "/admin/knowledge", icon: BrainCircuit },
        ],
        allowedRoles: ["admin", "manager"],
    },
    {
        // admin และ manager เท่านั้น
        title: "Sales",
        items: [
            { title: "ลีด", href: "/dashboard/leads", icon: Users },
            { title: "ลูกค้า", href: "/dashboard/customers", icon: TrendingUp },
            { title: "คำสั่งซื้อ", href: "/dashboard/orders", icon: PackageCheck },
            { title: "การขาย", href: "/dashboard/sales", icon: ShoppingCart },
            { title: "สินค้า/บริการ", href: "/dashboard/products", icon: Package },
        ],
        allowedRoles: ["admin", "manager"],
    },
    {
        // admin เท่านั้น
        title: "Admin",
        items: [
            { title: "จัดการผู้ใช้", href: "/admin/users", icon: UserCog },
            { title: "ตั้งค่า", href: "/dashboard/settings", icon: Settings },
        ],
        allowedRoles: ["admin"],
    },
    {
        // manager เท่านั้น (ตั้งค่าระบบ)
        title: "ระบบ",
        items: [
            { title: "ตั้งค่า", href: "/dashboard/settings", icon: Shield },
        ],
        allowedRoles: ["manager"],
    },
]

export const bottomNavItems: NavItemType[] = [
    { title: "ตั้งค่า", href: "/dashboard/settings", icon: HelpCircle },
]

/** Shortcuts for the mobile bottom bar — max 4 items for thumb reach. */
export function getMobileNavItems(userRoles: string[]): NavItemType[] {
    const roles = new Set(userRoles)

    // พนักงานเห็นแค่แชท — ไม่ต้องมี bottom nav (มีหน้าเดียว)
    if (roles.has("employee") && !roles.has("admin") && !roles.has("manager")) {
        return []
    }

    // ลูกค้าทั่วไป (user เท่านั้น)
    if (roles.has("user") && !roles.has("admin") && !roles.has("manager")) {
        return [
            { title: "หน้าหลัก", href: "/dashboard", icon: LayoutDashboard },
            { title: "AI", href: "/dashboard/assistant", icon: Sparkles },
        ]
    }

    const items: NavItemType[] = [
        { title: "หน้าหลัก", href: "/dashboard", icon: LayoutDashboard },
        { title: "แชท", href: "/dashboard/chat", icon: Headset },
        { title: "ออเดอร์", href: "/dashboard/orders", icon: PackageCheck },
        { title: "อนุมัติ", href: "/dashboard/approvals", icon: BadgeCheck },
    ]

    return items
}

export function shouldShowMobileBottomNav(userRoles: string[]): boolean {
    return getMobileNavItems(userRoles).length > 1
}
