import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access"

// 1. กำหนด Resources + Actions ในระบบ
export const statement = {
    ...defaultStatements,
    project: ["create", "read", "update", "delete"],
    lead: ["create", "read", "update", "delete"],
    sale: ["create", "read", "update", "delete"],
} as const

export const ac = createAccessControl(statement)

// 2. สร้าง Roles

// user — อ่านและสร้างได้ แต่ลบไม่ได้
export const user = ac.newRole({
    project: ["create", "read"],
    lead: ["create", "read"],
    sale: ["read"],
})

// employee (พนักงาน) — เข้าถึงได้เฉพาะคิวลูกค้าที่ต้องการเจ้าหน้าที่ (handoff)
export const employee = ac.newRole({
    lead: ["read"],
})

// manager — ทำได้ทุกอย่างยกเว้นลบ และไม่มีสิทธิ์จัดการ user อื่น
export const manager = ac.newRole({
    project: ["create", "read", "update"],
    lead: ["create", "read", "update"],
    sale: ["create", "read", "update"],
})

// admin — สิทธิ์เต็ม รวมถึงจัดการ user และ session
export const admin = ac.newRole({
    project: ["create", "read", "update", "delete"],
    lead: ["create", "read", "update", "delete"],
    sale: ["create", "read", "update", "delete"],
    ...adminAc.statements,
})
