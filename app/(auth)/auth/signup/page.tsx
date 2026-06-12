import { Metadata } from "next"
import SignupForm from "./SignupForm"
import { APP_NAME, APP_TAGLINE } from "@/lib/brand"

export const metadata: Metadata = {
    title: "สมัครสมาชิก",
    description: `สมัครสมาชิก ${APP_NAME} — ${APP_TAGLINE}`,
    keywords: ["สมัครสมาชิก", "Sign Up", APP_NAME, "Smart Electronic", "Sales Dashboard"],
}

export default function SignUpPage() {
    return <SignupForm />
}
