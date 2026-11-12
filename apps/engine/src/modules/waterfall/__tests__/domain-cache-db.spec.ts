import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DomainCacheService, EnrichmentCacheRepository } from '../domain-cache.service';
import { DAGRunnerService, WaterfallNodeConfig } from '../dag-runner.service';
import { MockProviderAdapter } from '../adapters/mock.adapter';

function createPgliteEnrichmentCacheRepo(pg: PGlite): EnrichmentCacheRepository {
  return {
    async findUnique({ where: { cacheKey } }) {
      const res = await pg.query(
        `SELECT id, cache_key AS "cacheKey", domain, provider, payload, hit_count AS "hitCount", expires_at AS "expiresAt", created_at AS "createdAt"
         FROM enrichment_cache WHERE cache_key = $1`,
        [cacheKey]
      );
      return (res.rows[0] as any) ?? null;
    },
    async upsert({ where: { cacheKey }, create, update }) {
      const res = await pg.query(
        `INSERT INTO enrichment_cache (id, cache_key, domain, provider, payload, hit_count, expires_at, created_at)
         VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7::timestamptz, $8::timestamptz)
         ON CONFLICT (cache_key) DO UPDATE SET
           domain = EXCLUDED.domain,
           provider = EXCLUDED.provider,
           payload = EXCLUDED.payload,
           expires_at = EXCLUDED.expires_at
         RETURNING id, cache_key AS "cacheKey", domain, provider, payload, hit_count AS "hitCount", expires_at AS "expiresAt", created_at AS "createdAt"`,
        [
          create.id,
          cacheKey,
          create.domain,
          create.provider,
          JSON.stringify(create.payload),
          create.hitCount ?? 1,
          create.expiresAt.toISOString(),
          (create.createdAt ?? new Date()).toISOString(),
        ]
      );
      return res.rows[0] as any;
    },
    async update({ where: { cacheKey }, data }) {
      const res = await pg.query(
        `UPDATE enrichment_cache SET hit_count = hit_count + 1
         WHERE cache_key = $1
         RETURNING id, cache_key AS "cacheKey", domain, provider, payload, hit_count AS "hitCount", expires_at AS "expiresAt", created_at AS "createdAt"`,
        [cacheKey]
      );
      return res.rows[0] as any;
    },
    async deleteMany(args) {
      if (args?.where?.cacheKey) {
        const res = await pg.query(`DELETE FROM enrichment_cache WHERE cache_key = $1`, [args.where.cacheKey]);
        return { count: res.affectedRows ?? 0 };
      }
      if (args?.where?.expiresAt?.lte) {
        const res = await pg.query(`DELETE FROM enrichment_cache WHERE expires_at <= $1::timestamptz`, [
          args.where.expiresAt.lte.toISOString(),
        ]);
        return { count: res.affectedRows ?? 0 };
      }
      const res = await pg.query(`DELETE FROM enrichment_cache`);
      return { count: res.affectedRows ?? 0 };
    },
    async count(args) {
      if (args?.where?.expiresAt?.gt) {
        const res = await pg.query(`SELECT COUNT(*)::int AS count FROM enrichment_cache WHERE expires_at > $1::timestamptz`, [
          args.where.expiresAt.gt.toISOString(),
        ]);
        return Number((res.rows[0] as any)?.count ?? 0);
      }
      const res = await pg.query(`SELECT COUNT(*)::int AS count FROM enrichment_cache`);
      return Number((res.rows[0] as any)?.count ?? 0);
    },
  };
}

