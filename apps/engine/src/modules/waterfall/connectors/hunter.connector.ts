import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

export interface HunterInput {
  domain?: string;
  company?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export interface HunterOutput {
  email: string | null;
  score: number;
  verificationStatus: 'valid' | 'accept_all' | 'unknown' | null;
  position?: string;
  company?: string;
  confidence: number;
}

export class HunterConnector implements Connector<HunterInput, HunterOutput> {
  readonly id = 'hunter';
  readonly name = 'Hunter.io';
  readonly capabilities: ConnectorCapability[] = ['person_enrich', 'email_verify'];
  readonly auth = {
    type: 'custom_header' as const,
    headerName: 'X-API-KEY',
    description: 'Hunter API key',
  };
  readonly rateLimit = {
    requestsPerMinute: 300,
    concurrency: 5,
  };

  async run(
    input: HunterInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<HunterOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'Hunter API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.domain && !input.company) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Either domain or company must be provided for Hunter email search',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const base = ctx.baseUrl ?? 'https://api.hunter.io';

    const params = new URLSearchParams();
    if (input.domain) params.set('domain', input.domain);
    if (input.company) params.set('company', input.company);
    if (input.firstName) params.set('first_name', input.firstName);
    if (input.lastName) params.set('last_name', input.lastName);
    if (input.fullName) params.set('full_name', input.fullName);

    const url = `${base}/v2/email-finder?${params.toString()}`;

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          'X-API-KEY': ctx.apiKey,
          Accept: 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (response.status === 429) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'RATE_LIMITED',
            status: 429,
            message: 'Hunter rate limit reached',
            retryable: true,
          },
        };
      }

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'PROVIDER_ERROR',
            status: response.status,
            message: `Hunter HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        data?: {
          email?: string;
          score?: number;
          verification?: { status?: string };
          position?: string;
          company?: string;
        };
      };

      const data = json.data;
      if (!data || !data.email) {
        return {
          success: true,
          latencyMs,
          costMicrocents: 100,
          data: {
            email: null,
            score: 0,
            verificationStatus: null,
            confidence: 0,
          },
          raw: json as Record<string, unknown>,
        };
      }

      const score = data.score ?? 0;
      const status = data.verification?.status as HunterOutput['verificationStatus'] ?? null;

      return {
        success: true,
        latencyMs,
        costMicrocents: 100, // Nominal cost
        data: {
          email: data.email,
          score,
          verificationStatus: status,
          position: data.position,
          company: data.company ?? input.company,
          confidence: score / 100,
        },
        raw: json as Record<string, unknown>,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        },
      };
    }
  }
}
