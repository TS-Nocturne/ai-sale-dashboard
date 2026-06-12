import "server-only"

import {
    promptPaySettingsFromEnv,
} from "@/lib/promptpay-config"

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | null {
    return value && typeof value === "object" ? (value as Json) : null
}

/** Expected slip amount for our own reconciliation (not sent to Slip2Go). */
export function expectedSlipAmount(order: {
    totalAmount: number | null
    amount: number | null
    paidAmount: number
}): number | null {
    const total = order.totalAmount ?? order.amount
    if (total == null || total <= 0) return null

    const paid = order.paidAmount ?? 0
    const missing = Math.round((total - paid) * 100) / 100
    if (missing <= 0.01) return total
    return missing
}

export type SlipValidationFailure =
    | "receiver_mismatch"
    | "duplicate"
    | "unreadable"
    | "provider_rejected"

/**
 * Slip2Go checkCondition — verify slip authenticity + duplicate + receiver.
 * Receiver schema must use `{ type, number }` (NOT accountType/accountNumber).
 */
export function buildSlipCheckCondition(): Record<string, unknown> {
    const condition: Record<string, unknown> = { checkDuplicate: true }
    const { code, type } = promptPaySettingsFromEnv()
    if (code) {
        condition.checkReceiver = [{ type, number: code }]
    }
    return condition
}

const SLIP_FAIL_CODES = new Set(["200500"])

function responseCode(resp: Json): string {
    const data = asRecord(resp.data)
    const raw = resp.code ?? data?.code
    return raw == null ? "" : String(raw)
}

function checkEntryFailed(value: unknown): boolean {
    if (value === false) return true
    const row = asRecord(value)
    return row?.valid === false || row?.pass === false || row?.success === false
}

/** True when Slip2Go read the slip and duplicate/receiver checks passed. */
export function isSlip2GoResponseValid(resp: Json): boolean {
    const code = responseCode(resp)
    if (SLIP_FAIL_CODES.has(code) || code.startsWith("400")) return false
    if (/fraud|ปลอม|fake/i.test(String(resp.message ?? ""))) return false

    if (resp.valid === false || resp.success === false) return false
    if (typeof resp.code === "number" && resp.code !== 200 && resp.code !== 0) {
        return false
    }

    const data = asRecord(resp.data) ?? resp
    if (data.valid === false) return false

    for (const key of ["checkCondition", "checkConditions", "conditionResult"]) {
        const checks = asRecord(resp[key]) ?? asRecord(data[key])
        if (!checks) continue
        for (const [, val] of Object.entries(checks)) {
            if (checkEntryFailed(val)) return false
        }
    }

    return Boolean(code.startsWith("200") || resp.success === true || data.amount != null)
}

/** Best-effort reason when Slip2Go rejects a slip image. */
export function describeSlipValidationFailure(resp: Json): SlipValidationFailure {
    const data = asRecord(resp.data) ?? resp
    const checks =
        asRecord(resp.checkCondition) ??
        asRecord(resp.checkConditions) ??
        asRecord(data.checkCondition) ??
        asRecord(data.checkConditions)

    if (checks) {
        if (checkEntryFailed(checks.checkDuplicate)) return "duplicate"
        if (checkEntryFailed(checks.checkReceiver)) return "receiver_mismatch"
        if (checkEntryFailed(checks.checkAmount)) return "provider_rejected"
    }

    const message = String(resp.message ?? data.message ?? "")
    if (/fraud|ปลอม|fake/i.test(message)) return "unreadable"
    if (/duplicate|ซ้ำ/i.test(message)) return "duplicate"
    if (/receiver|ผู้รับ|บัญชี/i.test(message)) return "receiver_mismatch"

    return "unreadable"
}

export function slipInvalidUserMessage(reason: SlipValidationFailure): string {
    switch (reason) {
        case "receiver_mismatch":
            return (
                "ขออภัยค่ะ สลิปนี้โอนเข้าบัญชีที่ไม่ตรงกับบัญชีร้าน " +
                "รบกวนตรวจสอบว่าโอนเข้า PromptPay ของร้านถูกต้อง แล้วส่งสลิปใหม่อีกครั้งนะคะ 🙏"
            )
        case "duplicate":
            return (
                "สลิปนี้เคยถูกใช้ยืนยันการชำระเงินไปแล้วค่ะ 🙏 " +
                "หากเป็นการโอนครั้งใหม่ รบกวนส่งสลิปการโอนล่าสุดให้ทางร้านตรวจสอบอีกครั้งนะคะ"
            )
        case "provider_rejected":
            return (
                "ขออภัยค่ะ ระบบตรวจสอบสลิปไม่ผ่านเงื่อนไขของผู้ให้บริการ " +
                "รบกวนส่งรูปสลิปที่เห็นยอดเงินและเวลาโอนชัดเจนอีกครั้งนะคะ 🙏"
            )
        default:
            return (
                "ขออภัยค่ะ ระบบตรวจสอบไม่พบข้อมูลการโอนในรูปที่ส่งมา " +
                "รบกวนส่งรูปสลิปการโอนที่ชัดเจน (เห็นยอดเงินและเวลาโอน) อีกครั้งนะคะ 🙏"
            )
    }
}
