const WINDOW_MS = 5 * 60 * 1000;
const MAX_UPLOADS = 10;

const hits = new Map<string, number[]>();

/**
 * Sliding-window limiter keyed by hashed device+IP.
 * In-memory, single-process — sufficient for the MVP's single-instance deployment.
 */
export function isRateLimited(key: string, max = MAX_UPLOADS, windowMs = WINDOW_MS): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= max) {
    hits.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hits.entries()) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}, 10 * 60 * 1000).unref();
