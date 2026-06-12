import { Metadata } from "next"
import LoginForm from "./LoginForm"
import { APP_NAME, APP_TAGLINE } from "@/lib/brand"

export const metadata: Metadata = {
    title: "เข้าสู่ระบบ",
    description: `เข้าสู่ระบบ ${APP_NAME} — ${APP_TAGLINE}`,
    keywords: [
        "เข้าสู่ระบบ",
        "Sign In",
        APP_NAME,
        "Smart Electronic",
        "Sales Dashboard",
        "LINE Login",
    ],
}

export default function SignInPage() {
    return <LoginForm />
}
