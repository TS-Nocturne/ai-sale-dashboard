import { Metadata } from "next"
import SettingsContent from "./SettingsContent"

export const metadata: Metadata = {
    title: "ตั้งค่า",
    description: "ตั้งค่าระบบ Smart Electronic Dashboard",
}

export default function SettingsPage() {
    return <SettingsContent />
}
