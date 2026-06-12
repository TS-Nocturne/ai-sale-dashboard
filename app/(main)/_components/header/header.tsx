"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { sidebarData, bottomNavItems } from "../sidebar/sidebar-data"
import { SidebarNav } from "../sidebar/sidebar-nav"
import { UserMenu } from "./user-menu"
import { ImpersonationBanner } from "./impersonation-banner"
import { useUserRoles } from "@/app/(main)/_components/user-roles-context"
import { canOpenSettings, filterSidebarSections } from "@/lib/nav-access"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

export function Header() {
    const pathname = usePathname()
    const userRoles = useUserRoles()
    const [mobileOpen, setMobileOpen] = useState(false)

    const visibleSections = filterSidebarSections(sidebarData, userRoles)
    const showBottomSettings = canOpenSettings(userRoles)

    const pageTitles: Record<string, string> = {
        "/profile": "โปรไฟล์ของฉัน",
        "/admin/users": "จัดการผู้ใช้",
    }

    const allItems = [
        ...visibleSections.flatMap((section) => section.items),
        ...(showBottomSettings ? bottomNavItems : []),
    ]
    const matched = allItems.find((item) =>
        item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href)
    )
    const title = pageTitles[pathname] ?? matched?.title ?? "Dashboard"

    // Close mobile sidebar on route change by resetting state on each render
    // when pathname differs. Avoids calling setState inside an effect.
    const [prevPath, setPrevPath] = useState(pathname)
    if (prevPath !== pathname) {
        setPrevPath(pathname)
        if (mobileOpen) setMobileOpen(false)
    }

    return (
        <>
            <div className="sticky top-0 z-40 shrink-0 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
                <ImpersonationBanner />

                <header className="flex h-14 items-center justify-between gap-3 border-b border-border px-4 md:px-6">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 shrink-0 lg:hidden"
                            aria-label="เปิดเมนู"
                            onClick={() => setMobileOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
                        {title}
                    </h1>
                </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <UserMenu />
                    </div>
                </header>
            </div>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="w-[min(100vw-2rem,20rem)] p-0">
                    <SheetTitle className="sr-only">เมนูนำทาง</SheetTitle>
                    <SidebarNav onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
            </Sheet>
        </>
    )
}
