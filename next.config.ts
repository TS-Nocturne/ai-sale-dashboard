import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

// Pin Turbopack root to this app so it does not pick up C:\Users\DELL\pnpm-lock.yaml
// (multiple lockfiles cause wrong module resolution and "Invalid hook call" errors).
// React deduplication is handled by pnpm overrides + .npmrc public-hoist-pattern.
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
    // ถ้าตัวแปร STANDALONE_BUILD เป็น 'true' (Docker) ให้เปิด standalone
    // ถ้าไม่ใช่ (เช่นรันบนเครื่อง Local) ก็ไม่ต้องใส่ค่า output
    output: process.env.STANDALONE_BUILD === "true" ? "standalone" : undefined,
    turbopack: {
        root: projectRoot,
    },
    // อนุญาต ngrok tunnel ให้เข้าถึง dev resources (เปลี่ยน subdomain ได้ตามจริง)
    allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.io"],
    // better-auth intentionally bundled (not external) so all packages share
    // the same React instance during SSR — avoids "Cannot read properties of null" hooks error.
    serverExternalPackages: [],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
            // Google OAuth avatar
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
                port: "",
                pathname: "/**",
            },
            // LINE profile picture
            {
                protocol: "https",
                hostname: "profile.line-scdn.net",
                port: "",
                pathname: "/**",
            },
        ],
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                ],
            },
        ]
    },
}

export default nextConfig
