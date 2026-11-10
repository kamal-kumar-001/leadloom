import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';
import {
  validateAndResolveBaseUrl,
  resolveFetch,
  redactSecrets,
  safeFetch,
  checkRedirectResponse,
} from './security';

export interface NeverBounceInput {
  email: string;
}

export interface NeverBounceOutput {
  result: 'valid' | 'invalid' | 'disposable' | 'catchall' | 'unknown';
  flags: string[];
  suggestedCorrection: string | null;
  confidence: number;
}

const DEFAULT_BASE_URL = 'https://api.neverbounce.com';

/**
 * NeverBounce Single Email Verification Connector (fixture-tested, not live-verified)
 * Official endpoint: GET https://api.neverbounce.com/v4.2/single/check?key={key}&email={email}
 */
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
  readonly verification = 'fixture-tested' as const;

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

    const baseCheck = validateAndResolveBaseUrl(DEFAULT_BASE_URL, ctx.baseUrl);
    if (baseCheck.error) {
      return { success: false, error: baseCheck.error };
    }

    const fetchCheck = resolveFetch(ctx);
    if (fetchCheck.error || !fetchCheck.fetchFn) {
      return { success: false, error: fetchCheck.error };
    }
    const fetchImpl = fetchCheck.fetchFn;

    const start = Date.now();
    const params = new URLSearchParams({
      key: ctx.apiKey,
      email: input.email,
    });

    const url = `${baseCheck.url}/v4.2/single/check?${params.toString()}`;

    try {
      const response = await safeFetch(fetchImpl, url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const latencyMs = Date.now() - start;

      const redirectErr = checkRedirectResponse(response);
      if (redirectErr) {
        return { success: false, latencyMs, error: redirectErr };
      }

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
        execution_time?: number;
      };

      let result: NeverBounceOutput['result'] = 'unknown';
      let confidence = 0.5;

      switch (json.result) {
        case 'valid':
          result = 'valid';
          confidence = 0.95;
          break;
        case 'invalid':
          result = 'invalid';
          confidence = 0.95;
          break;
        case 'disposable':
          result = 'disposable';
          confidence = 0.99;
          break;
        case 'catchall':
          result = 'catchall';
          confidence = 0.4;
          break;
        default:
          result = 'unknown';
          confidence = 0.3;
      }

      return {
        success: true,
        latencyMs,
        data: {
          result,
          flags: json.flags ?? [],
          suggestedCorrection: json.suggested_correction || null,
          confidence,
        },
        raw: {
          status: json.status,
          result,
          flags: json.flags ?? [],
          executionTime: json.execution_time,
        },
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown NeverBounce error', [
            ctx.apiKey,
          ]),
          retryable: true,
        },
      };
    }
  }
}
