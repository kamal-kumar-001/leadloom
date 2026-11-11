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
    await prisma.$executeRawUnsafe(`DELETE FROM public_rate_limit_hits WHERE "key" = ANY($1)`, keys);
    await prisma.$disconnect();
  });

  const limiter = () => new PgSharedLimiter((t, p) => prisma.$queryRawUnsafe(t, ...p), 600_000);

  it('enforces the cap and shares state across instances (replica case)', async () => {
    const k = key();
    const a = limiter();
    const b = limiter(); // a second engine instance over the same store
    expect(await a.take(k, 3)).toBe(true);
    expect(await b.take(k, 3)).toBe(true);
    expect(await a.take(k, 3)).toBe(true);
    expect(await a.take(k, 3)).toBe(false); // 4th hit within the window denied
    expect(await b.take(k, 3)).toBe(false);
    const rows = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM public_rate_limit_hits WHERE "key" = $1`, k);
    expect(Number(rows[0].n)).toBe(5); // denied hits are also recorded (abuse stays visible)
  });

  it('different keys do not interfere', async () => {
    const k1 = key(); const k2 = key();
    const l = limiter();
    for (let i = 0; i < 2; i++) expect(await l.take(k1, 2)).toBe(true);
    expect(await l.take(k1, 2)).toBe(false);
    expect(await l.take(k2, 2)).toBe(true);
  });
});
