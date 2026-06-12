"use client"

import { useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sparkles, ArrowLeft, CheckCircle } from "lucide-react"
import { APP_NAME } from "@/lib/brand"

export default function ForgotPasswordForm() {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        // TODO: เชื่อมต่อ Better Auth forgot password API
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setIsSubmitted(true)
        setIsLoading(false)
    }

    if (isSubmitted) {
        return (
            <div className="space-y-6">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                    <span className="text-xl font-bold">{APP_NAME}</span>
                </div>

                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        ตรวจสอบอีเมลของคุณ
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปที่{" "}
                        <span className="font-medium text-foreground">{email}</span>
                    </p>
                </div>

                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsSubmitted(false)}
                >
                    ลองอีเมลอื่น
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                    <Link
                        href="/auth/signin"
                        className="inline-flex items-center gap-1 font-medium text-purple-500 hover:text-purple-400"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        กลับไปหน้าเข้าสู่ระบบ
                    </Link>
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-600" />
                <span className="text-xl font-bold">{APP_NAME}</span>
            </div>

            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                    ลืมรหัสผ่าน?
                </h1>
                <p className="text-sm text-muted-foreground">
                    ไม่ต้องกังวล เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านให้คุณ
                </p>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                    />
                </div>

                <Button
                    type="submit"
                    className="w-full bg-purple-600 py-5 text-white hover:bg-purple-700"
                    disabled={isLoading}
                >
                    {isLoading ? "กำลังส่ง..." : "รีเซ็ตรหัสผ่าน"}
                </Button>
            </form>

            {/* Back to Sign In */}
            <p className="text-center text-sm text-muted-foreground">
                <Link
                    href="/auth/signin"
                    className="inline-flex items-center gap-1 font-medium text-purple-500 hover:text-purple-400"
                >
                    <ArrowLeft className="h-4 w-4" />
                    กลับไปหน้าเข้าสู่ระบบ
                </Link>
            </p>
        </div>
    )
}