describe('DomainCacheService — DB-Backed Persistence on enrichment_cache (D1)', () => {
  let pg: PGlite;
  let repo: EnrichmentCacheRepository;
  let service: DomainCacheService;

  beforeEach(async () => {
    pg = new PGlite({ extensions: { vector } });
    const initMigration = readFileSync(
      fileURLToPath(new URL('../../../../../../packages/database/prisma/migrations/20261110_init_v2/migration.sql', import.meta.url)),
      'utf8'
    );
    await pg.exec(initMigration);
    repo = createPgliteEnrichmentCacheRepo(pg);
    service = new DomainCacheService(repo);
  }, 30000);

  afterEach(async () => {
    await pg?.close();
  });

  it('marks service as isDbBacked = true when repository is injected', () => {
    expect(service.isDbBacked()).toBe(true);
  });

  it('persists cache entry into PostgreSQL enrichment_cache table with 30-day default TTL', async () => {
    const beforeSet = Date.now();
    const entry = await service.set(
      'apollo',
      'https://www.stripe.com/pricing',
      { email: 'founder@stripe.com', verified: true },
      100
    );

    expect(entry.targetIdentifier).toBe('stripe.com');
    expect(entry.provider).toBe('apollo');
    expect(entry.costSavedMicrocents).toBe(100);
    expect(entry.hitCount).toBe(1);

    // Verify 30-day TTL (~2,592,000,000 ms in future)
    const expectedExpiry = beforeSet + 30 * 24 * 60 * 60 * 1000;
    const diff = Math.abs(entry.expiresAt.getTime() - expectedExpiry);
    expect(diff).toBeLessThan(5000); // within 5 seconds

    // Direct SQL inspection in enrichment_cache table
    const sqlCheck = await pg.query(
      `SELECT domain, provider, hit_count, expires_at FROM enrichment_cache WHERE domain = 'stripe.com'`
    );
    expect(sqlCheck.rows.length).toBe(1);
    expect((sqlCheck.rows[0] as any).provider).toBe('apollo');
    expect((sqlCheck.rows[0] as any).hit_count).toBe(1);
  });

  it('resolves cache hits from PostgreSQL and increments hit_count in DB', async () => {
    await service.set('hunter', 'linear.app', { email: 'karri@linear.app' }, 300);

    // Initial check in DB
    const res1 = await service.get<{ email: string }>('hunter', 'https://linear.app');
    expect(res1).not.toBeNull();
    expect(res1?.responsePayload.email).toBe('karri@linear.app');
    expect(res1?.hitCount).toBe(2);

    // Second check in DB
    const res2 = await service.get<{ email: string }>('hunter', 'linear.app');
    expect(res2?.hitCount).toBe(3);

    // Check hit_count directly in SQL
    const dbRow = await pg.query(`SELECT hit_count FROM enrichment_cache WHERE domain = 'linear.app'`);
    expect((dbRow.rows[0] as any).hit_count).toBe(3);
  });

  it('deletes and returns null for expired rows (TTL breach)', async () => {
    // Write entry that expired 1 hour ago
    await service.set('dropcontact', 'acme.corp', { email: 'sales@acme.corp' }, 1200, -3600 * 1000);

    const hit = await service.get('dropcontact', 'acme.corp');
    expect(hit).toBeNull();

    // Expired row must have been cleaned up from PostgreSQL
    const dbCheck = await pg.query(`SELECT id FROM enrichment_cache WHERE domain = 'acme.corp'`);
    expect(dbCheck.rows.length).toBe(0);
  });

  it('guarantees $0.00 external cost when DAGRunner executes against DB-backed cache', async () => {
    const runner = new DAGRunnerService(service);
    const mockApollo = new MockProviderAdapter({
      provider: 'apollo',
      nominalCostMicrocents: 100,
      simulatedStatus: 'hit',
      simulatedVerification: 'deliverable',
      simulatedEmail: 'ceo@github.com',
    });
    runner.registerAdapter(mockApollo);

    const configs: WaterfallNodeConfig[] = [{ id: 'n1', provider: 'apollo', tier: 1 }];

    // First run: calls mock provider, writes to Postgres enrichment_cache table
    const run1 = await runner.executeRow(
      { domain: 'github.com', workspaceId: 'tenant-123' },
      configs
    );
    expect(run1.status).toBe('success');
    expect(run1.value).toBe('ceo@github.com');
    expect(run1.telemetry?.cost_microcents).toBe(100);
    expect(mockApollo.callCount).toBe(1);

    // Verify row was written to PostgreSQL
    const rows = await pg.query(`SELECT domain FROM enrichment_cache WHERE domain = 'github.com'`);
    expect(rows.rows.length).toBe(1);

    // Second run with same domain: resolves from DB with 0 microcents!
    const run2 = await runner.executeRow(
      { domain: 'https://github.com/', workspaceId: 'tenant-123' },
      configs
    );
    expect(run2.status).toBe('success');
    expect(run2.value).toBe('ceo@github.com');
    expect(run2.telemetry?.cost_microcents).toBe(0); // $0.00 external cost!
    expect(mockApollo.callCount).toBe(1); // Provider was NOT invoked again!
    expect(run2.trace[0].reason).toContain('FinOps 30-day domain cache hit');
  });

  it('supports delete, clear, size and pruneExpired operations in DB', async () => {
    await service.set('apollo', 'site1.com', { val: 1 }, 100);
    await service.set('hunter', 'site2.com', { val: 2 }, 100);
    await service.set('hunter', 'expired.com', { val: 3 }, 100, -10000);

    expect(await service.size()).toBe(2); // 2 active entries

    // Prune expired
    const pruned = await service.pruneExpired();
    expect(pruned).toBe(1);

    // Delete single domain
    const deleted = await service.delete('apollo', 'site1.com');
    expect(deleted).toBe(true);
    expect(await service.has('apollo', 'site1.com')).toBe(false);

    // Clear all
    await service.clear();
    expect(await service.size()).toBe(0);
  });
});
