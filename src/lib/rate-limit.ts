// src/lib/rate-limit.ts
// In-memory sliding window rate limiter for API routes.
// No external dependencies — uses Map with automatic cleanup.

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Check if a request is within rate limits.
 * @param key - Unique identifier (e.g., userId or IP)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, remaining: number, retryAfterMs: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}
