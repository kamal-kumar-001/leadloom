import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApolloAdapter } from '../apollo.adapter';
import { HunterAdapter } from '../hunter.adapter';
import { DropcontactAdapter } from '../dropcontact.adapter';
import { ProviderOutcomeUnknownError } from '../base-provider.adapter';
import { DAGRunnerService } from '../../dag-runner.service';
import { DomainCacheService } from '../../domain-cache.service';

/**
 * D2 billing-integrity contract: a fetch-layer failure (timeout, connection
 * reset, parse error) happens around a POSSIBLY-SUBMITTED, POSSIBLY-CHARGED
 * request. Adapters must THROW ProviderOutcomeUnknownError - never return a
 * normalized error-with-cost-0 result - and the runner must propagate it so
 * the worker marks the row uncertain (needs_review), never a blind retry.
 * Synthetic failure injection only; no live provider calls.
 */
const INPUT = { domain: 'northstar.example', firstName:'Jordan', lastName:'Fixture', workspaceId: crypto.randomUUID() };
const transport = {fetch:((...args:any[])=>globalThis.fetch(...args as [any,any])) as typeof fetch};

describe('ProviderOutcomeUnknownError contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  for (const [name, make] of [
    ['apollo', () => new ApolloAdapter(transport)],
    ['hunter', () => new HunterAdapter(transport)],
    ['dropcontact', () => new DropcontactAdapter(transport)],
  ] as const) {
    it(`${name}: a fetch-layer failure throws ProviderOutcomeUnknownError (never a normalized cost-0 error)`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('socket hang up'); }));
      await expect(make().execute(INPUT, 'dummy-key')).rejects.toBeInstanceOf(ProviderOutcomeUnknownError);
    });
  }

  it('the runner propagates the uncertainty instead of recording a cost-0 error step and continuing', async () => {
    const runner = new DAGRunnerService(new DomainCacheService());
    const failing = new ApolloAdapter(transport);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout'); }));
    runner.registerAdapter(failing);
    await expect(
      runner.executeRow(INPUT, [{ id: 'n1', provider: 'apollo', tier: 1 }], { apollo: 'dummy-key' }),
    ).rejects.toBeInstanceOf(ProviderOutcomeUnknownError);
  });
});

describe('fail-closed billing on provider-ANSWERED errors (no live calls)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a provider-answered HTTP error records the ASSUMED nominal cost, never a silent measured zero', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}',{status:500})) as any);
    const out = await new ApolloAdapter(transport).execute(INPUT, 'dummy-key');
    expect(out.status).toBe('error');
    expect(out.costAssumed).toBe(true);
    expect(out.costMicrocents).toBeGreaterThan(0); // assumed at nominal, never silently 0
  });

  it('a provider-answered rate limit is likewise assumed-charged, and telemetry surfaces cost_assumed through the runner', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}',{status:429})) as any);
    const runner = new DAGRunnerService(new DomainCacheService());
    runner.registerAdapter(new ApolloAdapter(transport));
    const payload = await runner.executeRow(INPUT, [{ id: 'n1', provider: 'apollo', tier: 1 }], { apollo: 'dummy-key' });
    expect(payload.telemetry?.cost_assumed).toBe(true);
    expect(payload.telemetry?.cost_microcents).toBeGreaterThan(0);
  });
});
