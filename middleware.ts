import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Edge-safe middleware — ห้าม import auth/prisma ที่นี่ (Edge ไม่รองรับ node:util/types).
 * ส่ง pathname ไปให้ server layout ใช้ตรวจสิทธิ์ role แทน
 */
export function middleware(request: NextRequest) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-pathname", request.nextUrl.pathname)

    return NextResponse.next({
        request: { headers: requestHeaders },
    })
}

export const config = {
    matcher: [
        /*
         * ทุกหน้า app ยกเว้น api, auth, static assets
         */
        "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    ],
}
