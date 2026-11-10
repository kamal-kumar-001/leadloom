import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  WaterfallService,
  WaterfallEntitlementPort,
  WaterfallEntitlementError,
} from '../waterfall.service';
import { WaterfallController } from '../waterfall.controller';
import { DispatchWaterfallRequest } from '@leadloom/contracts';

describe('WaterfallService Entitlement Gating', () => {
  const sampleRequest: DispatchWaterfallRequest = {
    columnId: randomUUID(),
    rowIds: [randomUUID(), randomUUID(), randomUUID()],
    priority: 'standard',
  };

  it('allows dispatch when no EntitlementPort is configured (default unconfigured posture)', async () => {
    const service = new WaterfallService();
    const res = await service.dispatchWaterfall(sampleRequest, randomUUID());
    expect(res.totalQueued).toBe(3);
    expect(res.jobId).toMatch(/^job-/);
  });

  it('allows dispatch when EntitlementPort is configured and permits feature and limits', async () => {
    const port: WaterfallEntitlementPort = {
      checkFeature: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok' }),
      checkLimit: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok', limit: 100, used: 10, remaining: 90 }),
    };
    const service = new WaterfallService(port);
    const workspaceId = randomUUID();

    const res = await service.dispatchWaterfall(sampleRequest, workspaceId);

    expect(port.checkFeature).toHaveBeenCalledWith(workspaceId, 'waterfall');
    expect(port.checkLimit).toHaveBeenCalledWith(workspaceId, 'enrichment_credits_per_month', 3);
    expect(res.totalQueued).toBe(3);
  });

  it('rejects dispatch when feature is not permitted (e.g. no_plan, feature_not_in_plan, billing_inactive)', async () => {
    const port: WaterfallEntitlementPort = {
      checkFeature: vi.fn().mockResolvedValue({ allowed: false, reason: 'feature_not_in_plan' }),
      checkLimit: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok' }),
    };
    const service = new WaterfallService(port);
    const workspaceId = randomUUID();

    await expect(service.dispatchWaterfall(sampleRequest, workspaceId)).rejects.toThrow(WaterfallEntitlementError);
    await expect(service.dispatchWaterfall(sampleRequest, workspaceId)).rejects.toMatchObject({
      decision: { allowed: false, reason: 'feature_not_in_plan' },
    });
    expect(port.checkLimit).not.toHaveBeenCalled();
  });

  it('rejects dispatch when enrichment credit limit is reached', async () => {
    const port: WaterfallEntitlementPort = {
      checkFeature: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok' }),
      checkLimit: vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'limit_reached',
        limit: 10,
        used: 9,
        remaining: 1,
      }),
    };
    const service = new WaterfallService(port);
    const workspaceId = randomUUID();

    await expect(service.dispatchWaterfall(sampleRequest, workspaceId)).rejects.toThrow(WaterfallEntitlementError);
    await expect(service.dispatchWaterfall(sampleRequest, workspaceId)).rejects.toMatchObject({
      decision: { allowed: false, reason: 'limit_reached', limit: 10, used: 9, remaining: 1 },
    });
  });

  it('gates executeSingleRow through EntitlementPort when workspaceId is provided', async () => {
    const port: WaterfallEntitlementPort = {
      checkFeature: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok' }),
      checkLimit: vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'limit_reached',
        limit: 5,
        used: 5,
        remaining: 0,
      }),
    };
    const service = new WaterfallService(port);
    const workspaceId = randomUUID();

    await expect(
      service.executeSingleRow({ email: 'test@example.com' }, undefined, workspaceId)
    ).rejects.toThrow(WaterfallEntitlementError);

    expect(port.checkFeature).toHaveBeenCalledWith(workspaceId, 'waterfall');
    expect(port.checkLimit).toHaveBeenCalledWith(workspaceId, 'enrichment_credits_per_month', 1);
  });

  it('passes workspaceId from WaterfallController.dispatch to WaterfallService', async () => {
    const port: WaterfallEntitlementPort = {
      checkFeature: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok' }),
      checkLimit: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok' }),
    };
    const service = new WaterfallService(port);
    const controller = new WaterfallController(service);
    const workspaceId = randomUUID();

    const res = await controller.dispatch(sampleRequest, workspaceId);
    expect(res.totalQueued).toBe(3);
    expect(port.checkFeature).toHaveBeenCalledWith(workspaceId, 'waterfall');
    expect(port.checkLimit).toHaveBeenCalledWith(workspaceId, 'enrichment_credits_per_month', 3);
  });
});
