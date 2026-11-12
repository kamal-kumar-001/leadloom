import { describe, it, expect } from 'vitest';
import { DomainCacheService } from '../domain-cache.service';
import { DAGRunnerService } from '../dag-runner.service';
import { MockProviderAdapter } from '../adapters/mock.adapter';

describe('DomainCacheService — 30-Day Domain-Level FinOps Deduplication (In-Memory Baseline)', () => {
  it('should normalize domains and compute deterministic SHA-256 hashes', () => {
    const cache = new DomainCacheService();

    const normalized1 = cache.normalizeDomain('https://www.Vercel.com/pricing?ref=leadloom');
    const normalized2 = cache.normalizeDomain('http://vercel.com/');
    const normalized3 = cache.normalizeDomain('vercel.com');

    expect(normalized1).toBe('vercel.com');
    expect(normalized2).toBe('vercel.com');
    expect(normalized3).toBe('vercel.com');

    const hash1 = cache.computeHash('hunter', 'https://www.vercel.com');
    const hash2 = cache.computeHash('hunter', 'vercel.com');
    expect(hash1).toBe(hash2);
  });

  it('should store and retrieve cached entry within 30 days and increment hit count', async () => {
    const cache = new DomainCacheService();
    expect(cache.isDbBacked()).toBe(false);

    await cache.set('apollo', 'stripe.com', { email: 'sales@stripe.com' }, 100);

    expect(await cache.has('apollo', 'stripe.com')).toBe(true);

    const hit1 = await cache.get<{ email: string }>('apollo', 'https://www.stripe.com');
    expect(hit1).not.toBeNull();
    expect(hit1?.responsePayload.email).toBe('sales@stripe.com');
    expect(hit1?.hitCount).toBe(2);
    expect(await cache.size()).toBe(1);
  });

  it('should guarantee $0.00 external cost when DAGRunner hits cached domain', async () => {
    const cache = new DomainCacheService();
    const runner = new DAGRunnerService(cache);

    const mockApollo = new MockProviderAdapter({
      provider: 'apollo',
      nominalCostMicrocents: 100,
      simulatedStatus: 'hit',
      simulatedVerification: 'deliverable',
      simulatedEmail: 'patrick@stripe.com',
    });
    runner.registerAdapter(mockApollo);

    const configs = [{ id: 'n1', provider: 'apollo' as const, tier: 1 }];

    // First call: populates cache
    const firstRun = await runner.executeRow({ domain: 'stripe.com', workspaceId: 'synthetic-tenant' }, configs);
    expect(firstRun.telemetry?.cost_microcents).toBe(100);
    expect(mockApollo.callCount).toBe(1);

    // Second call with same domain: must resolve from cache with 0 microcents!
    const secondRun = await runner.executeRow({ domain: 'https://www.stripe.com/', workspaceId: 'synthetic-tenant' }, configs);
    expect(secondRun.status).toBe('success');
    expect(secondRun.value).toBe('patrick@stripe.com');
    expect(secondRun.telemetry?.cost_microcents).toBe(0); // $0.00 external cost!
    expect(mockApollo.callCount).toBe(1); // Provider API NOT called again
    expect(secondRun.trace[0].reason).toContain('FinOps 30-day domain cache hit');
  });

  it('should expire entries when TTL is breached', async () => {
    const cache = new DomainCacheService();
    // Set with 0ms TTL (immediate expiry)
    await cache.set('hunter', 'airbnb.com', { email: 'test@airbnb.com' }, 300, -1000);

    const entry = await cache.get('hunter', 'airbnb.com');
    expect(entry).toBeNull();
    expect(await cache.has('hunter', 'airbnb.com')).toBe(false);
  });

  it('should support delete, clear, and pruneExpired', async () => {
    const cache = new DomainCacheService();
    await cache.set('hunter', 'a.com', { email: 'a@a.com' }, 100);
    await cache.set('apollo', 'b.com', { email: 'b@b.com' }, 200, -5000); // expired

    expect(await cache.size()).toBe(2);

    const pruned = await cache.pruneExpired();
    expect(pruned).toBe(1);

    const deleted = await cache.delete('hunter', 'a.com');
    expect(deleted).toBe(true);
    expect(await cache.has('hunter', 'a.com')).toBe(false);

    await cache.set('hunter', 'c.com', { email: 'c@c.com' }, 100);
    await cache.clear();
    expect(await cache.size()).toBe(0);
  });
});
