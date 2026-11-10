import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

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

    if (!input.query?.trim()) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Query string required for Serper search',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const url = ctx.baseUrl ? `${ctx.baseUrl}/search` : 'https://google.serper.dev/search';

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': ctx.apiKey,
        },
        body: JSON.stringify({
          q: input.query,
          num: input.num ?? 10,
          gl: input.country ?? 'us',
          hl: input.language ?? 'en',
        }),
      });

      const latencyMs = Date.now() - start;

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
        searchParameters?: { q?: string };
        organic?: Array<{ title?: string; link?: string; snippet?: string; position?: number }>;
        knowledgeGraph?: {
          title?: string;
          type?: string;
          description?: string;
          website?: string;
        };
      };

      const organic: SerperOrganicResult[] = (json.organic ?? []).map((item, index) => ({
        title: item.title ?? '',
        link: item.link ?? '',
        snippet: item.snippet ?? '',
        position: item.position ?? index + 1,
      }));

      return {
        success: true,
        latencyMs,
        costMicrocents: 100, // ~$0.001
        data: {
          query: json.searchParameters?.q ?? input.query,
          organic,
          knowledgeGraph: json.knowledgeGraph,
          totalResults: organic.length,
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
