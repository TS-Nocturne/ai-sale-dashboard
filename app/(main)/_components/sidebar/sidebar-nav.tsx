"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/auth-client"
import { sidebarData, bottomNavItems } from "./sidebar-data"
import { NavSection } from "./nav-section"
import { NavItem } from "./nav-item"

interface SidebarNavProps {
    collapsed?: boolean
    showBrand?: boolean
    onNavigate?: () => void
    className?: string
}

export function SidebarNav({
    collapsed = false,
    showBrand = true,
    onNavigate,
    className,
}: SidebarNavProps) {
    const { data: session } = useSession()

    const userRoles = ((session?.user as { role?: string })?.role || "user")
        .split(",")
        .map((r) => r.trim())

    const filteredSections = sidebarData.filter(
        (section) =>
            !section.allowedRoles ||
            section.allowedRoles.some((r) => userRoles.includes(r))
    )

    return (
        <div className={cn("flex h-full flex-col", className)}>
            {showBrand && !collapsed && (
                <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2"
                        onClick={onNavigate}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 shadow-md">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-foreground leading-tight">
                            Smart Electronic
                            <span className="block text-[10px] font-medium text-muted-foreground">
                                Dashboard
                            </span>
                        </span>
                    </Link>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                <div className={cn("py-4", collapsed ? "px-1" : "px-3")}>
                    <div className="space-y-2">
                        {filteredSections.map((section, index) => (
                            <NavSection
                                key={index}
                                section={section}
                                collapsed={collapsed}
                                defaultOpen={true}
                                onNavigate={onNavigate}
                            />
                        ))}
                    </div>

                    <div className="mt-6 border-t border-border pt-4">
                        <nav className="space-y-1">
                            {bottomNavItems.map((item) => (
                                <NavItem
                                    key={item.href}
                                    item={item}
                                    collapsed={collapsed}
                                    onNavigate={onNavigate}
                                />
                            ))}
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    )
}
