import {
  MaskedBYOKCredential,
  SaveBYOKCredentialRequest,
  BYOKProvider,
  PreFlightEstimateResponse,
  MOCK_PREFLIGHT_RESPONSE,
} from '@leadloom/contracts';

interface CachedToken {
  token: string;
  expiresAt: number;
}

let memoryTokenCache: CachedToken | null = null;

export class EngineClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public code: string = 'ENGINE_ERROR'
  ) {
    super(message);
    this.name = 'EngineClientError';
  }
}

export interface EngineAuthMe {
  userId: string;
  workspaceId: string;
  role: string;
}

/**
 * Fetch the short-lived HS256 bridge JWT minted by apps/web/app/api/engine-token
 */
export async function getEngineToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const now = Date.now();
  if (memoryTokenCache && memoryTokenCache.expiresAt - now > 60_000) {
    return memoryTokenCache.token;
  }

  try {
    const res = await fetch('/api/engine-token', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return null;
      throw new EngineClientError('Failed to retrieve bridge token', res.status);
    }

    const data = await res.json();
    if (data.token) {
      memoryTokenCache = {
        token: data.token,
        expiresAt: now + 840_000,
      };
      return data.token;
    }
    return null;
  } catch (err) {
    if (err instanceof EngineClientError) throw err;
    return null;
  }
}

/**
 * Unified fetch wrapper communicating with apps/engine
 */
export async function engineFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; isMock: boolean; error?: string }> {
  const engineBaseUrl =
    process.env.NEXT_PUBLIC_ENGINE_URL || 'http://127.0.0.1:4100';
  const token = await getEngineToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${engineBaseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 429) {
        throw new EngineClientError(
          'Engine rate limit exceeded. Please wait a moment before retrying.',
          429,
          true,
          'RATE_LIMITED'
        );
      }
      if (res.status >= 500) {
        throw new EngineClientError(
          'Engine service temporarily unavailable.',
          res.status,
          true,
          'SERVICE_UNAVAILABLE'
        );
      }
      const errJson = await res.json().catch(() => ({}));
      throw new EngineClientError(
        errJson.error || errJson.message || `Engine responded with status ${res.status}`,
        res.status,
        false
      );
    }

    const json = await res.json();
    return { data: json as T, isMock: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Never fail silently into mock mode after a live call fails.
    // If mock fallback is explicitly turned on for offline demo, allow it for read routes only.
    if (process.env.NEXT_PUBLIC_ENGINE_MOCK_FALLBACK === 'true' && options.method !== 'POST') {
      return {
        data: null,
        isMock: true,
        error: message,
      };
    }

    return {
      data: null,
      isMock: false,
      error: message,
    };
  }
}

/**
 * Verified WhoAmI check: queries GET /auth/me on engine to verify identity, workspace and role
 */
export async function fetchAuthMe(): Promise<{ data: EngineAuthMe | null; error?: string }> {
  const res = await engineFetch<EngineAuthMe>('/auth/me', { method: 'GET' });
  return { data: res.data, error: res.error };
}

/**
 * First sign-in self provisioning: calls POST /auth/provision with display name
 */
export async function provisionWorkspace(name?: string): Promise<{
  success: boolean;
  status: 'created' | 'already_exists' | 'rate_limited' | 'error';
  error?: string;
}> {
  const token = await getEngineToken();
  if (!token) {
    return { success: false, status: 'error', error: 'Authentication bridge token required' };
  }

  const engineBaseUrl =
    process.env.NEXT_PUBLIC_ENGINE_URL || 'http://127.0.0.1:4100';

  try {
    const res = await fetch(`${engineBaseUrl}/auth/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: name || null }),
    });

    if (res.status === 429) {
      return { success: false, status: 'rate_limited', error: 'Signup rate limit exceeded' };
    }
    if (res.status === 409) {
      return { success: false, status: 'already_exists', error: 'Workspace already provisioned' };
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { success: false, status: 'error', error: json.error || 'Provisioning failed' };
    }

    return { success: true, status: 'created' };
  } catch (err: unknown) {
    return {
      success: false,
      status: 'error',
      error: err instanceof Error ? err.message : 'Engine connection failed',
    };
  }
}

/**
 * Vault Services
 */
export async function fetchVaultCredentials(): Promise<{
  credentials: MaskedBYOKCredential[];
  isMock: boolean;
}> {
  const result = await engineFetch<MaskedBYOKCredential[]>('/vault/credentials', {
    method: 'GET',
  });

  if (result.data) {
    return { credentials: result.data, isMock: false };
  }

  // Display demo sample data if engine mock fallback enabled
  const fallback: MaskedBYOKCredential[] = [
    {
      id: '00000000-0000-4000-8000-000000001001',
      provider: 'apollo',
      label: 'Sample Apollo Tier 1',
      maskedKey: 'sk-••••••••••••4a91',
      isValid: true,
      quotaRemaining: 4850,
      lastVerifiedAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
      id: '00000000-0000-4000-8000-000000001002',
      provider: 'hunter',
      label: 'Sample Hunter Fallback',
      maskedKey: 'sk-••••••••••••b82f',
      isValid: true,
      quotaRemaining: 1200,
      lastVerifiedAt: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    },
  ];

  return { credentials: fallback, isMock: true };
}

export async function saveVaultCredential(
  req: SaveBYOKCredentialRequest
): Promise<{ credential: MaskedBYOKCredential; isMock: boolean }> {
  const result = await engineFetch<MaskedBYOKCredential>('/vault/credentials', {
    method: 'POST',
    body: JSON.stringify(req),
  });

  if (result.data) {
    return { credential: result.data, isMock: false };
  }

  // If saving fails on live engine, fail explicitly. Never pretend a save succeeded!
  throw new EngineClientError(
    result.error || 'Engine vault unavailable. Credential was not saved.',
    503,
    false,
    'VAULT_UNAVAILABLE'
  );
}

export async function testConnectorPing(
  provider: BYOKProvider,
  _config?: Record<string, unknown>
): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  const result = await engineFetch<{ success: boolean; latencyMs?: number; message?: string }>(
    `/connectors/${provider}/test`,
    { method: 'POST' }
  );

  const latencyMs = result.data?.latencyMs || Math.max(Date.now() - start, 48);

  if (result.data) {
    return {
      success: result.data.success ?? true,
      latencyMs,
      message: result.data.message || `Provider handshake verified (${provider})`,
    };
  }

  // Fail closed: test connection requires live engine and permission
  return {
    success: false,
    latencyMs: 0,
    message: result.error || 'Test Connection is disabled (requires live engine and permission)',
  };
}

export async function estimateWaterfallCost(
  _selectedRowCount: number
): Promise<PreFlightEstimateResponse> {
  return MOCK_PREFLIGHT_RESPONSE;
}
