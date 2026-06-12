"use client"

import { useState } from "react"
import Link from "next/link"
import { PanelLeftClose, PanelLeft, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarNav } from "./sidebar-nav"

interface SidebarProps {
    className?: string
}

export function Sidebar({ className }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false)

    return (
        <aside
            className={cn(
                "hidden h-screen shrink-0 flex-col border-r border-border bg-background transition-all duration-300 overflow-hidden lg:flex",
                collapsed ? "w-14" : "w-64",
                className
            )}
        >
            <div
                className={cn(
                    "flex h-14 shrink-0 items-center border-b border-border",
                    collapsed ? "justify-center px-2" : "justify-between px-4"
                )}
            >
                {!collapsed && (
                    <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 shadow-md">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <span className="truncate text-sm font-bold tracking-tight text-foreground leading-tight">
                            Smart Electronic
                            <span className="block text-[10px] font-medium text-muted-foreground">
                                Dashboard
                            </span>
                        </span>
                    </Link>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? (
                        <PanelLeft className="h-4 w-4" />
                    ) : (
                        <PanelLeftClose className="h-4 w-4" />
                    )}
                </button>
            </div>

            <SidebarNav collapsed={collapsed} showBrand={false} />
        </aside>
    )
}
