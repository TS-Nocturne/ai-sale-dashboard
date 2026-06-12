"use client"

import { useState } from "react"
import { authClient, useSession } from "@/lib/auth-client"
import { useUserRoles } from "@/app/(main)/_components/user-roles-context"
import { ProfileAvatarUpload } from "@/app/(main)/_components/profile/ProfileAvatarUpload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    User,
    Bell,
    Shield,
    Building2,
    Save,
    Key,
    AlertTriangle,
    Loader2,
    CheckCircle,
    AlertCircle,
} from "lucide-react"

export default function SettingsContent() {
    const { data: session, isPending } = useSession()
    const userRoles = useUserRoles()
    const topRole = userRoles.includes("admin")
        ? "admin"
        : userRoles.includes("manager")
          ? "manager"
          : userRoles.includes("employee")
            ? "employee"
            : "user"

    const [name, setName] = useState("")
    const [nameInitialized, setNameInitialized] = useState(false)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState("")
    const [error, setError] = useState("")

    if (session && !nameInitialized) {
        setName(session.user?.name || "")
        setNameInitialized(true)
    }

    const handleSaveProfile = async () => {
        if (!name.trim()) {
            setError("กรุณากรอกชื่อ")
            return
        }
        setSaving(true)
        setError("")
        setSuccess("")
        try {
            const res = await authClient.updateUser({ name: name.trim() })
            if (res.error) {
                setError(res.error.message || "เกิดข้อผิดพลาด")
            } else {
                setSuccess("บันทึกโปรไฟล์สำเร็จ")
                setTimeout(() => setSuccess(""), 3000)
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการบันทึก")
        } finally {
            setSaving(false)
        }
    }

    if (isPending) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        )
    }

    if (!session) return null

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">ตั้งค่า</h1>
                <p className="text-sm text-muted-foreground">จัดการโปรไฟล์และการตั้งค่าระบบ</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:flex lg:w-auto lg:grid-cols-none">
                    <TabsTrigger value="profile" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                        <User className="h-4 w-4 shrink-0" />
                        โปรไฟล์
                    </TabsTrigger>
                    <TabsTrigger value="business" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                        <Building2 className="h-4 w-4 shrink-0" />
                        ธุรกิจ
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                        <Bell className="h-4 w-4 shrink-0" />
                        แจ้งเตือน
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                        <Shield className="h-4 w-4 shrink-0" />
                        ความปลอดภัย
                    </TabsTrigger>
                </TabsList>

                {/* ── Profile Tab ── */}
                <TabsContent value="profile" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>ข้อมูลส่วนตัว</CardTitle>
                            <CardDescription>อัปเดตข้อมูลโปรไฟล์และรูปภาพ</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <ProfileAvatarUpload
                                name={session.user.name}
                                image={session.user.image}
                            />

                            <Separator />

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="p-name">ชื่อ-นามสกุล</Label>
                                    <Input
                                        id="p-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="p-email">อีเมล</Label>
                                    <Input
                                        id="p-email"
                                        type="email"
                                        value={session.user.email}
                                        disabled
                                        className="cursor-not-allowed bg-muted text-muted-foreground"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>บทบาท</Label>
                                    <div className="flex h-9 items-center">
                                        <Badge className="uppercase">{topRole}</Badge>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                                    <CheckCircle className="h-4 w-4 shrink-0" />
                                    {success}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button
                                    className="gap-2"
                                    disabled={saving}
                                    onClick={handleSaveProfile}
                                >
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Business Tab ── */}
                <TabsContent value="business" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>ข้อมูลธุรกิจ</CardTitle>
                            <CardDescription>ข้อมูลที่แสดงในรายงานและเอกสาร</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="biz-name">ชื่อธุรกิจ / แบรนด์</Label>
                                    <Input id="biz-name" placeholder="ชื่อบริษัท / ร้านค้า" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="biz-type">ประเภทธุรกิจ</Label>
                                    <Select>
                                        <SelectTrigger>
                                            <SelectValue placeholder="เลือกประเภท" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ecommerce">E-Commerce</SelectItem>
                                            <SelectItem value="service">บริการ</SelectItem>
                                            <SelectItem value="retail">ค้าปลีก</SelectItem>
                                            <SelectItem value="b2b">B2B</SelectItem>
                                            <SelectItem value="other">อื่นๆ</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="biz-address">ที่อยู่</Label>
                                    <Input id="biz-address" placeholder="ที่อยู่ธุรกิจ" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="biz-tax">เลขประจำตัวผู้เสียภาษี</Label>
                                    <Input id="biz-tax" placeholder="0-0000-00000-00-0" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="biz-phone">เบอร์ติดต่อธุรกิจ</Label>
                                    <Input id="biz-phone" placeholder="02-XXX-XXXX" />
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="mb-3 text-sm font-medium">การตั้งค่าการขาย</h4>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>สกุลเงินหลัก</Label>
                                        <Select defaultValue="THB">
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="THB">THB — บาทไทย</SelectItem>
                                                <SelectItem value="USD">USD — ดอลลาร์สหรัฐ</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>ภาษีมูลค่าเพิ่ม (%)</Label>
                                        <Input type="number" defaultValue="7" min="0" max="100" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button className="gap-2">
                                    <Save className="h-4 w-4" />
                                    บันทึก
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Notifications Tab ── */}
                <TabsContent value="notifications" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>การแจ้งเตือน</CardTitle>
                            <CardDescription>ตั้งค่าการรับการแจ้งเตือนจากระบบ</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                { label: "ลีดใหม่เข้าระบบ", desc: "แจ้งเตือนทันทีเมื่อมีลีดใหม่", defaultOn: true },
                                { label: "ลีดรอการอนุมัติส่วนลด", desc: "เมื่อทีมขายขอส่วนลดพิเศษ", defaultOn: true },
                                { label: "ปิดการขายสำเร็จ", desc: "เมื่อสถานะลีดเปลี่ยนเป็น WON", defaultOn: true },
                                { label: "รายงานรายสัปดาห์", desc: "สรุปยอดขายทุกวันจันทร์", defaultOn: false },
                                { label: "รายงานรายเดือน", desc: "สรุปภาพรวมเดือนทุกวันที่ 1", defaultOn: true },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div>
                                        <p className="text-sm font-medium">{item.label}</p>
                                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <div className={`h-5 w-9 cursor-pointer rounded-full transition-colors ${item.defaultOn ? "bg-primary" : "bg-muted"}`} />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Security Tab ── */}
                <TabsContent value="security" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                เปลี่ยนรหัสผ่าน
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="old-pwd">รหัสผ่านปัจจุบัน</Label>
                                <Input id="old-pwd" type="password" placeholder="••••••••" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-pwd">รหัสผ่านใหม่</Label>
                                <Input id="new-pwd" type="password" placeholder="••••••••" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-pwd">ยืนยันรหัสผ่านใหม่</Label>
                                <Input id="confirm-pwd" type="password" placeholder="••••••••" />
                            </div>
                            <Button className="gap-2">
                                <Save className="h-4 w-4" />
                                เปลี่ยนรหัสผ่าน
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-destructive/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                โซนอันตราย
                            </CardTitle>
                            <CardDescription>การกระทำที่ไม่สามารถยกเลิกได้</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-medium">ลบบัญชีผู้ใช้</p>
                                    <p className="text-xs text-muted-foreground">ลบข้อมูลทั้งหมดอย่างถาวร ไม่สามารถกู้คืนได้</p>
                                </div>
                                <Button variant="destructive" size="sm">ลบบัญชี</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
