import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  WaterfallService,
  WaterfallEntitlementPort,
  WaterfallEntitlementError,
} from '../waterfall.service';
import { WaterfallController } from '../waterfall.controller';
import {
  DispatchWaterfallRequest,
  DispatchWaterfallResponseSchema,
  WaterfallCellPayloadSchema,
} from '@leadloom/contracts';

describe('WaterfallService Entitlement Gating', () => {
  const sampleRequest: DispatchWaterfallRequest = {
    columnId: randomUUID(),
    rowIds: [randomUUID(), randomUUID(), randomUUID()],
    priority: 'standard',
  };

  it('allows dispatch when no EntitlementPort is configured and LEADLOOM_ENTITLEMENTS_ENFORCED != true', async () => {
    const saved = process.env.LEADLOOM_ENTITLEMENTS_ENFORCED;
    try {
      delete process.env.LEADLOOM_ENTITLEMENTS_ENFORCED;
      const service = new WaterfallService();
      const res = await service.dispatchWaterfall(sampleRequest, randomUUID());
      expect(res.totalQueued).toBe(3);
      expect(res.jobId).toMatch(/^job-/);
    } finally {
      if (saved !== undefined) process.env.LEADLOOM_ENTITLEMENTS_ENFORCED = saved;
    }
  });

  it('fails closed: rejects missing workspaceId when EntitlementPort is configured', async () => {
    const port: WaterfallEntitlementPort = {
      checkFeature: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok' }),
      checkLimit: vi.fn().mockResolvedValue({ allowed: true, reason: 'ok' }),
    };
    const service = new WaterfallService(port);

    // 1. undefined workspaceId
    await expect(service.dispatchWaterfall(sampleRequest, undefined)).rejects.toThrow(
      WaterfallEntitlementError
    );
    await expect(service.dispatchWaterfall(sampleRequest, undefined)).rejects.toMatchObject({
      decision: { allowed: false, reason: 'no_plan' },
    });

    // 2. empty workspaceId
    await expect(service.dispatchWaterfall(sampleRequest, '   ')).rejects.toThrow(
      WaterfallEntitlementError
    );

    // 3. executeSingleRow without workspaceId
    await expect(service.executeSingleRow({ email: 'x@example.com' }, undefined, undefined)).rejects.toThrow(
      WaterfallEntitlementError
    );

    expect(port.checkFeature).not.toHaveBeenCalled();
  });

  it('fails closed: rejects missing EntitlementPort when LEADLOOM_ENTITLEMENTS_ENFORCED === true', async () => {
    const saved = process.env.LEADLOOM_ENTITLEMENTS_ENFORCED;
    try {
      process.env.LEADLOOM_ENTITLEMENTS_ENFORCED = 'true';
      const service = new WaterfallService(); // no port provided
      const workspaceId = randomUUID();

      await expect(service.dispatchWaterfall(sampleRequest, workspaceId)).rejects.toThrow(
        WaterfallEntitlementError
      );
      await expect(service.dispatchWaterfall(sampleRequest, workspaceId)).rejects.toMatchObject({
        decision: { allowed: false, reason: 'billing_inactive' },
      });
    } finally {
      if (saved !== undefined) process.env.LEADLOOM_ENTITLEMENTS_ENFORCED = saved;
      else delete process.env.LEADLOOM_ENTITLEMENTS_ENFORCED;
    }
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

  it('confirms raw payload never reaches API dispatch response or executeSingleRow response', async () => {
    const service = new WaterfallService();
    const workspaceId = randomUUID();

    // 1. Dispatch response must strictly match DispatchWaterfallResponseSchema with no raw field
    const dispatchRes = await service.dispatchWaterfall(sampleRequest, workspaceId);
    const parsedDispatch = DispatchWaterfallResponseSchema.parse(dispatchRes);
    expect((parsedDispatch as any).raw).toBeUndefined();
    expect(Object.keys(dispatchRes)).toEqual(['jobId', 'totalQueued', 'estimatedCompletionAt']);

    // 2. executeSingleRow response must strictly match WaterfallCellPayloadSchema with no raw field
    const cellRes = await service.executeSingleRow({ email: 'known@example.com' }, [], workspaceId);
    const parsedCell = WaterfallCellPayloadSchema.parse(cellRes);
    expect((parsedCell as any).raw).toBeUndefined();
    expect((cellRes as any).raw).toBeUndefined();
  });
});
