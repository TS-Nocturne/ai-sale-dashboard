import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function KpiSkeleton() {
    return (
        <Card className="border-l-4 border-l-muted">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-3 w-36" />
            </CardContent>
        </Card>
    )
}

function ActionCardSkeleton() {
    return (
        <Card>
            <CardContent className="flex items-center gap-4 py-5">
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-12" />
                </div>
                <Skeleton className="h-3 w-16" />
            </CardContent>
        </Card>
    )
}

export default function DashboardLoading() {
    return (
        <div className="space-y-6">
            {/* Greeting */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-72 max-w-full" />
                </div>
                <Skeleton className="h-9 w-40 rounded-md" />
            </div>

            {/* Action cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <ActionCardSkeleton key={i} />
                ))}
            </div>

            {/* Stats card */}
            <Card>
                <CardHeader className="border-b pb-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <KpiSkeleton key={i} />
                        ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <Card className="lg:col-span-1 shadow-none">
                            <CardHeader>
                                <Skeleton className="h-5 w-36" />
                                <Skeleton className="h-3 w-44" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between">
                                            <Skeleton className="h-5 w-20" />
                                            <Skeleton className="h-4 w-8" />
                                        </div>
                                        <Skeleton className="h-2 w-full rounded-full" />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-2 shadow-none">
                            <CardHeader>
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-3 w-56" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-[280px] w-full rounded-lg" />
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            {/* Recent leads */}
            <Card>
                <CardHeader className="border-b pb-4">
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full rounded-md" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
