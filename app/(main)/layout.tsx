import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Sidebar } from "@/app/(main)/_components/sidebar"
import { MobileAppShell } from "@/app/(main)/_components/mobile-app-shell"
import { UserRolesProvider } from "@/app/(main)/_components/user-roles-context"
import { employeeMayAccess, isEmployeeOnly, parseRoles } from "@/lib/roles"

export default async function MainLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const headerList = await headers()
    const session = await auth.api.getSession({
        headers: headerList,
    })

    if (!session) {
        redirect("/auth/signin")
    }

    const roles = parseRoles(session.user.role)
    const pathname = headerList.get("x-pathname") ?? ""

    if (isEmployeeOnly(roles) && pathname && !employeeMayAccess(pathname)) {
        redirect("/dashboard/chat")
    }

    return (
        <UserRolesProvider roles={roles}>
            <div className="flex h-dvh max-h-dvh flex-col bg-background">
                <div className="flex min-h-0 flex-1">
                    <Sidebar />
                    <MobileAppShell>{children}</MobileAppShell>
                </div>
            </div>
        </UserRolesProvider>
    )
}
