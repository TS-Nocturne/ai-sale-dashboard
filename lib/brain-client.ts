import "server-only"

/** Base URL of the Python LangGraph brain (FastAPI). */
export const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8000"

const BRAIN_API_KEY = (process.env.BRAIN_API_KEY ?? "").trim()

/** Merge brain auth headers into outbound requests (server-side only). */
export function brainRequestHeaders(
    init?: HeadersInit
): Record<string, string> {
    const headers = new Headers(init)
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
    }
    if (BRAIN_API_KEY) {
        headers.set("x-brain-key", BRAIN_API_KEY)
    }
    return Object.fromEntries(headers.entries())
}

/**
 * LangGraph + Gemini often needs 30–90s (tools + lead scoring).
 * Node's default fetch headers timeout is ~30s — too short for /chat.
 */
export const AI_SERVICE_TIMEOUT_MS = Number(
    process.env.AI_SERVICE_TIMEOUT_MS ?? 120_000
)

/** Fast ack endpoints (/chat/async) should return in under a second. */
export const AI_SERVICE_ACK_TIMEOUT_MS = Number(
    process.env.AI_SERVICE_ACK_TIMEOUT_MS ?? 15_000
)

export function isBrainFetchTimeout(cause: unknown): boolean {
    if (!cause || typeof cause !== "object") return false
    const err = cause as { code?: string; name?: string; cause?: { code?: string } }
    if (err.name === "TimeoutError" || err.name === "AbortError") return true
    const code = err.code ?? err.cause?.code
    return (
        code === "UND_ERR_HEADERS_TIMEOUT" ||
        code === "UND_ERR_BODY_TIMEOUT" ||
        code === "UND_ERR_CONNECT_TIMEOUT"
    )
}

/** Fetch the brain with an explicit long timeout (server-side only). */
export async function fetchBrain(
    path: string,
    init?: RequestInit,
    timeoutMs: number = AI_SERVICE_TIMEOUT_MS
): Promise<Response> {
    return fetch(`${AI_SERVICE_URL}${path}`, {
        ...init,
        headers: brainRequestHeaders(init?.headers),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
    })
}
