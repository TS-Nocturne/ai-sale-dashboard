import "server-only"

let ngrokBaseCache: { url: string | null; at: number } | null = null
const NGROK_CACHE_MS = 30_000

/**
 * Public HTTPS base URL that LINE servers can fetch images from.
 * Priority: PUBLIC_APP_URL → VERCEL_URL → local ngrok agent (4040).
 */
export async function resolvePublicHttpsBase(): Promise<string | null> {
    const fromEnv = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "")
    if (fromEnv?.startsWith("https://")) return fromEnv

    const vercel = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "")
    if (vercel) return `https://${vercel}`

    const now = Date.now()
    if (ngrokBaseCache && now - ngrokBaseCache.at < NGROK_CACHE_MS) {
        return ngrokBaseCache.url
    }

    try {
        const res = await fetch("http://127.0.0.1:4040/api/tunnels", {
            cache: "no-store",
            signal: AbortSignal.timeout(1500),
        })
        if (res.ok) {
            const data = (await res.json()) as {
                tunnels?: Array<{ proto?: string; public_url?: string }>
            }
            const tunnel = data.tunnels?.find((t) => t.proto === "https")
            const url = tunnel?.public_url?.replace(/\/$/, "") ?? null
            ngrokBaseCache = { url: url?.startsWith("https://") ? url : null, at: now }
            if (ngrokBaseCache.url) {
                console.log(`[public-url] ใช้ ngrok อัตโนมัติ: ${ngrokBaseCache.url}`)
            }
            return ngrokBaseCache.url
        }
    } catch {
        // ngrok agent not running — fall through
    }

    ngrokBaseCache = { url: null, at: now }
    return null
}

export function resetPublicUrlCacheForTests(): void {
    ngrokBaseCache = null
}
