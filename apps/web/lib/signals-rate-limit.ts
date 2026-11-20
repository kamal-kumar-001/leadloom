/**
 * In-memory sliding-window rate limiter for the signals routes.
 * Instance-only state: resets on restart and is per server instance, which
 * is intentional for this session-only slice. Keyed per authenticated user.
 */
const windows = new Map<string, number[]>();
const inFlight = new Map<string, number>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  nowFn: () => number = () => Date.now(),
): { allowed: boolean; retryAfterSec: number } {
  const now = nowFn();
  const list = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    const oldest = list[0];
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  list.push(now);
  windows.set(key, list);
  return { allowed: true, retryAfterSec: 0 };
}

export function acquireInFlight(key: string, maxConcurrent: number): boolean {
  const n = inFlight.get(key) ?? 0;
  if (n >= maxConcurrent) return false;
  inFlight.set(key, n + 1);
  return true;
}

export function releaseInFlight(key: string): void {
  const n = inFlight.get(key) ?? 0;
  if (n <= 1) inFlight.delete(key);
  else inFlight.set(key, n - 1);
}

export function resetRateLimits(): void {
  windows.clear();
  inFlight.clear();
}
