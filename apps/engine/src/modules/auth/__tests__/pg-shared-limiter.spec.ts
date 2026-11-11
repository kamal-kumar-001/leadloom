import { describe, expect, it } from 'vitest';
import { PgSharedLimiter, type RawQuery } from '../rate-limiter';

describe('PgSharedLimiter (fake bucket store)', () => {
  /** In-memory emulation of the bucket upsert: one row per key per window, atomic increment. */
  const fakeStore = (windowMs: number) => {
    const buckets = new Map<string, number>();
    let now = 1_000_000_000;
    const calls: Array<{ text: string; params: unknown[] }> = [];
    const query: RawQuery = async (text, params) => {
      calls.push({ text, params });
      if (text.startsWith('INSERT INTO public_rate_limit_buckets')) {
        const [rawKey] = params as [string, number];
        const windowStart = Math.floor(now / windowMs) * windowMs;
        const id = `${rawKey}${windowStart}`;
        const count = (buckets.get(id) ?? 0) + 1;
        buckets.set(id, count);
        return [{ count }];
      }
      return []; // cleanup delete
    };
    return { query, calls, advance: (ms: number) => { now += ms; }, bucketCount: () => buckets.size, getNow: () => now };
  };

  it('allows up to max hits per window, then denies', async () => {
    const l = new PgSharedLimiter(fakeStore(600_000).query, 600_000);
    for (let i = 0; i < 5; i++) expect(await l.take('k', 5)).toBe('allow');
    expect(await l.take('k', 5)).toBe('deny');
    expect(await l.take('k', 5)).toBe('deny');
  });

  it('denied hits update the same bucket row (bounded storage and writes)', async () => {
    const store = fakeStore(600_000);
    const l = new PgSharedLimiter(store.query, 600_000);
    for (let i = 0; i < 30; i++) await l.take('k', 5);
    expect(store.bucketCount()).toBe(1); // 30 hits, one row
  });

  it('keys are independent', async () => {
    const l = new PgSharedLimiter(fakeStore(600_000).query, 600_000);
    for (let i = 0; i < 3; i++) expect(await l.take('a', 3)).toBe('allow');
    expect(await l.take('a', 3)).toBe('deny');
    expect(await l.take('b', 3)).toBe('allow');
  });

  it('a new window frees capacity', async () => {
    const store = fakeStore(1000);
    const l = new PgSharedLimiter(store.query, 1000, store.getNow);
    expect(await l.take('k', 2)).toBe('allow');
    expect(await l.take('k', 2)).toBe('allow');
    expect(await l.take('k', 2)).toBe('deny');
    // The deny cache holds for its TTL even across the window boundary...
    store.advance(1001);
    expect(await l.take('k', 2)).toBe('deny');
    // ...then the store (source of truth) frees capacity for the new window.
    store.advance(60_000);
    expect(await l.take('k', 2)).toBe('allow');
  });

  it('two limiter instances over one store share the count (the replica case)', async () => {
    const store = fakeStore(600_000);
    const a = new PgSharedLimiter(store.query, 600_000);
    const b = new PgSharedLimiter(store.query, 600_000);
    expect(await a.take('k', 2)).toBe('allow');
    expect(await b.take('k', 2)).toBe('allow');
    expect(await a.take('k', 2)).toBe('deny');
    expect(await b.take('k', 2)).toBe('deny');
  });

  it('fails closed: a store error returns error, never allow', async () => {
    const broken: RawQuery = async () => { throw new Error('connection lost'); };
    const l = new PgSharedLimiter(broken, 600_000);
    expect(await l.take('k', 5)).toBe('error');
    expect(await l.take('k', 5)).toBe('error');
  });

  it('truncates keys to the column bound (255)', async () => {
    const store = fakeStore(600_000);
    const l = new PgSharedLimiter(store.query, 600_000);
    await l.take('x'.repeat(500), 5);
    const insert = store.calls.find((c) => c.text.startsWith('INSERT'));
    expect((insert!.params[0] as string).length).toBe(255);
  });

  it('deny cache bounds flood write rate: denied keys skip the store briefly', async () => {
    const store = fakeStore(600_000);
    let now = 5_000_000;
    const l = new PgSharedLimiter(store.query, 600_000, () => now);
    for (let i = 0; i < 3; i++) expect(await l.take('k', 3)).toBe('allow');
    expect(await l.take('k', 3)).toBe('deny');
    const callsAtDeny = store.calls.length;
    // Further hits from the denied key cost no DB write while the cache holds.
    for (let i = 0; i < 50; i++) expect(await l.take('k', 3)).toBe('deny');
    expect(store.calls.length).toBe(callsAtDeny);
    // Other keys are unaffected by the cached denial.
    expect(await l.take('other', 3)).toBe('allow');
    // After the TTL the store is consulted again (source of truth).
    now += 61_000;
    expect(await l.take('k', 3)).toBe('deny');
    expect(store.calls.length).toBeGreaterThan(callsAtDeny);
  });
});
