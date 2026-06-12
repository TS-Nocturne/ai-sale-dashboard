import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AuthBranding } from "@/app/(auth)/auth/auth-branding"

export default async function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // ดึง Session จากฝั่ง Server
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    // ถ้า Login แล้ว → เตะไปหน้า Dashboard ทันที
    if (session) {
        redirect("/dashboard")
    }

    return (
        <div className="flex min-h-screen">
            {/* Left Side - Form */}
            <div className="relative flex w-full flex-col justify-center px-4 py-12 lg:w-1/2 lg:px-20">
                <div className="mx-auto w-full max-w-100">
                    {children}
                </div>
            </div>

            {/* Right Side - Branding */}
            <div className="hidden lg:block lg:w-1/2">
                <AuthBranding />
            </div>
        </div>
    )
}
