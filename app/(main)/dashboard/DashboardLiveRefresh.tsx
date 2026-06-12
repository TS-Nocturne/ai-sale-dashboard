"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Poll fresh SSR data while the dashboard tab is visible. */
export default function DashboardLiveRefresh({ intervalMs = 45000 }: { intervalMs?: number }) {
    const router = useRouter()

    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === "visible") {
                router.refresh()
            }
        }
        const id = window.setInterval(refresh, intervalMs)
        return () => window.clearInterval(id)
    }, [router, intervalMs])

    return null
}
