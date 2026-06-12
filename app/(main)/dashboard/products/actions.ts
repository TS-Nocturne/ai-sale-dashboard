"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { getManagerOrNull } from "@/lib/guard"
import {
    type ImportMode,
    type InventorySyncResult,
    parseProductFile,
    syncInventory,
} from "@/lib/inventory"

export interface ProductDTO {
    id: string
    sku: string | null
    name: string
    description: string | null
    category: string | null
    price: number
    stock: number
    unit: string
    isActive: boolean
    soldCount: number
    createdAt: string
}

export interface ActionResult {
    ok: boolean
    message: string
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXT = ["csv", "txt", "xlsx", "xls"]

/** Load all products with quantity sold, newest first (manager/admin only). */
export async function getProducts(): Promise<ProductDTO[]> {
    const manager = await getManagerOrNull()
    if (!manager) return []

    const products = await prisma.product.findMany({
        orderBy: { createdAt: "desc" },
    })

    // Sum quantity sold per product in one grouped query.
    const sold = await prisma.saleItem.groupBy({
        by: ["productId"],
        _sum: { qty: true },
    })
    const soldByProduct = new Map(sold.map((s) => [s.productId, s._sum.qty ?? 0]))

    return products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        stock: p.stock,
        unit: p.unit,
        isActive: p.isActive,
        soldCount: soldByProduct.get(p.id) ?? 0,
        createdAt: p.createdAt.toISOString(),
    }))
}

export interface ProductInput {
    sku?: string
    name: string
    description?: string
    category?: string
    price: number
    stock?: number
    unit?: string
}

function sanitizeInput(input: ProductInput) {
    return {
        sku: input.sku?.trim() || null,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || null,
        price: Number(input.price),
        stock: Number.isFinite(Number(input.stock)) ? Math.max(0, Math.trunc(Number(input.stock))) : 0,
        unit: input.unit?.trim() || "ชิ้น",
    }
}

export async function createProductAction(input: ProductInput): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์เพิ่มสินค้า" }

    const data = sanitizeInput(input)
    if (!data.name) return { ok: false, message: "กรุณาระบุชื่อสินค้า" }
    if (!Number.isFinite(data.price) || data.price < 0) {
        return { ok: false, message: "ราคาไม่ถูกต้อง" }
    }

    try {
        await prisma.product.create({ data })
    } catch (e) {
        // Most likely a duplicate SKU (unique constraint).
        const msg = e instanceof Error && e.message.includes("Unique")
            ? `SKU "${data.sku}" มีอยู่แล้วในระบบ`
            : "บันทึกสินค้าไม่สำเร็จ"
        return { ok: false, message: msg }
    }

    revalidatePath("/dashboard/products")
    return { ok: true, message: "เพิ่มสินค้าเรียบร้อยแล้ว" }
}

export async function updateProductAction(
    id: string,
    input: ProductInput
): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์แก้ไขสินค้า" }

    const data = sanitizeInput(input)
    if (!data.name) return { ok: false, message: "กรุณาระบุชื่อสินค้า" }
    if (!Number.isFinite(data.price) || data.price < 0) {
        return { ok: false, message: "ราคาไม่ถูกต้อง" }
    }

    try {
        await prisma.product.update({ where: { id }, data })
    } catch (e) {
        const msg = e instanceof Error && e.message.includes("Unique")
            ? `SKU "${data.sku}" มีอยู่แล้วในระบบ`
            : "แก้ไขสินค้าไม่สำเร็จ"
        return { ok: false, message: msg }
    }

    revalidatePath("/dashboard/products")
    return { ok: true, message: "แก้ไขสินค้าเรียบร้อยแล้ว" }
}

export async function toggleProductActiveAction(id: string): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์" }

    const product = await prisma.product.findUnique({ where: { id }, select: { isActive: true } })
    if (!product) return { ok: false, message: "ไม่พบสินค้า" }

    await prisma.product.update({ where: { id }, data: { isActive: !product.isActive } })
    revalidatePath("/dashboard/products")
    return { ok: true, message: product.isActive ? "ปิดใช้งานสินค้าแล้ว" : "เปิดใช้งานสินค้าแล้ว" }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์ลบสินค้า" }

    try {
        await prisma.product.delete({ where: { id } })
    } catch {
        // A product referenced by past sales cannot be deleted — deactivate it instead.
        await prisma.product.update({ where: { id }, data: { isActive: false } })
        revalidatePath("/dashboard/products")
        return {
            ok: true,
            message: "สินค้านี้มีประวัติการขาย จึงปิดใช้งานแทนการลบ",
        }
    }

    revalidatePath("/dashboard/products")
    return { ok: true, message: "ลบสินค้าเรียบร้อยแล้ว" }
}

export interface ImportResult extends ActionResult {
    summary?: InventorySyncResult
}

/** Import an uploaded inventory file (CSV/Excel) using the chosen import mode. */
export async function importInventoryAction(formData: FormData): Promise<ImportResult> {
    const manager = await getManagerOrNull()
    if (!manager) return { ok: false, message: "ไม่มีสิทธิ์นำเข้าสินค้า" }

    const file = formData.get("file")
    const modeRaw = String(formData.get("mode") ?? "APPEND")
    const mode: ImportMode = modeRaw === "FULL_SYNC" ? "FULL_SYNC" : "APPEND"

    if (!(file instanceof File) || file.size === 0) {
        return { ok: false, message: "กรุณาเลือกไฟล์ที่ต้องการนำเข้า" }
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return { ok: false, message: "ไฟล์ใหญ่เกินไป (จำกัดที่ 5 MB)" }
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (!ALLOWED_EXT.includes(ext)) {
        return { ok: false, message: "รองรับเฉพาะไฟล์ .csv และ .xlsx เท่านั้น" }
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let parsed
    try {
        parsed = await parseProductFile(buffer, file.name)
    } catch (e) {
        return {
            ok: false,
            message: `อ่านไฟล์ไม่สำเร็จ: ${e instanceof Error ? e.message : "unknown"}`,
        }
    }

    if (parsed.rows.length === 0) {
        return {
            ok: false,
            message: parsed.errors[0] ?? "ไม่พบข้อมูลสินค้าในไฟล์",
            summary: {
                created: 0,
                updated: 0,
                deactivated: 0,
                skipped: 0,
                totalRows: 0,
                errors: parsed.errors,
            },
        }
    }

    const summary = await syncInventory(parsed.rows, mode, parsed.errors)
    revalidatePath("/dashboard/products")

    const modeLabel = mode === "FULL_SYNC" ? "ซิงค์สมบูรณ์" : "อัปเดต/เพิ่มใหม่"
    return {
        ok: true,
        message:
            `นำเข้าสำเร็จ (${modeLabel}): เพิ่มใหม่ ${summary.created}, ` +
            `อัปเดต ${summary.updated}` +
            (summary.deactivated ? `, ปิดใช้งาน ${summary.deactivated}` : "") +
            (summary.skipped ? `, ข้าม ${summary.skipped}` : ""),
        summary,
    }
}
