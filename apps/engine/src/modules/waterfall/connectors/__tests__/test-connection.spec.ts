import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TestConnectionService,
  createDefaultConnectorRegistry,
} from '../index';
import { WaterfallEntitlementPort } from '../../waterfall.service';
import { InMemoryConnectorCredentialStore } from '../../credentials';

describe('TestConnectionService', () => {
  const ORIGINAL_LIVE = process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;
  const ORIGINAL_ENFORCE = process.env.LEADLOOM_ENTITLEMENTS_ENFORCED;
  const ORIGINAL_KEK = process.env.LEADLOOM_CREDENTIAL_KEK;
  const TEST_KEK = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    delete process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;
    delete process.env.LEADLOOM_ENTITLEMENTS_ENFORCED;
    process.env.LEADLOOM_CREDENTIAL_KEK = TEST_KEK;
  });

  afterEach(() => {
    if (ORIGINAL_LIVE !== undefined) {
      process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED = ORIGINAL_LIVE;
    } else {
      delete process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;
    }

    if (ORIGINAL_ENFORCE !== undefined) {
      process.env.LEADLOOM_ENTITLEMENTS_ENFORCED = ORIGINAL_ENFORCE;
    } else {
      delete process.env.LEADLOOM_ENTITLEMENTS_ENFORCED;
    }

    if (ORIGINAL_KEK !== undefined) {
      process.env.LEADLOOM_CREDENTIAL_KEK = ORIGINAL_KEK;
    } else {
      delete process.env.LEADLOOM_CREDENTIAL_KEK;
    }
  });

  it('returns DISABLED by default when LEADLOOM_CONNECTORS_LIVE_ENABLED is not set to true', async () => {
    const service = new TestConnectionService();
    const res = await service.testConnection({
      workspaceId: 'ws-test',
      connectorId: 'apollo',
      apiKey: 'test-key',
    });

    expect(res.status).toBe('DISABLED');
    expect(res.message).toContain('Live connector testing is disabled');
  });

  it('returns FORBIDDEN when entitlement port denies the waterfall feature', async () => {
    process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED = 'true';

    const mockEntitlements: WaterfallEntitlementPort = {
      checkFeature: vi.fn(async () => ({ allowed: false, reason: 'Waterfall not in Free plan' })),
      checkLimit: vi.fn(async () => ({ allowed: true })),
    };

    const service = new TestConnectionService(createDefaultConnectorRegistry(), mockEntitlements);
    const res = await service.testConnection({
      workspaceId: 'ws-free',
      connectorId: 'hunter',
      apiKey: 'hunter-key',
    });

    expect(res.status).toBe('FORBIDDEN');
    expect(res.message).toContain('Waterfall not in Free plan');
  });

  it('returns FORBIDDEN when LEADLOOM_ENTITLEMENTS_ENFORCED is true but no port is provided', async () => {
    process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED = 'true';
    process.env.LEADLOOM_ENTITLEMENTS_ENFORCED = 'true';

    const service = new TestConnectionService(createDefaultConnectorRegistry(), undefined);
    const res = await service.testConnection({
      workspaceId: 'ws-enforced',
      connectorId: 'hunter',
      apiKey: 'hunter-key',
    });

    expect(res.status).toBe('FORBIDDEN');
    expect(res.message).toContain('Entitlements enforced but no EntitlementPort provided');
  });

  it('returns FAILED when key is missing and none stored in credential store', async () => {
    process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED = 'true';

    const mockEntitlements: WaterfallEntitlementPort = {
      checkFeature: vi.fn(async () => ({ allowed: true })),
      checkLimit: vi.fn(async () => ({ allowed: true })),
    };

    const credStore = new InMemoryConnectorCredentialStore();
    const service = new TestConnectionService(createDefaultConnectorRegistry(), mockEntitlements, credStore);

    const res = await service.testConnection({
      workspaceId: 'ws-corp',
      connectorId: 'apollo',
    });

    expect(res.status).toBe('FAILED');
    expect(res.error?.code).toBe('MISSING_CREDENTIAL');
  });

  it('returns SUCCESS with fake fetch when live enabled, entitled, and probe succeeds', async () => {
    process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED = 'true';

    const mockEntitlements: WaterfallEntitlementPort = {
      checkFeature: vi.fn(async () => ({ allowed: true })),
      checkLimit: vi.fn(async () => ({ allowed: true })),
    };

    const fakeFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        person: {
          first_name: 'Test',
          last_name: 'Probe',
          email: 'probe@leadloom.dev',
          email_status: 'verified',
        },
      }),
    }));

    const service = new TestConnectionService(createDefaultConnectorRegistry(), mockEntitlements);
    const res = await service.testConnection({
      workspaceId: 'ws-corp',
      connectorId: 'apollo',
      apiKey: 'apollo-test-key',
      fetch: fakeFetch as any,
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.message).toContain('Apollo.io connection test succeeded');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('automatically resolves stored credential from ConnectorCredentialStore if not passed in options', async () => {
    process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED = 'true';

    const mockEntitlements: WaterfallEntitlementPort = {
      checkFeature: vi.fn(async () => ({ allowed: true })),
      checkLimit: vi.fn(async () => ({ allowed: true })),
    };

    const credStore = new InMemoryConnectorCredentialStore();
    await credStore.set('ws-stored', 'hunter', 'hunter_stored_secret_key');

    let capturedHeaders: Record<string, string> = {};
    const fakeFetch = vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { email: 'probe@leadloom.dev', score: 90 },
        }),
      };
    });

    const service = new TestConnectionService(createDefaultConnectorRegistry(), mockEntitlements, credStore);
    const res = await service.testConnection({
      workspaceId: 'ws-stored',
      connectorId: 'hunter',
      fetch: fakeFetch as any,
    });

    expect(res.status).toBe('SUCCESS');
    expect(capturedHeaders['X-API-KEY']).toBe('hunter_stored_secret_key');
  });

  it('returns FAILED when fake fetch returns HTTP 401 unauthorized', async () => {
    process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED = 'true';

    const mockEntitlements: WaterfallEntitlementPort = {
      checkFeature: vi.fn(async () => ({ allowed: true })),
      checkLimit: vi.fn(async () => ({ allowed: true })),
    };

    const fakeFetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid API key' }),
    }));

    const service = new TestConnectionService(createDefaultConnectorRegistry(), mockEntitlements);
    const res = await service.testConnection({
      workspaceId: 'ws-corp',
      connectorId: 'pdl',
      apiKey: 'invalid-pdl-key',
      fetch: fakeFetch as any,
    });

    expect(res.status).toBe('FAILED');
    expect(res.message).toContain('People Data Labs HTTP 401');
  });
});
