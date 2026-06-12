import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * Inventory Sync (Structured Data → PostgreSQL).
 *
 * Product / inventory files (CSV / Excel) are STRUCTURED data and must NOT go
 * into the vector DB. They are parsed here and persisted to PostgreSQL via
 * Prisma, using the SKU as the unique identifier ("กฎเหล็ก") to decide whether
 * each row is an existing product (UPDATE) or a new one (INSERT) — i.e. an
 * "upsert". See `Day7_Note.md` / the Knowledge Base flow for the unstructured
 * counterpart.
 *
 * Two import modes control what happens to products that are NOT in the file:
 *  - APPEND    : leave existing products untouched (safe, default).
 *  - FULL_SYNC : deactivate (isActive=false) any active product whose SKU is
 *                missing from the uploaded file, so the catalog matches the file.
 */

export type ImportMode = "APPEND" | "FULL_SYNC"

export const IMPORT_MODES: ImportMode[] = ["APPEND", "FULL_SYNC"]

export interface ParsedProductRow {
    sku: string
    name: string
    category: string | null
    price: number
    description: string | null
    stock: number
    unit: string | null
    isActive: boolean
}

export interface InventorySyncResult {
    created: number
    updated: number
    deactivated: number
    skipped: number
    totalRows: number
    /** Human-readable problems for individual rows (kept short for the UI). */
    errors: string[]
}

const MAX_ROWS = 5000

// ── Column header aliases (Thai + English) ──────────────────────────────────
const COLUMN_ALIASES: Record<keyof ParsedProductRow, string[]> = {
    sku: ["sku", "id", "productid", "product id", "product_id", "รหัสสินค้า", "รหัส"],
    name: ["name", "productname", "product name", "ชื่อสินค้า", "ชื่อ", "สินค้า"],
    category: ["category", "cat", "หมวดหมู่", "หมวด", "ประเภท"],
    price: ["price", "ราคา", "ราคาขาย"],
    description: ["description", "desc", "detail", "รายละเอียด", "คำอธิบาย"],
    stock: ["stock", "qty", "quantity", "จำนวน", "สต็อก", "สต๊อก", "คงเหลือ"],
    unit: ["unit", "หน่วย"],
    isActive: ["isactive", "active", "status", "สถานะ"],
}

function normalizeHeader(header: string): string {
    return header.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Build a map of canonical field → column index from the header row. */
function mapHeaders(headers: string[]): Partial<Record<keyof ParsedProductRow, number>> {
    const normalized = headers.map(normalizeHeader)
    const map: Partial<Record<keyof ParsedProductRow, number>> = {}

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
        keyof ParsedProductRow,
        string[],
    ][]) {
        const idx = normalized.findIndex((h) => aliases.includes(h))
        if (idx !== -1) map[field] = idx
    }
    return map
}

function parsePrice(raw: string | undefined): number {
    if (!raw) return NaN
    // Strip currency symbols, Thai baht text and thousands separators.
    const cleaned = String(raw)
        .replace(/[฿,\s]/g, "")
        .replace(/บาท/g, "")
        .trim()
    return Number(cleaned)
}

