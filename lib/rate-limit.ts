/*
 * In-memory sliding-window rate limiter.
 *
 * Designed for Vercel single-instance Node.js routes. Each entry tracks the
 * timestamps of the last N requests for a key; we drop anything outside the
 * window before counting. Cleanup happens lazily on each call — no timers,
 * no memory leaks across hot reloads in dev.
 *
 * Limits to know about:
 *  - State is per Node.js process. If a route is replicated across regions,
 *    each region has its own counter. Acceptable for V1 since we're on a
 *    single Vercel region (eu-west-1) and the goal is to stop bursts, not
 *    distributed attacks.
 *  - For multi-region or higher-stakes endpoints, swap the storage layer
 *    here for Upstash Redis without changing the call sites.
 */

type Bucket = number[];

const buckets = new Map<string, Bucket>();

// Periodic-ish cleanup: every time the map gets too large, drop stale buckets.
const MAX_TRACKED_KEYS = 5000;

function pruneIfNeeded(now: number, windowMs: number) {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  const cutoff = now - windowMs;
  // forEach for compatibility with the project's es5 target (no Map iteration).
  buckets.forEach((stamps, key) => {
    const fresh = stamps.filter((t: number) => t > cutoff);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, fresh);
    }
  });
}

export interface RateLimitResult {
  ok: boolean;
  /** Number of requests still allowed in the current window. */
  remaining: number;
  /** When the next request would be allowed (epoch ms). Only set when blocked. */
  retryAfterMs?: number;
}

/**
 * Sliding-window check. Records the call as accepted if it fits, otherwise
 * returns ok=false without recording (so blocked requests don't extend the
 * penalty window).
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const stamps = buckets.get(key) || [];
  // Drop expired entries
  const fresh = stamps.filter((t) => t > cutoff);

  if (fresh.length >= limit) {
    // Blocked — compute when the oldest in-window entry will expire
    const oldest = fresh[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, fresh);
    return { ok: false, remaining: 0, retryAfterMs };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  pruneIfNeeded(now, windowMs);

  return { ok: true, remaining: limit - fresh.length };
}

/**
 * Best-effort client IP extraction. Vercel sets x-forwarded-for; Cloudflare
 * sets cf-connecting-ip when in front. Falls back to "unknown" so callers
 * still get a stable bucket key.
 */
export function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

/**
 * Convenience: build a JSON 429 response with Retry-After header.
 */
export function rateLimitResponse(result: RateLimitResult) {
  const seconds = Math.ceil((result.retryAfterMs || 1000) / 1000);
  return new Response(
    JSON.stringify({
      error: 'Trop de requêtes, veuillez patienter quelques instants.',
      retry_after: seconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(seconds),
      },
    },
  );
}
