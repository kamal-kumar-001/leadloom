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

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiInput {
  messages: OpenAiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'text' | 'json_object' };
}

export interface OpenAiOutput {
  content: string;
  model: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_BASE_URL = 'https://api.openai.com';

/**
 * OpenAI Chat Completions Connector (fixture-tested, not live-verified)
 * Official endpoint: POST https://api.openai.com/v1/chat/completions
 */
export class OpenAiConnector implements Connector<OpenAiInput, OpenAiOutput> {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly capabilities: ConnectorCapability[] = ['ai_chat', 'ai_completion'];
  readonly auth = {
    type: 'bearer' as const,
    description: 'OpenAI API key (Bearer token)',
  };
  readonly rateLimit = {
    requestsPerMinute: 500,
    concurrency: 10,
  };
  readonly verification = 'fixture-tested' as const;

  async run(
    input: OpenAiInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<OpenAiOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'OpenAI API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.messages || input.messages.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one message is required for OpenAI chat completion',
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
    const model = input.model ?? 'gpt-4o-mini';
    const url = `${baseCheck.url}/v1/chat/completions`;

    try {
      const response = await safeFetch(fetchImpl, url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens,
          response_format: input.responseFormat,
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
            message: 'OpenAI rate limit exceeded',
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
            message: `OpenAI HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        id?: string;
        model?: string;
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const choice = json.choices?.[0];
      const content = choice?.message?.content ?? '';

      return {
        success: true,
        latencyMs,
        data: {
          content,
          model: json.model ?? model,
          finishReason: choice?.finish_reason,
          usage: json.usage
            ? {
                promptTokens: json.usage.prompt_tokens ?? 0,
                completionTokens: json.usage.completion_tokens ?? 0,
                totalTokens: json.usage.total_tokens ?? 0,
              }
            : undefined,
        },
        raw: {
          id: json.id,
          model: json.model ?? model,
          finishReason: choice?.finish_reason,
          usage: json.usage
            ? {
                promptTokens: json.usage.prompt_tokens ?? 0,
                completionTokens: json.usage.completion_tokens ?? 0,
                totalTokens: json.usage.total_tokens ?? 0,
              }
            : undefined,
        },
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown OpenAI error', [
            ctx.apiKey,
          ]),
          retryable: true,
        },
      };
    }
  }
}
