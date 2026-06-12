import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/app/generated/prisma/client"
import { Pool } from "pg"

/**
 * Runtime DB URL — use Neon **pooled** endpoint (`…-pooler.….neon.tech`).
 * For `prisma db push` / migrations prefer DATABASE_URL_UNPOOLED (direct).
 */
const connectionString = `${process.env.DATABASE_URL}`

const poolMax = Math.min(
    20,
    Math.max(1, Number.parseInt(process.env.PGPOOL_MAX ?? "5", 10) || 5)
)

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Small client pool — Neon pooler already multiplexes connections.
const pool = new Pool({
    connectionString,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
})
const adapter = new PrismaPg(pool)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma
}
