"use client"

import { Header } from "./header"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { getMobileNavItems, shouldShowMobileBottomNav } from "./sidebar/sidebar-data"
import { useUserRoles } from "@/app/(main)/_components/user-roles-context"
import { cn } from "@/lib/utils"

export function MobileAppShell({ children }: { children: React.ReactNode }) {
    const userRoles = useUserRoles()

    const showMobileNav = shouldShowMobileBottomNav(userRoles)
    const mobileNavItems = getMobileNavItems(userRoles)

    return (
        <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            data-mobile-bottom-nav={showMobileNav ? "true" : undefined}
        >
            <Header />

            <main
                className={cn(
                    "flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 md:p-6",
                    showMobileNav
                        ? "pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-6"
                        : "pb-4 md:pb-6"
                )}
            >
                {children}
            </main>

            {showMobileNav && <MobileBottomNav items={mobileNavItems} />}
        </div>
    )
}
