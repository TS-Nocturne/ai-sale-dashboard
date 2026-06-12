import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

// Server-to-server only (Python brain). Never called from the browser.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? ""

/**
 * Internal catalog feed for the Python brain.
 *
 * PostgreSQL is the single source of truth for products (the Inventory Sync
 * writes here). The Python agent has no DB driver by design, so it reads the
 * live catalog from this endpoint to answer with the *true* price and stock.
 *
 * Protected by a shared secret (`INTERNAL_API_KEY`) sent in `x-internal-key`.
 */
export async function GET(request: NextRequest) {
    if (!INTERNAL_API_KEY) {
        return NextResponse.json(
            { error: "INTERNAL_API_KEY is not configured on the dashboard" },
            { status: 500 }
        )
    }

    const provided = request.headers.get("x-internal-key") ?? ""
    if (provided !== INTERNAL_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const products = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
    })

    // Shape mirrors the legacy CSV columns the agent tools already understand
    // (id / name / category / price / description / stock).
    const catalog = products.map((p) => ({
        id: p.sku ?? p.id,
        name: p.name,
        category: p.category ?? "",
        price: p.price,
        description: p.description ?? "",
        stock: p.stock,
        warranty_period: "",
        unit: p.unit,
    }))

    return NextResponse.json({ products: catalog })
}
