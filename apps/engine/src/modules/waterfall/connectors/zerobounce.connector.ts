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

const DEFAULT_BASE_URL = 'https://api.zerobounce.com';

/**
 * ZeroBounce Single Email Validation Connector (fixture-tested, not live-verified)
 * Official endpoint: GET https://api.zerobounce.com/v2/validate?api_key={api_key}&email={email}
 */
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
  readonly verification = 'fixture-tested' as const;

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
      api_key: ctx.apiKey,
      email: input.email,
    });
    if (input.ipAddress) {
      params.append('ip_address', input.ipAddress);
    }

    const url = `${baseCheck.url}/v2/validate?${params.toString()}`;

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
        did_you_mean?: string | null;
        free_email?: boolean | string;
        mx_found?: string | boolean;
      };

      let status: ZeroBounceOutput['status'] = 'unknown';
      let confidence = 0.5;

      switch (json.status) {
        case 'valid':
          status = 'valid';
          confidence = 0.98;
          break;
        case 'invalid':
          status = 'invalid';
          confidence = 0.98;
          break;
        case 'catch-all':
          status = 'catch-all';
          confidence = 0.4;
          break;
        case 'spamtrap':
          status = 'spamtrap';
          confidence = 0.99;
          break;
        case 'abuse':
          status = 'abuse';
          confidence = 0.95;
          break;
        case 'do_not_mail':
          status = 'do_not_mail';
          confidence = 0.95;
          break;
        default:
          status = 'unknown';
          confidence = 0.3;
      }

      const mxFound = json.mx_found === true || json.mx_found === 'true';
      const freeEmail = json.free_email === true || json.free_email === 'true';

      const sanitizedRaw = JSON.parse(redactSecrets(JSON.stringify(json), [ctx.apiKey])) as Record<
        string,
        unknown
      >;

      return {
        success: true,
        latencyMs,
        data: {
          status,
          subStatus: json.sub_status,
          account: json.account,
          domain: json.domain,
          didYouMean: json.did_you_mean ?? null,
          freeEmail,
          mxFound,
          confidence,
        },
        raw: sanitizedRaw,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown ZeroBounce error', [
            ctx.apiKey,
          ]),
          retryable: true,
        },
      };
    }
  }
}
