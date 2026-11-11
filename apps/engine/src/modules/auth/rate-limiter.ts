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
 * Shared-store sliding-window limiter backed by Postgres: the limit holds
 * across engine replicas and restarts, unlike SlidingWindowLimiter. Used for
 * public routes (validator /v/ pages) where per-process limits are bypassable
 * by hitting a different replica.
 *
 * take() is one round-trip: insert the hit, then count the key's prior hits
 * inside the window. Note the data-modifying CTE rule: the count does NOT see
 * the row inserted by its own statement, so it counts prior hits and the
 * allow condition is prior < max. Concurrent requests can both pass the count
 * check and slightly over-admit at the boundary - acceptable for abuse
 * control, and vastly stricter than a per-process limit. Denied takes are
 * still recorded, keeping abuse visible. Old rows are deleted
 * opportunistically (1/100 of takes) so the table stays small.
 */
export type RawQuery = (text: string, params: unknown[]) => Promise<Array<Record<string, unknown>>>;

export class PgSharedLimiter {
  private takes = 0;
  constructor(private readonly query: RawQuery, private readonly windowMs: number) {}
  /** Returns true if the action is allowed and records it. */
  async take(key: string, max: number): Promise<boolean> {
    const rows = await this.query(
      `WITH ins AS (INSERT INTO public_rate_limit_hits ("key", ts) VALUES ($1, now()) RETURNING ts)
       SELECT count(*)::int AS n FROM public_rate_limit_hits WHERE "key" = $1 AND ts > now() - ($2::double precision || ' milliseconds')::interval`,
      [key, this.windowMs],
    );
    if (++this.takes % 100 === 0) {
      await this.query(`DELETE FROM public_rate_limit_hits WHERE ts < now() - interval '1 day' RETURNING id`, []).catch(() => []);
    }
    const prior = Number(rows[0]?.n ?? max); // count excludes this statement's own insert
    return prior < max;
  }
}
