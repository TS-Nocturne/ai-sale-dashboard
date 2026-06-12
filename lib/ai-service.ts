/**
 * Client for the Python "brain" (FastAPI + LangGraph).
 *
 * This runs on the Next.js server only (called from API routes / server
 * actions). The browser never talks to the brain directly — requests go
 * through our authenticated BFF routes under /api/ai/*.
 */

import {
    AI_SERVICE_URL,
    AI_SERVICE_ACK_TIMEOUT_MS,
    fetchBrain,
    isBrainFetchTimeout,
} from "@/lib/brain-client"

const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504])
const MAX_ATTEMPTS = 3

export interface AgentResponse {
    thread_id: string
    reply: string
    lead_score: number
    pipeline_stage: string
    requires_approval: boolean
    pending_discount_approval: PendingDiscount | null
    next_nodes: string[]
    resumed?: boolean | null
    shipping_info: ShippingInfo | null
    order_ready: boolean
    payment_qr: PaymentQr | null
    pending_overpay: PendingOverpay | null
    overpay_resolution: string | null
    overpay_credit_amount: number
    awaiting_refund_approval: boolean
}

export interface ChatAcceptedResponse {
    thread_id: string
    status: "accepted"
    reply: string
    async_mode: boolean
}

export interface PendingOverpay {
    overpaid_amount?: number
    total_amount?: number
    paid_amount?: number
}

export interface PaymentQr {
    amount?: number
    account_name?: string
    prompt_pay_code?: string
    image_base64?: string
    items?: string
    /** Use the fixed store PromptPay QR image (full payment). */
    use_static?: boolean
    /** Pre-built public HTTPS URL (static or partial QR). */
    static_url?: string
    /** True when QR is for a partial/missing balance only. */
    is_partial?: boolean
}

export interface ShippingInfo {
    customer_name?: string
    phone?: string
    address?: string
    postal_code?: string
    payment_method?: string // "TRANSFER" | "COD"
    amount?: number
    items?: string
}

export interface PendingDiscount {
    product?: string
    discount_pct?: number
    reason?: string
    original_price?: number
}

class AIServiceError extends Error {
    constructor(
        message: string,
        public status: number,
        options?: ErrorOptions
    ) {
        super(message, options)
        this.name = "AIServiceError"
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(status: number, message: string): boolean {
    if (RETRYABLE_HTTP_STATUSES.has(status)) return true
    return /unavailable|high demand|overloaded|rate limit|try again|resourceexhausted|timeout|timed out/i.test(
        message
    )
}

function brainConnectionError(cause: unknown, ack = false): AIServiceError {
    if (isBrainFetchTimeout(cause)) {
        const limitMs = ack
            ? AI_SERVICE_ACK_TIMEOUT_MS
            : Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 120_000)
        return new AIServiceError(
            ack
                ? `ไม่ได้รับการตอบรับจาก AI ภายใน ${Math.round(limitMs / 1000)} วินาที — ตรวจสอบว่า brain รันอยู่และโหลดโค้ดล่าสุดแล้ว`
                : `บริการ AI ใช้เวลาตอบนานเกินไป (เกิน ${Math.round(limitMs / 1000)} วินาที) — ลองใหม่อีกครั้ง`,
            ack ? 503 : 504,
            { cause }
        )
    }
    return new AIServiceError(
        `ไม่สามารถเชื่อมต่อกับบริการ AI ได้ (${AI_SERVICE_URL}). ตรวจสอบว่ารัน 'python -m ai_sales serve' แล้วหรือยัง`,
        503,
        { cause }
    )
}

async function postJsonOnce<T>(path: string, body: unknown): Promise<T> {
    let res: Response
    try {
        res = await fetchBrain(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
    } catch (cause) {
        throw brainConnectionError(cause)
    }

    if (!res.ok) {
        let detail = `AI service error (${res.status})`
        try {
            const data = (await res.json()) as { detail?: string }
            if (data?.detail) detail = data.detail
        } catch {
            // ignore parse errors, keep default detail
        }
        throw new AIServiceError(detail, res.status)
    }

    return (await res.json()) as T
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
    let lastError: AIServiceError | undefined

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            return await postJsonOnce<T>(path, body)
        } catch (error) {
            if (!(error instanceof AIServiceError)) throw error
            lastError = error
            const retryable = isRetryableError(error.status, error.message)
            if (!retryable || attempt >= MAX_ATTEMPTS - 1) throw error
            await sleep(1000 * 2 ** attempt)
        }
    }

    throw lastError ?? new AIServiceError("AI service error", 503)
}

