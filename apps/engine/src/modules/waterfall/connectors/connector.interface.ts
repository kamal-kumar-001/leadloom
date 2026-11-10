export type ConnectorCapability =
  | 'person_enrich'
  | 'company_enrich'
  | 'email_verify'
  | 'search'
  | 'ai_chat'
  | 'ai_completion';

export type ConnectorAuthType = 'api_key' | 'bearer' | 'custom_header' | 'none';

export interface ConnectorAuthConfig {
  type: ConnectorAuthType;
  headerName?: string;
  paramName?: string;
  description?: string;
}

export interface ConnectorRateLimit {
  requestsPerMinute?: number;
  concurrency?: number;
}

export interface ConnectorContext {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface ConnectorError {
  code:
    | 'MISSING_CREDENTIAL'
    | 'RATE_LIMITED'
    | 'INVALID_INPUT'
    | 'PROVIDER_ERROR'
    | 'NETWORK_ERROR'
    | 'TIMEOUT'
    | 'NETWORK_DISABLED'
    | 'INVALID_BASE_URL'
    | 'NOT_READY';
  message: string;
  status?: number;
  retryable?: boolean;
}

export interface ConnectorResult<T = unknown> {
  success: boolean;
  data?: T;
  raw?: Record<string, unknown>;
  latencyMs?: number;
  costMicrocents?: number;
  error?: ConnectorError;
}

export interface Connector<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ConnectorCapability[];
  readonly auth: ConnectorAuthConfig;
  readonly rateLimit: ConnectorRateLimit;
  readonly verification: 'fixture-tested';

  run(input: TInput, ctx: ConnectorContext): Promise<ConnectorResult<TOutput>>;
}
