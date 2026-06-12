import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DashboardEmptyStateProps {
    icon: LucideIcon
    title: string
    description: string
    action?: { label: string; href: string }
    className?: string
    compact?: boolean
}

export function DashboardEmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
    compact,
}: DashboardEmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-6 text-center",
                compact ? "py-8" : "min-h-[240px] py-10",
                className
            )}
        >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/80 ring-1 ring-border">
                <Icon className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {description}
            </p>
            {action && (
                <Button asChild size="sm" className="mt-5 gap-1.5">
                    <Link href={action.href}>{action.label}</Link>
                </Button>
            )}
        </div>
    )
}
