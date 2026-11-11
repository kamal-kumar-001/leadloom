import { describe, expect, it } from 'vitest';
import { PgSharedLimiter, type RawQuery } from '../rate-limiter';

describe('PgSharedLimiter (fake store)', () => {
  /** In-memory emulation of the SQL: insert + count within window. */
  const fakeStore = (windowMs: number) => {
    const hits = new Map<string, number[]>();
    let now = 1_000_000;
    const query: RawQuery = async (text, params) => {
      const [key] = params as [string, number];
      if (text.startsWith('WITH ins')) {
        const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
        const prior = arr.length; // mirrors PG: the count does not see its own statement's insert
        arr.push(now);
        hits.set(key, arr);
        return [{ n: prior }];
      }
      return []; // cleanup delete
    };
    return { query, advance: (ms: number) => { now += ms; } };
  };

  it('allows up to max hits within the window, then denies', async () => {
    const l = new PgSharedLimiter(fakeStore(600_000).query, 600_000);
    for (let i = 0; i < 5; i++) expect(await l.take('k', 5)).toBe(true);
    expect(await l.take('k', 5)).toBe(false);
    expect(await l.take('k', 5)).toBe(false);
  });

  it('keys are independent', async () => {
    const l = new PgSharedLimiter(fakeStore(600_000).query, 600_000);
    for (let i = 0; i < 3; i++) expect(await l.take('a', 3)).toBe(true);
    expect(await l.take('a', 3)).toBe(false);
    expect(await l.take('b', 3)).toBe(true);
  });

  it('window expiry frees capacity', async () => {
    const store = fakeStore(1000);
    const l = new PgSharedLimiter(store.query, 1000);
    expect(await l.take('k', 2)).toBe(true);
    expect(await l.take('k', 2)).toBe(true);
    expect(await l.take('k', 2)).toBe(false);
    store.advance(1001);
    expect(await l.take('k', 2)).toBe(true);
  });

  it('two limiter instances over one store share the count (the replica case)', async () => {
    const store = fakeStore(600_000);
    const a = new PgSharedLimiter(store.query, 600_000);
    const b = new PgSharedLimiter(store.query, 600_000);
    expect(await a.take('k', 2)).toBe(true);
    expect(await b.take('k', 2)).toBe(true);
    expect(await a.take('k', 2)).toBe(false);
    expect(await b.take('k', 2)).toBe(false);
  });
});
