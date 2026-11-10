import { ConnectorContext, ConnectorError } from './connector.interface';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Redacts secret tokens and URL credential query parameters from strings.
 */
export function redactSecrets(text: string, secrets: Array<string | undefined> = []): string {
  if (!text) return '';
  let cleaned = String(text);

  // Redact explicit secret strings (if non-empty and non-trivial)
  for (const s of secrets) {
    if (s && s.length >= 3) {
      cleaned = cleaned.split(s).join('[REDACTED]');
    }
  }

  // Redact common URL parameter credential leaks: ?key=..., &api_key=..., etc.
  cleaned = cleaned.replace(/([?&](?:api_?key|key|token|access_token|secret)=)[^&#\s]+/gi, '$1[REDACTED]');

  return cleaned;
}

/**
 * Sanitizes URLs for logging or storage in results.
 */
export function sanitizeUrl(rawUrl: string, secrets: Array<string | undefined> = []): string {
  return redactSecrets(rawUrl, secrets);
}

/**
 * Validates and resolves ctx.baseUrl against the vendor's default URL.
 * - Vendors: protocol MUST be https: and hostname MUST match the default host.
 * - Ollama (allowLocalHttp: true): protocol can be http/https, but hostname MUST be loopback
 *   (127.0.0.1, localhost, ::1). Rejects cloud metadata (169.254.169.254, metadata.google.internal)
 *   and link-local / external networks.
 */
export function validateAndResolveBaseUrl(
  defaultBaseUrl: string,
  ctxBaseUrl?: string,
  options?: { allowLocalHttp?: boolean }
): { url: string; error?: ConnectorError } {
  if (!ctxBaseUrl || ctxBaseUrl.trim() === '') {
    return { url: defaultBaseUrl.replace(/\/+$/, '') };
  }

  const cleanCtx = ctxBaseUrl.trim();
  let parsedCtx: URL;
  let parsedDefault: URL;

  try {
    parsedCtx = new URL(cleanCtx);
  } catch {
    return {
      url: defaultBaseUrl,
      error: {
        code: 'INVALID_BASE_URL',
        message: 'Invalid baseUrl format: must be a valid absolute URL',
        retryable: false,
      },
    };
  }

  try {
    parsedDefault = new URL(defaultBaseUrl);
  } catch {
    parsedDefault = new URL('https://api.leadloom.invalid');
  }

  if (options?.allowLocalHttp) {
    // Ollama: allow http or https only for localhost / 127.0.0.1 / ::1
    if (parsedCtx.protocol !== 'http:' && parsedCtx.protocol !== 'https:') {
      return {
        url: defaultBaseUrl,
        error: {
          code: 'INVALID_BASE_URL',
          message: `Local baseUrl protocol must be http: or https:, got "${parsedCtx.protocol}"`,
          retryable: false,
        },
      };
    }

    const hostWithoutPort = parsedCtx.hostname.toLowerCase();

    // Explicitly reject cloud metadata addresses & link-local
    if (
      hostWithoutPort === '169.254.169.254' ||
      hostWithoutPort.startsWith('169.254.') ||
      hostWithoutPort === 'metadata.google.internal' ||
      hostWithoutPort === 'instance-data'
    ) {
      return {
        url: defaultBaseUrl,
        error: {
          code: 'INVALID_BASE_URL',
          message: 'Cloud metadata and link-local addresses are strictly prohibited',
          retryable: false,
        },
      };
    }

    if (!LOOPBACK_HOSTNAMES.has(hostWithoutPort)) {
      return {
        url: defaultBaseUrl,
        error: {
          code: 'INVALID_BASE_URL',
          message: `Local daemon baseUrl host must be loopback (127.0.0.1, localhost, ::1); got "${hostWithoutPort}"`,
          retryable: false,
        },
      };
    }

    return { url: cleanCtx.replace(/\/+$/, '') };
  }

  // Remote vendors: protocol MUST be https:
  if (parsedCtx.protocol !== 'https:') {
    return {
      url: defaultBaseUrl,
      error: {
        code: 'INVALID_BASE_URL',
        message: `Vendor baseUrl must use HTTPS; rejected insecure protocol "${parsedCtx.protocol}"`,
        retryable: false,
      },
    };
  }

  // Hostname must strictly equal default hostname
  if (parsedCtx.hostname.toLowerCase() !== parsedDefault.hostname.toLowerCase()) {
    return {
      url: defaultBaseUrl,
      error: {
        code: 'INVALID_BASE_URL',
        message: `Base URL redirect rejected: hostname "${parsedCtx.hostname}" must match default vendor host "${parsedDefault.hostname}"`,
        retryable: false,
      },
    };
  }

  return { url: cleanCtx.replace(/\/+$/, '') };
}

/**
 * Resolves the fetch function for a connector call.
 * Uses ctx.fetch if provided.
 * If not provided, only falls back to global fetch when LEADLOOM_CONNECTORS_LIVE_ENABLED === 'true'.
 * Otherwise returns a NETWORK_DISABLED error (default posture).
 */
export function resolveFetch(ctx: ConnectorContext): { fetchFn?: typeof fetch; error?: ConnectorError } {
  if (ctx.fetch) {
    return { fetchFn: ctx.fetch };
  }

  if (process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED === 'true') {
    return { fetchFn: globalThis.fetch };
  }

  return {
    error: {
      code: 'NETWORK_DISABLED',
      message:
        'Live connector calls are disabled by default (LEADLOOM_CONNECTORS_LIVE_ENABLED != true) and no test fixture fetch was provided in context',
      retryable: false,
    },
  };
}
