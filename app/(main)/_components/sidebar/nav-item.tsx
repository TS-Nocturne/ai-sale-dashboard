"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { NavItemType } from "./sidebar-data"

interface NavItemProps {
    item: NavItemType
    collapsed?: boolean
    onNavigate?: () => void
}

export function NavItem({ item, collapsed, onNavigate }: NavItemProps) {
    const pathname = usePathname()
    const isActive = item.href === "/dashboard"
        ? pathname === item.href
        : pathname.startsWith(item.href)
    const Icon = item.icon

    return (
        <Link
            href={item.href}
            title={collapsed ? item.title : undefined}
            onClick={onNavigate}
            className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                collapsed && "justify-center px-2"
            )}
        >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="flex-1">{item.title}</span>}
            {!collapsed && item.badge && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                    {item.badge}
                </span>
            )}
        </Link>
    )
}
