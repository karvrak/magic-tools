/**
 * Simple in-memory rate limiter for auth routes.
 * Tracks attempts per key (IP or email) with a sliding window.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  max: number
  /** Window duration in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowSeconds * 1000 })
    return { allowed: true, remaining: options.max - 1, resetAt: now + options.windowSeconds * 1000 }
  }

  entry.count++

  if (entry.count > options.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: options.max - entry.count, resetAt: entry.resetAt }
}
