import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaInput {
  messages: OllamaMessage[];
  model?: string;
  temperature?: number;
}

export interface OllamaOutput {
  content: string;
  model: string;
  totalDuration?: number;
  evalCount?: number;
}

export class OllamaConnector implements Connector<OllamaInput, OllamaOutput> {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly capabilities: ConnectorCapability[] = ['ai_chat', 'ai_completion'];
  readonly auth = {
    type: 'none' as const,
    description: 'Local execution (no API key required, zero external spend)',
  };
  readonly rateLimit = {
    requestsPerMinute: 120,
    concurrency: 2,
  };

  async run(
    input: OllamaInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<OllamaOutput>> {
    if (!input.messages || input.messages.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one message is required for Ollama chat request',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const base = ctx.baseUrl ?? 'http://127.0.0.1:11434';
    const model = input.model ?? 'llama3.2';
    const url = `${base}/api/chat`;

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          stream: false,
          options: {
            temperature: input.temperature ?? 0.7,
          },
        }),
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'PROVIDER_ERROR',
            status: response.status,
            message: `Ollama HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        model?: string;
        message?: { content?: string };
        total_duration?: number;
        eval_count?: number;
      };

      const content = json.message?.content ?? '';

      return {
        success: true,
        latencyMs,
        costMicrocents: 0, // Local model: $0 spend
        data: {
          content,
          model: json.model ?? model,
          totalDuration: json.total_duration,
          evalCount: json.eval_count,
        },
        raw: json as Record<string, unknown>,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: `Ollama local daemon unreachable at ${base}: ${err instanceof Error ? err.message : String(err)}`,
          retryable: true,
        },
      };
    }
  }
}
