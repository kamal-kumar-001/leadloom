import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

export interface ZeroBounceInput {
  email: string;
  ipAddress?: string;
}

export interface ZeroBounceOutput {
  status: 'valid' | 'invalid' | 'catch-all' | 'spamtrap' | 'abuse' | 'do_not_mail' | 'unknown';
  subStatus?: string;
  account?: string;
  domain?: string;
  didYouMean?: string | null;
  freeEmail: boolean;
  mxFound: boolean;
  confidence: number;
}

export class ZeroBounceConnector implements Connector<ZeroBounceInput, ZeroBounceOutput> {
  readonly id = 'zerobounce';
  readonly name = 'ZeroBounce';
  readonly capabilities: ConnectorCapability[] = ['email_verify'];
  readonly auth = {
    type: 'api_key' as const,
    paramName: 'api_key',
    description: 'ZeroBounce API key',
  };
  readonly rateLimit = {
    requestsPerMinute: 600,
    concurrency: 10,
  };

  async run(
    input: ZeroBounceInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<ZeroBounceOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'ZeroBounce API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.email || !input.email.includes('@')) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Valid email address must be provided for ZeroBounce verification',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const base = ctx.baseUrl ?? 'https://api.zerobounce.net';

    const params = new URLSearchParams({
      api_key: ctx.apiKey,
      email: input.email,
    });
    if (input.ipAddress) params.set('ip_address', input.ipAddress);

    const url = `${base}/v2/validate?${params.toString()}`;

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
            message: 'ZeroBounce rate limit reached',
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
            message: `ZeroBounce HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        status?: string;
        sub_status?: string;
        account?: string;
        domain?: string;
        did_you_mean?: string;
        free_email?: boolean;
        mx_found?: string | boolean;
      };

      const status = (json.status?.toLowerCase() as ZeroBounceOutput['status']) ?? 'unknown';
      const mxFound = json.mx_found === true || json.mx_found === 'true';
      const confidence = status === 'valid' ? 1.0 : status === 'catch-all' ? 0.6 : 0;

      return {
        success: true,
        latencyMs,
        costMicrocents: 60, // ~$0.0006
        data: {
          status,
          subStatus: json.sub_status,
          account: json.account,
          domain: json.domain,
          didYouMean: json.did_you_mean ?? null,
          freeEmail: Boolean(json.free_email),
          mxFound,
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
