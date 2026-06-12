import { Metadata } from "next"
import ForgotPasswordForm from "./ForgotPasswordForm"
import { APP_NAME } from "@/lib/brand"

export const metadata: Metadata = {
    title: "ลืมรหัสผ่าน",
    description: `รีเซ็ตรหัสผ่าน ${APP_NAME} — กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่`,
    keywords: ["ลืมรหัสผ่าน", "Forgot Password", APP_NAME],
}

export default function ForgotPasswordPage() {
    return <ForgotPasswordForm />
}
