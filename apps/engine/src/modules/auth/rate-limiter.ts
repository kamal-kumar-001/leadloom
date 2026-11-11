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

/**
 * Shared-store fixed-window limiter backed by Postgres: the limit holds across
 * engine replicas and restarts, unlike SlidingWindowLimiter. Used for public
 * routes (validator /v/ pages) where per-process limits are bypassable by
 * hitting a different replica.
 *
 * One atomic upsert per request: INSERT ... ON CONFLICT increment, RETURNING
 * the bucket count - no count-then-insert race, so concurrent contenders
 * across replicas cannot over-admit. Storage is bounded to one row per key
 * per window and denied requests UPDATE the same bucket row. Fixed windows
 * can admit up to 2x the cap at a boundary; acceptable for abuse control.
 * Buckets are keyed on the DB clock (now()) so replica clock skew cannot
 * split a window.
 *
 * Write-rate bound: a per-process deny cache short-circuits keys that were
 * just denied, so a flooding key costs at most one DB write per cache TTL
 * (60s) instead of one per request. The DB stays the source of truth for
 * allows; the cache only ever denies. Cleanup deletes are batch-bounded
 * (1000 rows per pass, ~1/100 of takes) so the janitor cannot run an
 * unbounded delete on a shared database.
 *
 * Fail-closed: any store error returns 'error' and callers deny the request
 * (503), never fail open.
 */
export type RawQuery = (text: string, params: unknown[]) => Promise<Array<Record<string, unknown>>>;
export type LimitVerdict = 'allow' | 'deny' | 'error';

const MAX_KEY_LENGTH = 255;
const DENY_CACHE_TTL_MS = 60_000;
const CLEANUP_BATCH = 1000;

export class PgSharedLimiter {
  private takes = 0;
  private readonly deniedUntil = new Map<string, number>();
  constructor(private readonly query: RawQuery, private readonly windowMs: number, private readonly now: () => number = Date.now) {}
  /** Records the hit and returns whether the action is allowed. */
  async take(key: string, max: number): Promise<LimitVerdict> {
    const boundedKey = key.slice(0, MAX_KEY_LENGTH);
    const t = this.now();
    const cachedDeny = this.deniedUntil.get(boundedKey);
    if (cachedDeny !== undefined) {
      if (cachedDeny > t) return 'deny'; // hot key: no DB write
      this.deniedUntil.delete(boundedKey);
    }
    let rows: Array<Record<string, unknown>>;
    try {
      rows = await this.query(
        `INSERT INTO public_rate_limit_buckets ("key", window_start, "count")
         VALUES ($1, floor(extract(epoch from now()) * 1000 / $2::double precision) * $2::double precision, 1)
         ON CONFLICT ("key", window_start) DO UPDATE SET "count" = public_rate_limit_buckets."count" + 1
         RETURNING "count"`,
        [boundedKey, this.windowMs],
      );
    } catch {
      return 'error';
    }
    this.takes += 1;
    if (this.takes % 100 === 0) {
      const cutoff = this.now() - 24 * 3_600_000;
      await this.query(
        `DELETE FROM public_rate_limit_buckets WHERE ctid IN (SELECT ctid FROM public_rate_limit_buckets WHERE window_start < $1 LIMIT ${CLEANUP_BATCH}) RETURNING "key"`,
        [cutoff],
      ).catch(() => []);
    }
    const count = Number(rows[0]?.count ?? Number.MAX_SAFE_INTEGER);
    if (count > max) {
      // Bound flood writes: further hits from this key skip the DB briefly.
      this.deniedUntil.set(boundedKey, this.now() + DENY_CACHE_TTL_MS);
      if (this.deniedUntil.size > 10_000) this.deniedUntil.clear();
      return 'deny';
    }
    return 'allow';
  }
}
