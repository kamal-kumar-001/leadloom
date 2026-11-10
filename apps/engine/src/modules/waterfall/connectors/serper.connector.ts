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

export interface SerperInput {
  query: string;
  num?: number;
  country?: string;
  language?: string;
}

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerperOutput {
  query: string;
  organic: SerperOrganicResult[];
  knowledgeGraph?: {
    title?: string;
    type?: string;
    description?: string;
    website?: string;
  };
  totalResults?: number;
}

const DEFAULT_BASE_URL = 'https://google.serper.dev';

/**
 * Serper Google Search Signal Connector (fixture-tested, not live-verified)
 * Official endpoint: POST https://google.serper.dev/search
 */
export class SerperConnector implements Connector<SerperInput, SerperOutput> {
  readonly id = 'serper';
  readonly name = 'Serper Google Search';
  readonly capabilities: ConnectorCapability[] = ['search'];
  readonly auth = {
    type: 'custom_header' as const,
    headerName: 'X-API-KEY',
    description: 'Serper.dev API key',
  };
  readonly rateLimit = {
    requestsPerMinute: 300,
    concurrency: 5,
  };
  readonly verification = 'fixture-tested' as const;

  async run(
    input: SerperInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<SerperOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'Serper API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.query || input.query.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Search query must be non-empty',
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
    const url = `${baseCheck.url}/search`;

    try {
      const response = await safeFetch(fetchImpl, url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': ctx.apiKey,
        },
        body: JSON.stringify({
          q: input.query,
          num: input.num ?? 10,
          gl: input.country,
          hl: input.language,
        }),
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
            message: 'Serper rate limit reached',
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
            message: `Serper HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        organic?: Array<{
          title?: string;
          link?: string;
          snippet?: string;
          position?: number;
        }>;
        knowledgeGraph?: {
          title?: string;
          type?: string;
          description?: string;
          website?: string;
        };
        searchParameters?: { q?: string };
      };

      const organic: SerperOrganicResult[] = (json.organic ?? []).map((item, idx) => ({
        title: item.title ?? '',
        link: item.link ?? '',
        snippet: item.snippet ?? '',
        position: item.position ?? idx + 1,
      }));

      return {
        success: true,
        latencyMs,
        data: {
          query: input.query,
          organic,
          knowledgeGraph: json.knowledgeGraph,
          totalResults: organic.length,
        },
        raw: {
          totalResults: organic.length,
        },
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown Serper error', [
            ctx.apiKey,
          ]),
          retryable: true,
        },
      };
    }
  }
}
