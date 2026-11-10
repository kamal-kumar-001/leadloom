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

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

/**
 * Ollama Local Model Inference Connector (fixture-tested, not live-verified)
 * Official endpoint: POST http://127.0.0.1:11434/api/chat
 * Security: Strictly enforces loopback (127.0.0.1/localhost/::1) and rejects all external/cloud-metadata hosts.
 */
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
  readonly verification = 'fixture-tested' as const;

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

    const baseCheck = validateAndResolveBaseUrl(DEFAULT_BASE_URL, ctx.baseUrl, {
      allowLocalHttp: true,
    });
    if (baseCheck.error) {
      return { success: false, error: baseCheck.error };
    }

    const fetchCheck = resolveFetch(ctx);
    if (fetchCheck.error || !fetchCheck.fetchFn) {
      return { success: false, error: fetchCheck.error };
    }
    const fetchImpl = fetchCheck.fetchFn;

    const start = Date.now();
    const model = input.model ?? 'llama3.2';
    const url = `${baseCheck.url}/api/chat`;

    try {
      const response = await safeFetch(fetchImpl, url, {
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

      const redirectErr = checkRedirectResponse(response);
      if (redirectErr) {
        return { success: false, latencyMs, error: redirectErr };
      }

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
        raw: {
          model: json.model ?? model,
          totalDuration: json.total_duration,
          evalCount: json.eval_count,
        },
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(
            `Ollama local daemon unreachable: ${err instanceof Error ? err.message : 'Unknown network failure'}`,
            [ctx.apiKey]
          ),
          retryable: true,
        },
      };
    }
  }
}
