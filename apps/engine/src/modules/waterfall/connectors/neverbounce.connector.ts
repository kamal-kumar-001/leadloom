import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

export interface NeverBounceInput {
  email: string;
}

export interface NeverBounceOutput {
  result: 'valid' | 'invalid' | 'disposable' | 'catchall' | 'unknown';
  flags: string[];
  suggestedCorrection: string | null;
  confidence: number;
}

export class NeverBounceConnector implements Connector<NeverBounceInput, NeverBounceOutput> {
  readonly id = 'neverbounce';
  readonly name = 'NeverBounce';
  readonly capabilities: ConnectorCapability[] = ['email_verify'];
  readonly auth = {
    type: 'api_key' as const,
    paramName: 'key',
    description: 'NeverBounce API key',
  };
  readonly rateLimit = {
    requestsPerMinute: 600,
    concurrency: 10,
  };

  async run(
    input: NeverBounceInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<NeverBounceOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'NeverBounce API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.email || !input.email.includes('@')) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Valid email address must be provided for NeverBounce check',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const base = ctx.baseUrl ?? 'https://api.neverbounce.com';

    const params = new URLSearchParams({
      key: ctx.apiKey,
      email: input.email,
    });

    const url = `${base}/v4/single/check?${params.toString()}`;

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const latencyMs = Date.now() - start;

      if (response.status === 429) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'RATE_LIMITED',
            status: 429,
            message: 'NeverBounce rate limit reached',
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
            message: `NeverBounce HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        status?: string;
        result?: string;
        flags?: string[];
        suggested_correction?: string;
      };

      const result = (json.result?.toLowerCase() as NeverBounceOutput['result']) ?? 'unknown';
      const confidence = result === 'valid' ? 1.0 : result === 'catchall' ? 0.6 : 0;

      return {
        success: true,
        latencyMs,
        costMicrocents: 80, // ~$0.0008
        data: {
          result,
          flags: json.flags ?? [],
          suggestedCorrection: json.suggested_correction ?? null,
          confidence,
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
