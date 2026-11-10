import { describe, it, expect } from 'vitest';
import { DAGRunnerService, WaterfallNodeConfig } from '../dag-runner.service';
import { MockProviderAdapter } from '../adapters/mock.adapter';
import { DomainCacheService } from '../domain-cache.service';
import { WaterfallCellPayloadSchema } from '@leadloom/contracts';

describe('DAGRunnerService — Early-Exit Short-Circuiting & FinOps Guarantee', () => {
  it('should abort downstream nodes when Tier 1 finds a verified email (Credit Preservation Guarantee)', async () => {
    const domainCache = new DomainCacheService();
    const runner = new DAGRunnerService(domainCache);

    const apolloMock = new MockProviderAdapter({
      provider: 'apollo',
      nominalCostMicrocents: 100,
      simulatedStatus: 'hit',
      simulatedVerification: 'deliverable',
      simulatedConfidence: 0.95,
      simulatedEmail: 'alex@stripe.com',
    });

    const hunterMock = new MockProviderAdapter({
      provider: 'hunter',
      nominalCostMicrocents: 300,
    });

    const dropcontactMock = new MockProviderAdapter({
      provider: 'dropcontact',
      nominalCostMicrocents: 2000,
    });

    runner.registerAdapter(apolloMock);
    runner.registerAdapter(hunterMock);
    runner.registerAdapter(dropcontactMock);

    const nodeConfigs: WaterfallNodeConfig[] = [
      { id: 'n-apollo', provider: 'apollo', tier: 1, costWeight: 100 },
      { id: 'n-hunter', provider: 'hunter', tier: 2, costWeight: 300, dependencies: ['n-apollo'] },
      { id: 'n-dropcontact', provider: 'dropcontact', tier: 3, costWeight: 2000, dependencies: ['n-hunter'] },
    ];

    const result = await runner.executeRow(
      { domain: 'stripe.com', firstName: 'Alex', lastName: 'Honnold' },
      nodeConfigs
    );

    // Validate Zod contract
    WaterfallCellPayloadSchema.parse(result);

    expect(result.status).toBe('success');
    expect(result.value).toBe('alex@stripe.com');
    expect(result.telemetry?.provider_attributed).toBe('apollo');
    expect(result.telemetry?.tier).toBe(1);
    expect(result.telemetry?.cost_microcents).toBe(100);

    // CRITICAL: Hunter and Dropcontact must NOT have been called!
    expect(apolloMock.callCount).toBe(1);
    expect(hunterMock.callCount).toBe(0);
    expect(dropcontactMock.callCount).toBe(0);

    // Trace checks
    expect(result.trace).toHaveLength(3);
    expect(result.trace[0].status).toBe('hit');
    expect(result.trace[1].status).toBe('skipped');
    expect(result.trace[1].cost_microcents).toBe(0);
    expect(result.trace[2].status).toBe('skipped');
    expect(result.trace[2].cost_microcents).toBe(0);
  });

  it('should fall back to Tier 2 when Tier 1 returns a miss, then short-circuit Tier 3', async () => {
    const domainCache = new DomainCacheService();
    const runner = new DAGRunnerService(domainCache);

    const apolloMock = new MockProviderAdapter({
      provider: 'apollo',
      nominalCostMicrocents: 100,
      simulatedStatus: 'miss',
    });

    const hunterMock = new MockProviderAdapter({
      provider: 'hunter',
      nominalCostMicrocents: 300,
      simulatedStatus: 'hit',
      simulatedVerification: 'deliverable',
      simulatedConfidence: 0.9,
      simulatedEmail: 'alex.h@stripe.com',
    });

    const dropcontactMock = new MockProviderAdapter({
      provider: 'dropcontact',
      nominalCostMicrocents: 2000,
    });

    runner.registerAdapter(apolloMock);
    runner.registerAdapter(hunterMock);
    runner.registerAdapter(dropcontactMock);

    const nodeConfigs: WaterfallNodeConfig[] = [
      { id: 'n-apollo', provider: 'apollo', tier: 1, costWeight: 100 },
      { id: 'n-hunter', provider: 'hunter', tier: 2, costWeight: 300 },
      { id: 'n-dropcontact', provider: 'dropcontact', tier: 3, costWeight: 2000 },
    ];

    const result = await runner.executeRow(
      { domain: 'stripe.com', firstName: 'Alex', lastName: 'Honnold' },
      nodeConfigs
    );

    expect(result.status).toBe('fallback_used');
    expect(result.value).toBe('alex.h@stripe.com');
    expect(result.telemetry?.provider_attributed).toBe('hunter');
    expect(result.telemetry?.tier).toBe(2);
    expect(result.telemetry?.cost_microcents).toBe(400); // 100 + 300

    expect(apolloMock.callCount).toBe(1);
    expect(hunterMock.callCount).toBe(1);
    expect(dropcontactMock.callCount).toBe(0); // Dropcontact must be skipped

    expect(result.trace[0].status).toBe('miss');
    expect(result.trace[1].status).toBe('hit');
    expect(result.trace[2].status).toBe('skipped');
  });

  it('should mark cell as exhausted when all tiers miss', async () => {
    const domainCache = new DomainCacheService();
    const runner = new DAGRunnerService(domainCache);

    runner.registerAdapter(new MockProviderAdapter({ provider: 'apollo', simulatedStatus: 'miss', nominalCostMicrocents: 100 }));
    runner.registerAdapter(new MockProviderAdapter({ provider: 'hunter', simulatedStatus: 'miss', nominalCostMicrocents: 300 }));

    const nodeConfigs: WaterfallNodeConfig[] = [
      { id: 'n1', provider: 'apollo', tier: 1 },
      { id: 'n2', provider: 'hunter', tier: 2 },
    ];

    const result = await runner.executeRow({ domain: 'unknown-startup.io' }, nodeConfigs);

    expect(result.status).toBe('exhausted');
    expect(result.value).toBeNull();
    expect(result.telemetry?.cost_microcents).toBe(400);
    expect(result.trace).toHaveLength(2);
    expect(result.trace.every(t => t.status === 'miss')).toBe(true);
  });

  it('should detect cycles in DAG dependency definitions and throw descriptive error', () => {
    const runner = new DAGRunnerService();
    const cycleConfigs: WaterfallNodeConfig[] = [
      { id: 'node-a', provider: 'apollo', tier: 1, dependencies: ['node-b'] },
      { id: 'node-b', provider: 'hunter', tier: 2, dependencies: ['node-a'] },
    ];

    expect(() => runner.sortNodes(cycleConfigs)).toThrow(/Cycle detected/i);
  });
});
