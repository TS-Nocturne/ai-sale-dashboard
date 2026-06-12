import "server-only"

/** Slip2Go account types for PromptPay / checkReceiver. */
export type Slip2GoAccountType = "phone_number" | "citizen_id" | "e_wallet"

const TYPE_ALIASES: Record<string, Slip2GoAccountType> = {
    natid: "citizen_id",
    national_id: "citizen_id",
    citizen: "citizen_id",
    citizen_id: "citizen_id",
    id_card: "citizen_id",
    phone: "phone_number",
    mobile: "phone_number",
    tel: "phone_number",
    phone_number: "phone_number",
    e_wallet: "e_wallet",
    ewallet: "e_wallet",
    wallet: "e_wallet",
}

/** Map .env values like NATID → citizen_id for Slip2Go APIs. */
export function normalizePromptPayType(raw?: string | null): Slip2GoAccountType {
    const key = (raw ?? "phone_number").trim().toLowerCase()
    return TYPE_ALIASES[key] ?? "phone_number"
}

/** Strip spaces/dashes so 1-7399... and 1739902268848 match. */
export function normalizePromptPayCode(raw?: string | null): string {
    return (raw ?? "").replace(/\D/g, "")
}

export function promptPaySettingsFromEnv(): {
    code: string
    type: Slip2GoAccountType
    accountName: string
} {
    return {
        code: normalizePromptPayCode(process.env.PROMPTPAY_CODE),
        type: normalizePromptPayType(process.env.PROMPTPAY_TYPE),
        accountName: (process.env.PROMPTPAY_ACCOUNT_NAME ?? "ร้านค้า").trim(),
    }
}
