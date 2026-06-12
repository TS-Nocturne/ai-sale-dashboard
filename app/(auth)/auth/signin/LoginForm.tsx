"use client"

import { useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sparkles, Eye, EyeOff } from "lucide-react"
import { signIn } from "@/lib/auth-client"
import { APP_NAME } from "@/lib/brand"

export default function LoginForm() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const loginWithSocial = async (provider: "google" | "line") => {
        setIsLoading(true)
        setError("")
        try {
            // callbackURL ใช้ได้กับ OAuth เพราะ provider จะ redirect กลับมา
            const { error } = await signIn.social({
                provider,
                callbackURL: "/dashboard",
            })
            if (error) {
                setError(error.message || "เข้าสู่ระบบไม่สำเร็จ")
                setIsLoading(false)
            }
            // ถ้าสำเร็จ browser จะ redirect ไปที่ provider อัตโนมัติ
        } catch {
            setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const { error } = await signIn.email({ email, password })

            if (error) {
                setError(error.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
                setIsLoading(false)
                return
            }

            // Full page reload เพื่อให้ server component อ่าน session cookie ใหม่ได้ถูกต้อง
            window.location.href = "/dashboard"
        } catch {
            setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
            setIsLoading(false)
        }
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
                <h1 className="text-2xl font-semibold tracking-tight">ยินดีต้อนรับกลับ</h1>
                <p className="text-sm text-muted-foreground">เข้าสู่ระบบเพื่อใช้งานต่อ</p>
            </div>

            {/* Social Buttons */}
            <div className="space-y-3">
                {/* Google */}
                <Button
                    variant="outline"
                    className="w-full justify-center gap-3 py-5"
                    onClick={() => loginWithSocial("google")}
                    disabled={isLoading}
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                </Button>

                {/* LINE */}
                <Button
                    variant="outline"
                    className="w-full justify-center gap-3 py-5"
                    onClick={() => loginWithSocial("line")}
                    disabled={isLoading}
                >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 10.304c0-5.231-5.381-9.486-12-9.486S0 5.073 0 10.304c0 4.689 4.269 8.621 10.044 9.358.391.084.922.258 1.056.594.12.302.079.775.038 1.08l-.164 1.02c-.05.303-.24 1.186 1.037.647 1.278-.54 6.889-4.059 9.39-6.953.011-.01.011-.01.022-.02 1.625-1.897 2.577-4.133 2.577-6.63zM8.332 13.911H6.04a.5.5 0 01-.5-.5V7.126a.5.5 0 01.5-.5h.352a.5.5 0 01.5.5v5.88h1.44a.5.5 0 01.5.5v.352a.5.5 0 01-.51.5zm2.744 0h-.352a.5.5 0 01-.5-.5V7.126a.5.5 0 01.5-.5h.352a.5.5 0 01.5.5v6.285a.5.5 0 01-.5.5zm5.176 0h-.35a.5.5 0 01-.502-.429l-1.828-4.992v4.921a.5.5 0 01-.5.5h-.352a.5.5 0 01-.5-.5V7.126a.5.5 0 01.5-.5h.364a.5.5 0 01.5.39l1.823 4.978V7.126a.5.5 0 01.5-.5h.352a.5.5 0 01.5.5v6.285a.5.5 0 01-.5.5zm4.004-3.344h-.942v.8h.942a.5.5 0 01.5.5v.352a.5.5 0 01-.5.5h-1.8a.5.5 0 01-.5-.5V7.126a.5.5 0 01.5-.5h1.8a.5.5 0 01.5.5v.352a.5.5 0 01-.5.5h-.942v.8h.942a.5.5 0 01.5.5v.352a.5.5 0 01-.5.5z" />
                    </svg>
                    Sign in with LINE
                </Button>
            </div>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Email/Password Form */}
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

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link
                            href="/auth/forgot-password"
                            className="text-xs text-purple-500 hover:text-purple-400"
                        >
                            ลืมรหัสผ่าน?
                        </Link>
                    </div>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full bg-purple-600 py-5 text-white hover:bg-purple-700"
                    disabled={isLoading}
                >
                    {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                </Button>
            </form>

            {/* Sign Up Link */}
            <p className="text-center text-sm text-muted-foreground">
                ยังไม่มีบัญชี?{" "}
                <Link href="/auth/signup" className="font-medium text-purple-500 hover:text-purple-400">
                    สมัครสมาชิก
                </Link>
            </p>
        </div>
    )
}
