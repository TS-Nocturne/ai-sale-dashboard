import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin as adminPlugin } from "better-auth/plugins"
import { prisma } from "@/lib/prisma"
import { ac, admin, employee, manager, user } from "@/lib/permissions"

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    // อนุญาต origins สำหรับ production + container (Podman port 8810)
    trustedOrigins: [
        process.env.BETTER_AUTH_URL || "http://localhost:3000",
        "http://localhost:3000",
        "http://localhost:8810",
    ].filter(Boolean),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
        line: {
            clientId: process.env.LINE_CLIENT_ID as string,
            clientSecret: process.env.LINE_CLIENT_SECRET as string,
        },
    },
    // อนุญาตให้เชื่อมบัญชีอัตโนมัติเมื่ออีเมลตรงกัน
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "line"],
        },
    },
    plugins: [
        adminPlugin({
            ac,
            roles: { admin, manager, user, employee },
        }),
    ],
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24,      // 1 day
    },
})
