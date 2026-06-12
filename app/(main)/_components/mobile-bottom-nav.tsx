"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { NavItemType } from "./sidebar/sidebar-data"

interface MobileBottomNavProps {
    items: NavItemType[]
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
    const pathname = usePathname()

    if (items.length === 0) return null

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            aria-label="เมนูหลัก"
        >
            <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around">
                {items.map((item) => {
                    const isActive =
                        item.href === "/dashboard"
                            ? pathname === item.href
                            : pathname.startsWith(item.href)
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                                "active:bg-muted/60",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon
                                className={cn(
                                    "h-5 w-5 shrink-0",
                                    isActive && "stroke-[2.5px]"
                                )}
                            />
                            <span className="max-w-full truncate">{item.title}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
