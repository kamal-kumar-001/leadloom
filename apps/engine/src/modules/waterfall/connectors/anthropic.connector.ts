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
} from './security';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicInput {
  messages: AnthropicMessage[];
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AnthropicOutput {
  content: string;
  model: string;
  stopReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

const DEFAULT_BASE_URL = 'https://api.anthropic.com';

/**
 * Anthropic Messages Connector (fixture-tested, not live-verified)
 * Official endpoint: POST https://api.anthropic.com/v1/messages
 */
export class AnthropicConnector implements Connector<AnthropicInput, AnthropicOutput> {
  readonly id = 'anthropic';
  readonly name = 'Anthropic Claude';
  readonly capabilities: ConnectorCapability[] = ['ai_chat', 'ai_completion'];
  readonly auth = {
    type: 'custom_header' as const,
    headerName: 'x-api-key',
    description: 'Anthropic API key',
  };
  readonly rateLimit = {
    requestsPerMinute: 300,
    concurrency: 5,
  };
  readonly verification = 'fixture-tested' as const;

  async run(
    input: AnthropicInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<AnthropicOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'Anthropic API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.messages || input.messages.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one message is required for Anthropic completion',
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
    const model = input.model ?? 'claude-3-5-sonnet-20241022';
    const url = `${baseCheck.url}/v1/messages`;

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ctx.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          system: input.system,
          max_tokens: input.maxTokens ?? 1024,
          temperature: input.temperature,
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
            message: 'Anthropic rate limit reached',
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
            message: `Anthropic HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        id?: string;
        model?: string;
        content?: Array<{ type?: string; text?: string }>;
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const textBlock = json.content?.find((c) => c.type === 'text');
      const text = textBlock?.text ?? '';

      return {
        success: true,
        latencyMs,
        data: {
          content: text,
          model: json.model ?? model,
          stopReason: json.stop_reason,
          usage: json.usage
            ? {
                inputTokens: json.usage.input_tokens ?? 0,
                outputTokens: json.usage.output_tokens ?? 0,
              }
            : undefined,
        },
        raw: json as Record<string, unknown>,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown Anthropic error', [
            ctx.apiKey,
          ]),
          retryable: true,
        },
      };
    }
  }
}
