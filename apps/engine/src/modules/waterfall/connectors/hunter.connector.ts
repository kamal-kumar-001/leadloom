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

const DEFAULT_BASE_URL = 'https://api.hunter.io';

/**
 * Hunter.io Email Finder Connector (fixture-tested, not live-verified)
 * Official endpoint: GET https://api.hunter.io/v2/email-finder
 */
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
  readonly verification = 'fixture-tested' as const;

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
    const params = new URLSearchParams();
    if (input.domain) params.append('domain', input.domain);
    if (input.company) params.append('company', input.company);
    if (input.firstName) params.append('first_name', input.firstName);
    if (input.lastName) params.append('last_name', input.lastName);
    if (input.fullName) params.append('full_name', input.fullName);

    const url = `${baseCheck.url}/v2/email-finder?${params.toString()}`;

    try {
      const response = await safeFetch(fetchImpl, url, {
        method: 'GET',
        headers: {
          'X-API-KEY': ctx.apiKey,
          Accept: 'application/json',
        },
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
          data: {
            email: null,
            score: 0,
            verificationStatus: null,
            confidence: 0,
          },
          raw: json as Record<string, unknown>,
        };
      }

      const rawScore = data.score ?? 50;
      const verificationStatus =
        data.verification?.status === 'valid'
          ? 'valid'
          : data.verification?.status === 'accept_all'
          ? 'accept_all'
          : 'unknown';

      const confidence = rawScore / 100;

      return {
        success: true,
        latencyMs,
        data: {
          email: data.email,
          score: rawScore,
          verificationStatus,
          position: data.position,
          company: data.company,
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
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown Hunter error', [
            ctx.apiKey,
          ]),
          retryable: true,
        },
      };
    }
  }
}
