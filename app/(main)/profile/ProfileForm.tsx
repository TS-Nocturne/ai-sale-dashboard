"use client"

import { useState } from "react"
import { authClient, useSession } from "@/lib/auth-client"
import {
    User,
    Mail,
    Save,
    Loader2,
    CheckCircle,
    AlertCircle,
    Lock,
    Eye,
    EyeOff,
} from "lucide-react"
import Image from "next/image"

export default function ProfileForm() {
    const { data: session, isPending } = useSession()

    // ── Profile State ────────────────────────────────────────────────────────
    const [name, setName] = useState("")
    const [nameInitialized, setNameInitialized] = useState(false)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState("")
    const [error, setError] = useState("")

    // ── Password State ───────────────────────────────────────────────────────
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [passwordSaving, setPasswordSaving] = useState(false)
    const [passwordSuccess, setPasswordSuccess] = useState("")
    const [passwordError, setPasswordError] = useState("")

    // Initialize name from session (one-time)
    if (session && !nameInitialized) {
        setName(session.user?.name || "")
        setNameInitialized(true)
    }

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleUpdateProfile = async () => {
        if (!name.trim()) { setError("กรุณากรอกชื่อ"); return }

        setSaving(true); setError(""); setSuccess("")
        try {
            const res = await authClient.updateUser({ name: name.trim() })
            if (res.error) {
                setError(res.error.message || "เกิดข้อผิดพลาด")
            } else {
                setSuccess("อัปเดตโปรไฟล์สำเร็จ!")
                setTimeout(() => setSuccess(""), 3000)
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการอัปเดต")
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async () => {
        setPasswordError(""); setPasswordSuccess("")

        if (!currentPassword) { setPasswordError("กรุณากรอกรหัสผ่านปัจจุบัน"); return }
        if (!newPassword || newPassword.length < 8) { setPasswordError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"); return }
        if (newPassword !== confirmPassword) { setPasswordError("รหัสผ่านใหม่ไม่ตรงกัน"); return }

        setPasswordSaving(true)
        try {
            const res = await authClient.changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: true,
            })
            if (res.error) {
                setPasswordError(res.error.message || "เกิดข้อผิดพลาด")
            } else {
                setPasswordSuccess("เปลี่ยนรหัสผ่านสำเร็จ!")
                setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
                setTimeout(() => setPasswordSuccess(""), 3000)
            }
        } catch {
            setPasswordError("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน")
        } finally {
            setPasswordSaving(false)
        }
    }

    if (isPending) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        )
    }

    if (!session) return null

    const initials = (session.user?.name || "U")
        .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    const userRole = (session.user as { role?: string })?.role || "user"

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* ── Profile Card ── */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-500" />
                    ข้อมูลโปรไฟล์
                </h2>

                {/* Avatar + Info */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                    {session.user?.image ? (
                        <Image
                            src={session.user.image}
                            alt="Avatar"
                            width={64}
                            height={64}
                            className="w-16 h-16 rounded-full ring-2 ring-purple-200 dark:ring-purple-800"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center ring-2 ring-purple-200 dark:ring-purple-800">
                            <span className="text-xl font-bold text-white">{initials}</span>
                        </div>
                    )}
                    <div>
                        <p className="text-base font-semibold text-foreground">{session.user?.name}</p>
                        <p className="text-sm text-muted-foreground">{session.user?.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                            {userRole.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    {/* Email (read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                            <Mail className="w-4 h-4 inline mr-1.5 text-muted-foreground" />
                            อีเมล
                        </label>
                        <input
                            type="email"
                            value={session.user?.email || ""}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground text-sm cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground mt-1">อีเมลไม่สามารถเปลี่ยนได้</p>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                            <User className="w-4 h-4 inline mr-1.5 text-muted-foreground" />
                            ชื่อ
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="กรอกชื่อของคุณ"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition"
                        />
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleUpdateProfile}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Change Password Card ── */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-500" />
                    เปลี่ยนรหัสผ่าน
                </h2>

                <div className="space-y-4">
                    {/* Current Password */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">รหัสผ่านปัจจุบัน</label>
                        <div className="relative">
                            <input
                                type={showCurrentPassword ? "text" : "password"}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="กรอกรหัสผ่านปัจจุบัน"
                                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                            >
                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">รหัสผ่านใหม่</label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="อย่างน้อย 8 ตัวอักษร"
                                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                            >
                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">ยืนยันรหัสผ่านใหม่</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Password Messages */}
                    {passwordError && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {passwordError}
                        </div>
                    )}
                    {passwordSuccess && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            {passwordSuccess}
                        </div>
                    )}

                    {/* Save Password Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleChangePassword}
                            disabled={passwordSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
                        >
                            {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            {passwordSaving ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
