/**
 * Small in-memory sliding-window limiter for abuse control on public-ish
 * endpoints. Limits: per process only (resets on restart, not shared across
 * replicas), and per-IP keys are only meaningful if the proxy's real client IP
 * reaches the engine (the engine is loopback-only today, so callers should also
 * pass a second, global key).
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly max: number, private readonly windowMs: number, private readonly now: () => number = Date.now, private readonly maxKeys = 10_000) {}
  /** Returns true if the action is allowed and records it. */
  take(key: string): boolean {
    const t = this.now();
    const fresh = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs);
    if (fresh.length >= this.max) { this.hits.set(key, fresh); return false; }
    fresh.push(t); this.hits.set(key, fresh);
    if (this.hits.size > this.maxKeys) { for (const [k, v] of this.hits) { if (!v.some((h) => t - h < this.windowMs)) this.hits.delete(k); } }
    return true;
  }
}
