import { WaterfallEntitlementPort } from '../waterfall.service';
import { ConnectorRegistry, defaultRegistry } from './registry';
import { ConnectorCredentialStore } from '../credentials/credential-store.port';
import { ConnectorContext } from './connector.interface';

export interface TestConnectionOptions {
  workspaceId: string;
  connectorId: string;
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export type TestConnectionStatus = 'SUCCESS' | 'FAILED' | 'DISABLED' | 'FORBIDDEN';

export interface TestConnectionResult {
  status: TestConnectionStatus;
  connectorId: string;
  message: string;
  latencyMs?: number;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Service to test connector connectivity.
 * Safe posture: returns DISABLED unless LEADLOOM_CONNECTORS_LIVE_ENABLED is 'true'
 * and workspace entitlements allow waterfall usage.
 * Tests use fake fetch only (zero live vendor egress).
 */
export class TestConnectionService {
  constructor(
    private readonly registry: ConnectorRegistry = defaultRegistry,
    private readonly entitlements?: WaterfallEntitlementPort,
    private readonly credentialStore?: ConnectorCredentialStore
  ) {}

  async testConnection(options: TestConnectionOptions): Promise<TestConnectionResult> {
    const { workspaceId, connectorId } = options;

    // 1. Live connectors must be explicitly enabled via environment variable; otherwise DISABLED
    if (process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED !== 'true') {
      return {
        status: 'DISABLED',
        connectorId,
        message: 'Live connector testing is disabled (LEADLOOM_CONNECTORS_LIVE_ENABLED is not set to true)',
      };
    }

    // 2. Entitlement verification: workspace must be entitled to waterfall feature
    if (!workspaceId) {
      return {
        status: 'FORBIDDEN',
        connectorId,
        message: 'workspaceId is required for connection testing',
      };
    }

    if (this.entitlements) {
      const decision = await this.entitlements.checkFeature(workspaceId, 'waterfall');
      if (!decision.allowed) {
        return {
          status: 'FORBIDDEN',
          connectorId,
          message: `Workspace is not entitled to use connector testing: ${decision.reason ?? 'Feature disabled on plan'}`,
        };
      }
    } else if (process.env.LEADLOOM_ENTITLEMENTS_ENFORCED === 'true') {
      return {
        status: 'FORBIDDEN',
        connectorId,
        message: 'Entitlements enforced but no EntitlementPort provided',
      };
    }

    // 3. Resolve connector from registry
    const connector = this.registry.get(connectorId);
    if (!connector) {
      return {
        status: 'FAILED',
        connectorId,
        message: `Unknown connector: ${connectorId}`,
      };
    }

    // 4. Resolve API key: either provided in options, or loaded from credential store
    let apiKey = options.apiKey;
    if (!apiKey && this.credentialStore) {
      const storedKey = await this.credentialStore.getDecryptedKey(workspaceId, connectorId);
      if (storedKey) apiKey = storedKey;
    }

    if (connector.auth.type !== 'none' && !apiKey) {
      return {
        status: 'FAILED',
        connectorId,
        message: `Missing API key for connector ${connectorId}`,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: `${connector.name} requires an API key`,
        },
      };
    }

    // 5. Execute probe request using connector
    const probeInput = this.getProbeInput(connectorId);
    const ctx: ConnectorContext = {
      apiKey,
      baseUrl: options.baseUrl,
      fetch: options.fetch,
    };

    const start = Date.now();
    try {
      const result = await connector.run(probeInput as any, ctx);
      const latencyMs = result.latencyMs ?? Date.now() - start;

      if (result.success) {
        return {
          status: 'SUCCESS',
          connectorId,
          latencyMs,
          message: `${connector.name} connection test succeeded`,
        };
      }

      return {
        status: 'FAILED',
        connectorId,
        latencyMs,
        message: result.error?.message ?? `${connector.name} probe failed`,
        error: result.error
          ? {
              code: result.error.code,
              message: result.error.message,
            }
          : undefined,
      };
    } catch (err) {
      return {
        status: 'FAILED',
        connectorId,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : 'Unknown connection test failure',
      };
    }
  }

  private getProbeInput(connectorId: string): unknown {
    switch (connectorId) {
      case 'apollo':
        return { email: 'probe@leadloom.dev', domain: 'leadloom.dev' };
      case 'hunter':
        return { domain: 'leadloom.dev', firstName: 'Probe', lastName: 'Test' };
      case 'dropcontact':
        return { domain: 'leadloom.dev', email: 'probe@leadloom.dev' };
      case 'pdl':
        return { email: 'probe@leadloom.dev' };
      case 'zerobounce':
      case 'neverbounce':
        return { email: 'probe@leadloom.dev' };
      case 'serper':
        return { query: 'LeadLoom probe' };
      case 'openai':
      case 'anthropic':
      case 'ollama':
        return { messages: [{ role: 'user', content: 'ping' }] };
      default:
        return {};
    }
  }
}
