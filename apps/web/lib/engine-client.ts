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
  authType?: string;
  connectionStatus?: string | null;
  connectionCheckedAt?: string | null;
  connectionErrorCode?: string | null;
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

export interface WorkspaceSuppressionRow {
  id: string;
  /** First 8 hex chars of the stored hash. The address itself is never available. */
  hashPrefix: string;
  reason: string | null;
  source: string | null;
  createdAt: string;
}
export interface WorkspaceExperimentRow {
  id: string;
  /** Truncated to 140 characters by the server. */
  hypothesis: string;
  verdict: string;
  verdictScore: number | null;
  createdAt: string;
}
export const fetchWorkspaceSuppressions = () => workspaceRead<WorkspaceSuppressionRow[]>('/workspace/suppressions');
export const fetchWorkspaceExperiments = () => workspaceRead<WorkspaceExperimentRow[]>('/workspace/experiments');

export interface MailboxPreset {
  id: 'gmail' | 'outlook' | 'yahoo' | 'custom';
  label: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  secretLabel: string;
  steps: string[];
  sourceUrl: string | null;
  caveat: string | null;
}

export interface ConnectMailboxInput {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
}

export type ConnectionCheckCode =
  | 'ok'
  | 'auth_failed'
  | 'unreachable'
  | 'timeout'
  | 'tls_error'
  | 'failed'
  | 'skipped';

export interface MailboxConnectionResult {
  smtp: ConnectionCheckCode;
  imap: ConnectionCheckCode | 'skipped';
}

export interface ConnectMailboxResponse {
  mailbox: {
    id: string;
    email: string;
    connectionStatus: string;
    connectionErrorCode: string | null;
    connectionCheckedAt: string | null;
  };
  result: MailboxConnectionResult;
  mailSent: false;
}

export interface TestMailboxResponse {
  mailbox: {
    id: string;
    email: string;
    connectionStatus: string;
    connectionErrorCode: string | null;
    connectionCheckedAt: string | null;
  };
  result: MailboxConnectionResult;
  mailSent: false;
}

export async function fetchMailboxPresets(): Promise<{
  data: MailboxPreset[] | null;
  unavailable?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/engine/workspace/mailbox-presets', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    });
    if (res.status === 404) {
      return { data: null, unavailable: true };
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        data: null,
        error: errJson.error || `Server responded with status ${res.status}`,
      };
    }
    const data = await res.json();
    return { data: data as MailboxPreset[] };
  } catch (err: unknown) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error loading presets',
    };
  }
}

export async function connectMailbox(input: ConnectMailboxInput): Promise<{
  data: ConnectMailboxResponse | null;
  error?: string;
  code?: string;
  result?: MailboxConnectionResult;
}> {
  try {
    const res = await fetch('/api/engine/workspace/mailboxes/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: json.error || `Connection failed with status ${res.status}`,
        code: json.code,
        result: json.result,
      };
    }
    return { data: json as ConnectMailboxResponse };
  } catch (err: unknown) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error connecting mailbox',
    };
  }
}

export async function testMailboxConnection(id: string): Promise<{
  data: TestMailboxResponse | null;
  error?: string;
  code?: string;
  result?: MailboxConnectionResult;
}> {
  try {
    const res = await fetch(`/api/engine/workspace/mailboxes/${id}/test`, {
      method: 'POST', // no body: a JSON content-type with an empty body is rejected (400) by the engine
      credentials: 'same-origin',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: json.error || `Test failed with status ${res.status}`,
        code: json.code,
        result: json.result,
      };
    }
    return { data: json as TestMailboxResponse };
  } catch (err: unknown) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error testing mailbox',
    };
  }
}

export async function deleteMailbox(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/engine/workspace/mailboxes/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: json.error || `Removal failed with status ${res.status}`,
      };
    }
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error removing mailbox',
    };
  }
}


export interface ConnectorStatusItem {
  id: string;
  name: string;
  state: 'login_verify_only' | 'not_built' | 'partner_limited' | 'unverified';
  sendingEnabled: false;
  enabled: boolean;
  note: string;
  reference?: string;
}

/** Live engine status for outreach channels. Never falls back to sample data. */
export async function fetchConnectorStatus(): Promise<{ connectors: ConnectorStatusItem[]; error?: string }> {
  const result = await engineFetch<{ connectors: ConnectorStatusItem[] }>('/workspace/connectors/status', { method: 'GET' });
  if (result.data) return { connectors: result.data.connectors };
  return { connectors: [], error: result.error || 'Engine status unavailable' };
}

export interface OutboundApprovalRow {
  id: string;
  workspaceId: string;
  campaignId: string;
  campaignName: string;
  recipientEmail: string;
  stepNumber: number;
  subject?: string;
  bodySnippet?: string;
  bodyTemplate?: string;
  senderMailboxIds?: string[];
  stale?: boolean;
  status: 'pending_approval' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  scheduledAt: string;
  createdAt: string;
}

export interface ApprovalQueueStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface ApprovalQueueResponse {
  items: OutboundApprovalRow[];
  stats: ApprovalQueueStats;
  sendingEnabled: false;
}

export async function fetchApprovalQueue(campaignId?: string): Promise<{ data: ApprovalQueueResponse | null; error?: string }> {
  const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
  const result = await engineFetch<ApprovalQueueResponse>(`/outbound/approvals${query}`, { method: 'GET' });
  if (result.data) return { data: result.data };
  return { data: null, error: result.error || 'Failed to fetch approval queue' };
}

export interface InboundReplyRow {
  id: string;
  campaignId: string | null;
  mailboxId: string | null;
  messageId: string;
  fromEmail: string;
  subject: string | null;
  classification: 'interested' | 'objection' | 'out_of_office' | 'unsubscribe' | 'neutral' | 'bounce';
  confidence: number;
  attribution: 'thread_header' | 'recipient_match' | 'ambiguous_recipient' | 'unattributed';
  receivedAt: string;
}

export async function fetchInboundReplies(campaignId?: string): Promise<{ data: { items: InboundReplyRow[] } | null; error?: string }> {
  const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
  const result = await engineFetch<{ items: InboundReplyRow[] }>(`/outbound/replies${query}`, { method: 'GET' });
  if (result.data) return { data: result.data };
  return { data: null, error: result.error || 'Failed to fetch replies' };
}

export async function approveOutboundJobs(input: {
  jobIds?: string[];
  all?: boolean;
  campaignId?: string;
}): Promise<{ approvedCount: number; staleCount: number; sendingEnabled: false; error?: string }> {
  const result = await engineFetch<{ approvedCount: number; staleCount: number; sendingEnabled: false }>('/outbound/approvals/approve', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (result.data) return result.data;
  return { approvedCount: 0, staleCount: 0, sendingEnabled: false, error: result.error || 'Approval failed' };
}

export async function rejectOutboundJobs(input: {
  jobIds?: string[];
  all?: boolean;
  campaignId?: string;
  reason?: string;
}): Promise<{ rejectedCount: number; error?: string }> {
  const result = await engineFetch<{ rejectedCount: number }>('/outbound/approvals/reject', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (result.data) return result.data;
  return { rejectedCount: 0, error: result.error || 'Rejection failed' };
}