function parseStock(raw: string | undefined): number {
    if (raw === undefined || raw === null || String(raw).trim() === "") return 0
    const n = parseInt(String(raw).replace(/[,\s]/g, ""), 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
}

const TRUTHY = new Set(["true", "1", "yes", "y", "active", "ใช้งาน", "เปิด", "ขาย"])
const FALSY = new Set(["false", "0", "no", "n", "inactive", "ปิดใช้งาน", "ปิด", "เลิกขาย"])

function parseActive(raw: string | undefined): boolean {
    if (raw === undefined) return true
    const v = String(raw).trim().toLowerCase()
    if (FALSY.has(v)) return false
    if (TRUTHY.has(v)) return true
    return true // default to active when unspecified/unknown
}

// ── CSV parsing (handles quoted fields, embedded commas, CRLF) ───────────────
function parseCsv(text: string): string[][] {
    const rows: string[][] = []
    let field = ""
    let row: string[] = []
    let inQuotes = false

    // Strip a leading UTF-8 BOM if present.
    const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

    for (let i = 0; i < input.length; i++) {
        const char = input[i]

        if (inQuotes) {
            if (char === '"') {
                if (input[i + 1] === '"') {
                    field += '"'
                    i++
                } else {
                    inQuotes = false
                }
            } else {
                field += char
            }
            continue
        }

        if (char === '"') {
            inQuotes = true
        } else if (char === ",") {
            row.push(field)
            field = ""
        } else if (char === "\n" || char === "\r") {
            // Handle CRLF as a single line break.
            if (char === "\r" && input[i + 1] === "\n") i++
            row.push(field)
            field = ""
            // Skip fully empty lines.
            if (row.some((c) => c.trim() !== "")) rows.push(row)
            row = []
        } else {
            field += char
        }
    }
    // Flush the trailing field/row.
    if (field !== "" || row.length > 0) {
        row.push(field)
        if (row.some((c) => c.trim() !== "")) rows.push(row)
    }
    return rows
}

/**
 * Parse an uploaded product file (CSV or XLSX) into validated product rows.
 *
 * Returns the parsed rows plus per-row validation errors. Rows missing a SKU,
 * name or valid price are dropped and reported in `errors`.
 */
export async function parseProductFile(
    buffer: Buffer,
    filename: string
): Promise<{ rows: ParsedProductRow[]; errors: string[] }> {
    const ext = filename.split(".").pop()?.toLowerCase() ?? ""
    let table: string[][]

    if (ext === "csv" || ext === "txt") {
        table = parseCsv(buffer.toString("utf-8"))
    } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buffer, { type: "buffer" })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        table = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            blankrows: false,
            defval: "",
            raw: false,
        })
    } else {
        return { rows: [], errors: [`ไม่รองรับไฟล์นามสกุล .${ext} (รองรับ .csv และ .xlsx)`] }
    }

    if (table.length < 2) {
        return { rows: [], errors: ["ไฟล์ว่างหรือไม่มีข้อมูล (ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว)"] }
    }

    const headerMap = mapHeaders(table[0].map((c) => String(c ?? "")))
    if (headerMap.sku === undefined || headerMap.name === undefined || headerMap.price === undefined) {
        return {
            rows: [],
            errors: [
                "ไฟล์ต้องมีคอลัมน์ SKU (หรือ id), ชื่อสินค้า (name) และราคา (price) เป็นอย่างน้อย",
            ],
        }
    }

    const rows: ParsedProductRow[] = []
    const errors: string[] = []
    const seenSku = new Set<string>()
    const dataRows = table.slice(1, 1 + MAX_ROWS)

    const cell = (cols: string[], idx: number | undefined): string | undefined =>
        idx === undefined ? undefined : String(cols[idx] ?? "").trim()

    dataRows.forEach((cols, i) => {
        const lineNo = i + 2 // human-friendly (header = line 1)
        const sku = cell(cols, headerMap.sku)
        const name = cell(cols, headerMap.name)
        const price = parsePrice(cell(cols, headerMap.price))

        if (!sku) {
            errors.push(`แถวที่ ${lineNo}: ไม่มี SKU — ข้าม`)
            return
        }
        if (!name) {
            errors.push(`แถวที่ ${lineNo} (SKU ${sku}): ไม่มีชื่อสินค้า — ข้าม`)
            return
        }
        if (!Number.isFinite(price) || price < 0) {
            errors.push(`แถวที่ ${lineNo} (SKU ${sku}): ราคาไม่ถูกต้อง — ข้าม`)
            return
        }
        if (seenSku.has(sku)) {
            errors.push(`แถวที่ ${lineNo}: SKU ${sku} ซ้ำในไฟล์ — ใช้ค่าล่าสุด`)
        }
        seenSku.add(sku)

        rows.push({
            sku,
            name,
            category: cell(cols, headerMap.category) || null,
            price,
            description: cell(cols, headerMap.description) || null,
            stock: parseStock(cell(cols, headerMap.stock)),
            unit: cell(cols, headerMap.unit) || null,
            isActive: parseActive(cell(cols, headerMap.isActive)),
        })
    })

    return { rows, errors }
}

/**
 * Upsert parsed product rows into PostgreSQL keyed on SKU and, for FULL_SYNC,
 * deactivate products absent from the file.
 */
export async function syncInventory(
    rows: ParsedProductRow[],
    mode: ImportMode,
    parseErrors: string[] = []
): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
        created: 0,
        updated: 0,
        deactivated: 0,
        skipped: 0,
        totalRows: rows.length,
        errors: [...parseErrors],
    }

    for (const row of rows) {
        try {
            const existing = await prisma.product.findUnique({
                where: { sku: row.sku },
                select: { id: true },
            })

            await prisma.product.upsert({
                where: { sku: row.sku },
                update: {
                    name: row.name,
                    category: row.category,
                    price: row.price,
                    description: row.description,
                    stock: row.stock,
                    ...(row.unit ? { unit: row.unit } : {}),
                    isActive: row.isActive,
                },
                create: {
                    sku: row.sku,
                    name: row.name,
                    category: row.category,
                    price: row.price,
                    description: row.description,
                    stock: row.stock,
                    ...(row.unit ? { unit: row.unit } : {}),
                    isActive: row.isActive,
                },
            })

            if (existing) result.updated++
            else result.created++
        } catch (e) {
            result.skipped++
            result.errors.push(
                `SKU ${row.sku}: บันทึกไม่สำเร็จ (${e instanceof Error ? e.message : "unknown"})`
            )
        }
    }

    if (mode === "FULL_SYNC" && rows.length > 0) {
        const keepSkus = rows.map((r) => r.sku)
        const deactivated = await prisma.product.updateMany({
            where: {
                isActive: true,
                sku: { notIn: keepSkus, not: null },
            },
            data: { isActive: false },
        })
        result.deactivated = deactivated.count
    }

    return result
}
