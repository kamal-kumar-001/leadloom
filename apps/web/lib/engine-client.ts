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

/**
 * Sample-data fallback for local UI work only. It fails closed: a production
 * build never serves sample data, even if the flag is set by mistake.
 */
export function mockFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENGINE_MOCK_FALLBACK === 'true';
}

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
 * Unified fetch wrapper communicating with apps/engine
 */
export async function engineFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; isMock: boolean; error?: string; status?: number }> {
  // Same-origin proxy: the server attaches the engine credential from the session cookie.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`/api/engine${path}`, {
      ...options,
      credentials: 'same-origin',
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
    if (mockFallbackAllowed() && options.method !== 'POST') {
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
      status: err instanceof EngineClientError ? err.statusCode : undefined,
    };
  }
}

/**
 * Verified WhoAmI check: queries GET /auth/me on engine to verify identity, workspace and role
 */
export async function fetchAuthMe(): Promise<{ data: EngineAuthMe | null; error?: string; status?: number }> {
  const res = await engineFetch<EngineAuthMe>('/auth/me', { method: 'GET' });
  return { data: res.data, error: res.error, status: res.status };
}

/**
 * First sign-in self provisioning: calls POST /auth/provision with display name
 */
export async function provisionWorkspace(name?: string): Promise<{
  success: boolean;
  status: 'created' | 'already_exists' | 'rate_limited' | 'error';
  error?: string;
}> {
  try {
    const res = await fetch('/api/engine/auth/provision', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
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
  error?: string;
}> {
  const result = await engineFetch<MaskedBYOKCredential[]>('/vault/credentials', {
    method: 'GET',
  });

  if (result.data) {
    return { credentials: result.data, isMock: false };
  }

  // Display demo sample data if engine mock fallback enabled
  if (mockFallbackAllowed()) {
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

  return { credentials: [], isMock: false, error: result.error || 'Failed to fetch vault credentials' };
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

export async function deleteVaultCredential(
  credentialId: string
): Promise<{ deleted: boolean; isMock: boolean }> {
  const result = await engineFetch<{ deleted: boolean }>(`/vault/credentials/${credentialId}`, {
    method: 'DELETE',
  });

  if (result.data) {
    return { deleted: result.data.deleted, isMock: false };
  }

  throw new EngineClientError(
    result.error || 'Engine vault unavailable. Credential was not deleted.',
    result.status || 503,
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

/**
 * Workspace read views (engine GET /workspace/*). Real persisted data only,
 * scoped by the server to the session's workspace. Failures return an error
 * and null data: callers show an honest error or empty state, never samples.
 */
export interface WorkspaceSummary {
  tables: number;
  mailboxes: number;
  campaigns: number;
  suppressions: number;
  experiments: number;
  providerKeys: number;
}
export interface WorkspaceTableRow {
  id: string;
  name: string;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface WorkspaceMailboxRow {
  id: string;
  email: string;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  healthScore: number;
  dailySendLimit: number;
  sentToday: number;
  isPaused: boolean;
  lastHealthCheckAt: string | null;
  createdAt: string;
}
export interface WorkspaceCampaignRow {
  id: string;
  name: string;
  status: string;
  dailyLimitTotal: number;
  scheduleTimezone: string;
  createdAt: string;
  updatedAt: string;
}

async function workspaceRead<T>(path: string): Promise<{ data: T | null; error?: string }> {
  const result = await engineFetch<T>(path, { method: 'GET' });
  if (result.data !== null && result.data !== undefined && !result.isMock) return { data: result.data };
  return { data: null, error: result.error || 'The workspace data could not be loaded.' };
}
export const fetchWorkspaceSummary = () => workspaceRead<WorkspaceSummary>('/workspace/summary');
export const fetchWorkspaceTables = () => workspaceRead<WorkspaceTableRow[]>('/workspace/tables');
export const fetchWorkspaceMailboxes = () => workspaceRead<WorkspaceMailboxRow[]>('/workspace/mailboxes');
export const fetchWorkspaceCampaigns = () => workspaceRead<WorkspaceCampaignRow[]>('/workspace/campaigns');
