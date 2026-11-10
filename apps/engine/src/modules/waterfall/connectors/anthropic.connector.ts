import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

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
          message: 'At least one message is required for Anthropic Claude request',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const url = ctx.baseUrl ? `${ctx.baseUrl}/v1/messages` : 'https://api.anthropic.com/v1/messages';
    const model = input.model ?? 'claude-3-5-sonnet-20241022';
    const maxTokens = input.maxTokens ?? 1024;

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
          max_tokens: maxTokens,
          messages: input.messages,
          system: input.system,
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
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
        };
      };

      const text = json.content?.map((c) => c.text ?? '').join('') ?? '';
      const usage = json.usage
        ? {
            inputTokens: json.usage.input_tokens ?? 0,
            outputTokens: json.usage.output_tokens ?? 0,
          }
        : undefined;

      const costMicrocents = usage
        ? Math.round((usage.inputTokens * 300 + usage.outputTokens * 1500) / 100)
        : 100;

      return {
        success: true,
        latencyMs,
        costMicrocents,
        data: {
          content: text,
          model: json.model ?? model,
          stopReason: json.stop_reason,
          usage,
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
