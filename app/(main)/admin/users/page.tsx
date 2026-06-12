import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import UsersManagement from "./UsersManagement"

export const metadata = {
    title: "จัดการผู้ใช้ | Admin",
}

export default async function AdminUsersPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session) {
        redirect("/dashboard")
    }

    // รองรับ multi-role เช่น "user,admin"
    const userRoles = (session.user.role ?? "user").split(",").map((r: string) => r.trim())
    if (!userRoles.includes("admin")) {
        redirect("/dashboard")
    }

    return <UsersManagement />
}