async function postJsonAccept202<T>(path: string, body: unknown): Promise<T> {
    let res: Response
    try {
        res = await fetchBrain(
            path,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            },
            AI_SERVICE_ACK_TIMEOUT_MS
        )
    } catch (cause) {
        throw brainConnectionError(cause, true)
    }

    if (res.status === 202) {
        return (await res.json()) as T
    }

    // Old brain without /chat/async — fall back body may still be 202 on /chat
    if (res.ok) {
        const data = (await res.json()) as T & { status?: string; async_mode?: boolean }
        if (data?.status === "accepted") {
            return data as T
        }
    }

    if (!res.ok) {
        let detail = `AI service error (${res.status})`
        try {
            const data = (await res.json()) as { detail?: string }
            if (data?.detail) detail = data.detail
        } catch {
            // ignore parse errors, keep default detail
        }
        throw new AIServiceError(detail, res.status)
    }

    throw new AIServiceError(
        "AI service returned unexpected response (expected 202 accepted)",
        502
    )
}

/** Enqueue a customer message — brain returns immediately, LINE push happens later. */
export async function enqueueMessageToBrain(
    threadId: string,
    message: string,
    delivery?: {
        linePushTarget?: string
        displayName?: string | null
        attachPaymentQr?: PaymentQr | null
    },
    paymentContext?: PendingOverpay | null
): Promise<ChatAcceptedResponse> {
    const payload = {
        thread_id: threadId,
        message,
        payment_context: paymentContext ?? undefined,
        delivery: {
            line_push_target: delivery?.linePushTarget,
            display_name: delivery?.displayName ?? undefined,
            attach_payment_qr: delivery?.attachPaymentQr ?? undefined,
        },
    }

    try {
        return await postJsonAccept202<ChatAcceptedResponse>("/chat/async", payload)
    } catch (error) {
        // Brain รุ่นเก่าที่ยังไม่มี /chat/async — ใช้ /chat?async_mode แทน
        if (error instanceof AIServiceError && error.status === 404) {
            return postJsonAccept202<ChatAcceptedResponse>("/chat", {
                ...payload,
                async_mode: true,
            })
        }
        throw error
    }
}

/** Send a customer message to the brain for a given conversation thread. */
export async function sendMessageToBrain(
    threadId: string,
    message: string,
    paymentContext?: PendingOverpay | null
): Promise<AgentResponse> {
    return postJson<AgentResponse>("/chat", {
        thread_id: threadId,
        message,
        payment_context: paymentContext ?? undefined,
    })
}

/** Resume a paused conversation with the manager's discount decision. */
export async function sendApprovalToBrain(
    threadId: string,
    approved: boolean
): Promise<AgentResponse> {
    return postJson<AgentResponse>("/approval", {
        thread_id: threadId,
        approved,
    })
}

/**
 * Manager approval.
 *
 * Sends the manager's decision to the Python brain's `POST /approval`, which
 * resumes the interrupted LangGraph run. The brain only needs the boolean
 * decision; `decidedBy` is recorded on our side (ApprovalRequest.decidedBy).
 */
export async function decideDiscountApproval(
    threadId: string,
    action: "approve" | "reject"
): Promise<AgentResponse> {
    return postJson<AgentResponse>("/approval", {
        thread_id: threadId,
        approved: action === "approve",
    })
}

async function fetchJsonOnce<T>(path: string): Promise<T> {
    let res: Response
    try {
        res = await fetchBrain(path)
    } catch (cause) {
        throw brainConnectionError(cause)
    }

    if (!res.ok) {
        let detail = `AI service error (${res.status})`
        try {
            const data = (await res.json()) as { detail?: string }
            if (data?.detail) detail = data.detail
        } catch {
            // ignore
        }
        throw new AIServiceError(detail, res.status)
    }

    return (await res.json()) as T
}

/** Read the current LangGraph state for an existing conversation thread. */
export async function getBrainState(threadId: string): Promise<AgentResponse> {
    const path = `/state/${encodeURIComponent(threadId)}`
    let lastError: AIServiceError | undefined

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            return await fetchJsonOnce<AgentResponse>(path)
        } catch (error) {
            if (!(error instanceof AIServiceError)) throw error
            lastError = error
            const retryable = isRetryableError(error.status, error.message)
            if (!retryable || attempt >= MAX_ATTEMPTS - 1) throw error
            await sleep(1000 * 2 ** attempt)
        }
    }

    throw lastError ?? new AIServiceError("AI service error", 503)
}

export { AIServiceError }
