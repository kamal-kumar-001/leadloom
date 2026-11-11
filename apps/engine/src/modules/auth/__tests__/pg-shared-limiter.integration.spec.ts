import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgSharedLimiter } from '../rate-limiter';

/** Gated: LEADLOOM_INTEGRATION=1 + LEADLOOM_TEST_DATABASE_URL on a migrated DB (throwaway data only). */
const URL = process.env.LEADLOOM_TEST_DATABASE_URL;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(URL);

describe.runIf(RUN)('PgSharedLimiter on real Postgres (gated)', () => {
  let prisma: any;
  const keys: string[] = [];
  const key = () => { const k = `spec:${randomUUID()}`; keys.push(k); return k; };
  beforeAll(async () => { const { PrismaClient } = await import('@leadloom/database'); prisma = new PrismaClient({ datasources: { db: { url: URL } } }); });
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM public_rate_limit_buckets WHERE "key" = ANY($1)`, keys);
    await prisma.$disconnect();
  });

  const limiter = () => new PgSharedLimiter((t, p) => prisma.$queryRawUnsafe(t, ...p), 600_000);

  it('enforces the cap and shares state across instances (replica case)', async () => {
    const k = key();
    const a = limiter();
    const b = limiter(); // a second engine instance over the same store
    expect(await a.take(k, 3)).toBe('allow');
    expect(await b.take(k, 3)).toBe('allow');
    expect(await a.take(k, 3)).toBe('allow');
    expect(await a.take(k, 3)).toBe('deny'); // 4th hit within the window denied
    expect(await b.take(k, 3)).toBe('deny');
    const rows = await prisma.$queryRawUnsafe(`SELECT "count" FROM public_rate_limit_buckets WHERE "key" = $1`, k);
    expect(Number(rows[0].count)).toBe(5); // denied hits update the same row (bounded writes, abuse stays visible)
  });

  it('simultaneous contenders cannot over-admit: exactly max allows out of N concurrent', async () => {
    const k = key();
    const a = limiter();
    const b = limiter();
    const MAX = 10;
    const verdicts = await Promise.all(
      Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? a : b).take(k, MAX)),
    );
    expect(verdicts.filter((v) => v === 'allow')).toHaveLength(MAX);
    expect(verdicts.filter((v) => v === 'deny')).toHaveLength(30);
    const rows = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS rows, sum("count")::int AS total FROM public_rate_limit_buckets WHERE "key" = $1`, k);
    expect(Number(rows[0].rows)).toBe(1); // one bucket row for 40 concurrent hits
    expect(Number(rows[0].total)).toBe(40);
  });

  it('different keys do not interfere', async () => {
    const k1 = key(); const k2 = key();
    const l = limiter();
    for (let i = 0; i < 2; i++) expect(await l.take(k1, 2)).toBe('allow');
    expect(await l.take(k1, 2)).toBe('deny');
    expect(await l.take(k2, 2)).toBe('allow');
  });
});
