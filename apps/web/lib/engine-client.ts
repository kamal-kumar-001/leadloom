import {
  MaskedBYOKCredential,
  SaveBYOKCredentialRequest,
  BYOKProvider,
  PreFlightEstimateResponse,
  ProjectResponse,
  CreateProjectRequest,
  AgentTokenResponse,
  AgentTokenListItem,
  IssueAgentTokenRequest,
  SetupHealthResponse,
  ImportCapturedLeadsRequest,
  ImportCapturedLeadsResponse,
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
  name?: string | null;
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
    ...(options.body !== undefined && options.body !== null ? { 'Content-Type': 'application/json' } : {}),
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
/** Plan decision for one feature, from the engine's own entitlement route (GATING.md: the engine decides, the web only renders).
 * unconfigured=true means the engine has no entitlement service mounted: enforcement is also off server-side, so the UI must NOT fake a lock. */
export async function fetchEntitlementDecision(feature: string): Promise<{ data: import('@leadloom/contracts').EntitlementDecision | null; unconfigured?: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/engine/entitlements/decision?feature=${encodeURIComponent(feature)}`, { cache: 'no-store' });
    if (res.status === 404) return { data: null, unconfigured: true };
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { data: null, error: (j as { error?: string }).error || `Plan check failed (${res.status})` };
    }
    const j = (await res.json()) as { feature?: { decision?: import('@leadloom/contracts').EntitlementDecision } };
    return { data: j.feature?.decision ?? null };
  } catch {
    return { data: null, error: 'Plan check could not be loaded.' };
  }
}

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
  provider: string,
  _config?: Record<string, unknown>
): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  // Engine mounts this at /vault/credentials/:provider/test (C3). Its honest
  // failure states are 503 DISABLED (live flag off) and 403 FORBIDDEN with a
  // status payload in the body, so engineFetch cannot be used here: it maps
  // every 5xx to a generic "temporarily unavailable" and would swallow the
  // engine's real reason. Parse the body on ANY status instead.
  try {
    const res = await fetch(`/api/engine/vault/credentials/${provider}/test`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
    const body = (await res.json().catch(() => null)) as {
      status?: string;
      latencyMs?: number | null;
      message?: string;
      error?: string;
    } | null;
    if (body && typeof body === 'object') {
      // Never infer success: only an explicit SUCCESS status counts. A DISABLED
      // or FORBIDDEN answer, or a missing status, renders as not verified.
      return {
        success: body.status === 'SUCCESS',
        latencyMs: typeof body.latencyMs === 'number' ? body.latencyMs : Math.max(Date.now() - start, 0),
        message: body.message || body.error || `No verification result returned (${provider})`,
      };
    }
    return { success: false, latencyMs: 0, message: `Engine responded with status ${res.status}` };
  } catch {
    return {
      success: false,
      latencyMs: 0,
      message: 'Engine service temporarily unavailable.',
    };
  }
}

export async function estimateWaterfallCost(
  columnId: string | number,
  rowIds?: string[]
): Promise<{ data: PreFlightEstimateResponse | null; error?: string }> {
  if(typeof columnId!=='string'||!Array.isArray(rowIds))throw new EngineClientError('Live waterfall pricing is unavailable. No provider quote is established.',503,false,'WATERFALL_UNAVAILABLE');
  const result = await engineFetch<PreFlightEstimateResponse>('/waterfall/pre-flight', {
    method: 'POST',
    body: JSON.stringify({ columnId, rowIds }),
  });
  if (result.data) return { data: result.data };
  return { data: null, error: result.error || 'Pre-flight estimate unavailable' };
}

export interface WaterfallDispatchOutcome {
  queued: boolean;
  jobId?: string;
  totalQueued?: number;
  estimatedCompletionAt?: string;
  /** Honest reason when queued is false (e.g. durable persistence not implemented). */
  message?: string;
}

/**
 * D3: real dispatch against the engine. The engine answers 503
 * {queued:false, message} while durable persistence is blocked; that body must
 * survive intact, so engineFetch's generic 5xx mapping cannot be used here.
 * Callers must never imply a job exists when queued is false.
 */
export async function dispatchWaterfall(
  columnId: string,
  rowIds: string[]
): Promise<WaterfallDispatchOutcome> {
  try {
    const res = await fetch('/api/engine/waterfall/dispatch', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId, rowIds }),
    });
    const body = (await res.json().catch(() => null)) as {
      jobId?: string;
      totalQueued?: number;
      estimatedCompletionAt?: string;
      queued?: boolean;
      message?: string;
      error?: string;
    } | null;
    if (res.ok && body?.jobId) {
      return {
        queued: true,
        jobId: body.jobId,
        totalQueued: body.totalQueued,
        estimatedCompletionAt: body.estimatedCompletionAt,
      };
    }
    return {
      queued: false,
      message: body?.message || body?.error || `Engine responded with status ${res.status}`,
    };
  } catch {
    return { queued: false, message: 'Engine service temporarily unavailable.' };
  }
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
  projectId?: string|null;
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
export interface WorkspaceCampaignStep {
  stepNumber: number;
  delayHours: number;
  subject: string;
  bodyTemplate: string;
}
export interface CampaignSendStatus {
  awaitingApproval: number;
  queued: number;
  sending: number;
  sent: number;
  uncertain: number;
  failed: number;
  replies: number;
  lastActivityAt: string | null;
}
export interface WorkspaceCampaignRow {
  replayed?:boolean;
  id: string;
  name: string;
  status: string;
  projectId?: string | null;
  steps?: WorkspaceCampaignStep[];
  dailyLimitTotal: number;
  scheduleTimezone: string;
  createdAt: string;
  updatedAt: string;
  sendStatus?: CampaignSendStatus;
}
export interface CreateWorkspaceCampaignInput {
  requestId?:string;
  name: string;
  steps: WorkspaceCampaignStep[];
  dailyLimitTotal: number;
  scheduleTimezone: string;
  tableId?: string;
  projectId?: string;
  mailboxPoolIds?: string[];
}
export async function createWorkspaceCampaign(input: CreateWorkspaceCampaignInput): Promise<{ data: WorkspaceCampaignRow | null; error?: string }> {
  const result = await engineFetch<WorkspaceCampaignRow>('/workspace/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (result.data && !result.isMock) return { data: result.data };
  return { data: null, error: result.error || 'Campaign could not be created.' };
}
/** Gated release of held approved jobs for one campaign. sendingEnabled reflects the real server gate. */
export async function releaseCampaign(campaignId: string): Promise<{ released: number; sendingEnabled: boolean; error?: string }> {
  const result = await engineFetch<{ released: number; sendingEnabled: boolean }>('/outbound/release', {
    method: 'POST',
    body: JSON.stringify({ campaignId }),
  });
  if (result.data) return result.data;
  return { released: 0, sendingEnabled: false, error: result.error || 'Release failed' };
}

async function workspaceRead<T>(path: string): Promise<{ data: T | null; error?: string }> {
  const result = await engineFetch<T>(path, { method: 'GET' });
  if (result.data !== null && result.data !== undefined && !result.isMock) return { data: result.data };
  return { data: null, error: result.error || 'The workspace data could not be loaded.' };
}
export const fetchWorkspaceSummary = () => workspaceRead<WorkspaceSummary>('/workspace/summary');
export const fetchWorkspaceTables = () => workspaceRead<WorkspaceTableRow[]>('/workspace/tables');
export const fetchWorkspaceMailboxes = () => workspaceRead<WorkspaceMailboxRow[]>('/workspace/mailboxes');
export const fetchWorkspaceCampaigns = (projectId?:string) => workspaceRead<WorkspaceCampaignRow[]>('/workspace/campaigns'+(projectId?'?projectId='+encodeURIComponent(projectId):''));

export interface CampaignJobRow {
  id: string;
  recipientEmail: string;
  stepNumber: number;
  status: string;
  scheduledAt: string;
  reservedAt: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}
export const fetchCampaignJobs = (campaignId: string) =>
  workspaceRead<{ campaign: { id: string; name: string; status: string }; jobs: CampaignJobRow[] }>(`/campaigns/${campaignId}/jobs`);

/**
 * Delivery-event timeline for one job. Every event maps to a recorded
 * column server-side; transition times are not separately recorded, so the
 * current status is a summary field and statusNote must stay visible.
 */
export interface JobTimelineEvent {
  kind: 'queued' | 'scheduled' | 'dispatch_started' | 'status_recorded' | 'reply';
  at: string;
  note?: string;
  classification?: string;
}
export interface JobTimelineResponse {
  campaign: { id: string; name: string; status: string };
  job: { id: string; recipientEmail: string; stepNumber: number; status: string; attempts: number };
  statusNote: string;
  events: JobTimelineEvent[];
}
export const fetchJobTimeline = (campaignId: string, jobId: string) =>
  workspaceRead<JobTimelineResponse>(`/campaigns/${campaignId}/jobs/${jobId}/timeline`);

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
  projectId?: string | null;
  /** Truncated to 140 characters by the server. */
  hypothesis: string;
  verdict: string;
  verdictScore: number | null;
  createdAt: string;
  slug: string | null;
  visitors: number;
  waitlistCount: number;
  pageStatus: 'draft' | 'published';
}

export interface ExperimentScorecard {
  experimentId: string;
  hypothesis: string;
  verdict: string;
  verdictScore: number | null;
  metrics: {
    visitors: number;
    pageConversions: number;
    pageConversionRate: number | null;
    outreachSent: number;
    replies: number;
    replyRate: number;
    positiveReplies: number;
    positiveResonanceRate: number;
    waitlistCount: number;
  };
  actionableSummary: string;
  pageUrl: string;
  sequenceSubject: string;
  sequenceBody: string;
}

export async function fetchExperimentScorecard(experimentId: string): Promise<{ data: ExperimentScorecard | null; error?: string }> {
  const res = await engineFetch<ExperimentScorecard>(`/validator/experiments/${experimentId}/scorecard`);
  return { data: res.data, error: res.error };
}

export async function fetchOwnerPage(experimentId: string): Promise<{ data: (import('../components/validator/page-preview-modal').OwnerPagePreview) | null; error?: string }> {
  const res = await engineFetch<import('../components/validator/page-preview-modal').OwnerPagePreview>(`/validator/experiments/${experimentId}/page`);
  return { data: res.data, error: res.error };
}

export async function editDraftPageCopy(experimentId:string,input:import('@leadloom/contracts').EditDraftPageCopy){
  const result=await engineFetch<import('../components/validator/page-preview-modal').OwnerPagePreview&{saved:true;changed:boolean}>(`/validator/experiments/${experimentId}/page`,{method:'PUT',body:JSON.stringify(input)});
  return{data:result.data,error:result.error,status:result.status};
}

export interface WaitlistLeadItem {
  id: string;
  email: string;
  name?: string | null;
  company?: string | null;
  surveyResponses: Record<string, string>;
  createdAt: string;
}

export interface ExperimentLeadsResponse {
  experimentId: string;
  totalLeads: number;
  leads: WaitlistLeadItem[];
}

export async function fetchExperimentLeads(experimentId: string): Promise<{ data: ExperimentLeadsResponse | null; error?: string }> {
  const res = await engineFetch<ExperimentLeadsResponse>(`/validator/experiments/${experimentId}/leads`);
  return { data: res.data, error: res.error };
}

export async function recordOutreach(experimentId: string, input: { outreachSent: number; replies: number; positiveReplies: number }): Promise<{ data: ExperimentScorecard | null; error?: string }> {
  const res = await engineFetch<ExperimentScorecard>(`/validator/experiments/${experimentId}/outreach`, { method: 'POST', body: JSON.stringify(input) });
  return { data: res.data, error: res.error };
}

export async function setExperimentPublish(experimentId: string, publish: boolean,expectedRevision?:string): Promise<{ data: { slug: string; status: string } | null; error?: string }> {
  const res = await engineFetch<{ slug: string; status: string }>(`/validator/experiments/${experimentId}/${publish ? 'publish' : 'unpublish'}`, { method: 'POST', body: JSON.stringify(publish?{expectedRevision}:{}) });
  return { data: res.data, error: res.error };
}

export async function generateExperiment(input: { rawHypothesis: string; projectId?: string; preferredSlug?: string; pageCopy?: import('@leadloom/contracts').DraftPageCopy; surveyQuestions?: import('@leadloom/contracts').DraftSurveyQuestions }): Promise<{ data: { experimentId: string; pageUrl: string } | null; error?: string; status?: number }> {
  const res = await engineFetch<{ experimentId: string; pageUrl: string }>('/validator/experiments', { method: 'POST', body: JSON.stringify(input) });
  return { data: res.data, error: res.error, status: res.status };
}
export const fetchWorkspaceSuppressions = () => workspaceRead<WorkspaceSuppressionRow[]>('/workspace/suppressions');
export const fetchWorkspaceExperiments = (projectId?:string) => workspaceRead<WorkspaceExperimentRow[]>('/workspace/experiments'+(projectId?'?projectId='+encodeURIComponent(projectId):''));

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
  sendingEnabled: boolean;
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
  /** Exact displayed saved snapshot; null can only request a review refresh. */
  reviewRevision: string | null;
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
  /** Pinned sender mailbox for this job (null/undefined = pool rotation across senderMailboxIds). Signed into the approval hash. */
  senderMailboxId?: string | null;
  /** Campaign's current assigned pool - the choices the sender pin selector offers. */
  availableMailboxIds?: string[];
  stale?: boolean;
  /** Set when the message can no longer be resolved for this recipient; the job stays held until the template or recipient is fixed. */
  resolutionErrors?: string[];
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
  sendingEnabled: boolean;
}

export async function fetchApprovalQueue(campaignId?: string): Promise<{ data: ApprovalQueueResponse | null; error?: string }> {
  const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
  const result = await engineFetch<ApprovalQueueResponse>(`/outbound/approvals${query}`, { method: 'GET' });
  if (result.data) return { data: result.data };
  return { data: null, error: result.error || 'Failed to fetch approval queue' };
}

export interface WaterfallConnectorRow {
  id: string;
  name: string;
  capabilities: string[];
  configured: boolean;
  maskedKey: string | null;
  label: string | null;
  verified: boolean;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
  /** True only when the engine reports a real test-connection probe for this connector. */
  testable?: boolean;
}

export async function fetchWaterfallConnectors(): Promise<{ data: { connectors: WaterfallConnectorRow[] } | null; error?: string }> {
  const result = await engineFetch<{ connectors: WaterfallConnectorRow[] }>('/waterfall/connectors', { method: 'GET' });
  if (result.data) return { data: result.data };
  return { data: null, error: result.error || 'Failed to fetch connectors' };
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
  jobIds: string[];
  expectedRevisions: Record<string, string | null>;
  campaignId?: string;
}): Promise<{ approvedCount: number; staleCount: number; sendingEnabled: boolean; error?: string }> {
  const result = await engineFetch<{ approvedCount: number; staleCount: number; sendingEnabled: boolean }>('/outbound/approvals/approve', {
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

/** Pins a held message to one mailbox from the campaign's pool (mailboxId null clears back to rotation). Recomputes the signed sender context; the message still needs deliberate approval afterward. */
export async function setApprovalSenderMailbox(jobId: string, mailboxId: string | null): Promise<{ updated: boolean; error?: string }> {
  const result = await engineFetch<{ updated: boolean }>(`/outbound/approvals/${jobId}/sender`, {
    method: 'POST',
    body: JSON.stringify({ mailboxId }),
  });
  if (result.data) return result.data;
  return { updated: false, error: result.error || 'Sender could not be updated' };
}


export interface WebsiteSignalsResult {
  status: 'OK' | 'DISABLED' | 'FETCH_FAILED';
  message?: string;
  fetchEnabled?: boolean;
  input: 'pasted_text' | 'fetched_url';
  truncated?: boolean;
  signals: {
    companyDomain: string;
    source: 'heuristic_keywords';
    techKeywords: string[];
    mentionsHiring: boolean;
    mentionsPricing: boolean;
    mentionsScaling: boolean;
    wordCount: number;
    summary: null;
    confidence: null;
  };
  icpHints: { category: string; matchedKeywords: string[] }[];
  relevanceReasons: string[];
}

export type WebsiteSignalsResponse = Partial<WebsiteSignalsResult> & Pick<WebsiteSignalsResult, 'status'>;

export async function analyzeWebsiteSignals(input: { domain: string; pageText: string } | { url: string }): Promise<{ data: WebsiteSignalsResult | null; error?: string; status?: number }> {
  const res = await engineFetch<WebsiteSignalsResult>('/research/website-signals', { method: 'POST', body: JSON.stringify(input) });
  return { data: res.data, error: res.error, status: res.status };
}

export async function saveWebsiteAnalysis(input: { domain: string; pageText: string; requestId?:string;projectId?:string }): Promise<{ data: { status: string; tableId: string; rowId: string } | null; error?: string; status?: number }> {
  const res = await engineFetch<{ status: string; tableId: string; rowId: string }>('/research/website-signals/save', { method: 'POST', body: JSON.stringify(input) });
  return { data: res.data, error: res.error, status: res.status };
}

export interface SavedResearchRow {
  rowId: string;
  values: Record<string, unknown>;
}

export async function fetchResearchLeads(projectId?:string): Promise<{ data: { items: SavedResearchRow[] } | null; error?: string }> {
  const res = await engineFetch<{ items: SavedResearchRow[] }>('/research/leads'+(projectId?'?projectId='+encodeURIComponent(projectId):''), { method: 'GET' });
  return { data: res.data, error: res.error };
}

export interface IntentFixtureAnalysis {
  fixture: true;
  caveat: string;
  company: string;
  signalType: 'hiring';
  jobCount: number;
  sampleTitles: string[];
  locations: string[];
  latestPostingDate: string | null;
  source: 'fixture_hiring_board_sample';
}

export async function analyzeIntentFixture(fixture: unknown): Promise<{ data: { status: string; input?: string; analysis?: IntentFixtureAnalysis; message?: string } | null; error?: string; status?: number }> {
  const res = await engineFetch<{ status: string; input?: string; analysis?: IntentFixtureAnalysis; message?: string }>('/research/intent-fixture', { method: 'POST', body: JSON.stringify({ fixture }) });
  return { data: res.data, error: res.error, status: res.status };
}

export async function saveIntentFixture(fixture: unknown,requestId?:string,projectId?:string): Promise<{ data: { status: string; tableId?: string; rowId?: string; message?: string } | null; error?: string; status?: number }> {
  const res = await engineFetch<{ status: string; tableId?: string; rowId?: string; message?: string }>('/research/intent-fixture/save', { method: 'POST', body: JSON.stringify({ fixture,...(requestId?{requestId}:{}),...(projectId?{projectId}:{}) }) });
  return { data: res.data, error: res.error, status: res.status };
}

export async function fetchIntentSignals(projectId?:string): Promise<{ data: { items: SavedResearchRow[] } | null; error?: string }> {
  const res = await engineFetch<{ items: SavedResearchRow[] }>('/research/intent-signals'+(projectId?'?projectId='+encodeURIComponent(projectId):''), { method: 'GET' });
  return { data: res.data, error: res.error };
}

export interface WorkspaceTableRows {
  offset?: number; limit?: number; nextOffset?: number | null;
  table: { id: string; name: string; rowCount: number };
  columns: { id: string; name: string; type: string }[];
  rows: { rowId: string; values: Record<string, unknown> }[];
}

export async function fetchWorkspaceTableRows(tableId: string, offset=0): Promise<{ data: WorkspaceTableRows | null; error?: string }> {
  const res = await engineFetch<WorkspaceTableRows>(`/workspace/tables/${tableId}/rows?offset=${offset}`, { method: 'GET' });
  return { data: res.data, error: res.error };
}

export interface CampaignRecipientRow {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  title?: string | null;
}

export interface RecipientImportInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  title?: string | null;
}

export const importCampaignRecipients = (campaignId: string, recipients: RecipientImportInput[]) =>
  engineFetch<{ upserted: number }>(`/campaigns/${campaignId}/recipients`, {
    method: 'POST',
    body: JSON.stringify({ recipients }),
  });

export const fetchCampaignRecipients = (campaignId: string) =>
  engineFetch<{ recipients: CampaignRecipientRow[] }>(`/campaigns/${campaignId}/recipients`, { method: 'GET' });

export interface CampaignPoolMailbox {
  id: string;
  email: string;
}

/** Current sender pool for one campaign. */
export async function fetchCampaignMailboxPool(campaignId: string): Promise<{ data: CampaignPoolMailbox[] | null; error?: string }> {
  const result = await engineFetch<{ pool: CampaignPoolMailbox[] }>(`/campaigns/${campaignId}/mailboxes`);
  if (result.data && !result.isMock) return { data: result.data.pool };
  return { data: null, error: result.error || 'Sender pool could not be loaded.' };
}

/** Replace the sender pool for one campaign. Empty pool blocks message approval server-side. */
export async function setCampaignMailboxPool(campaignId: string, mailboxIds: string[],expectedMailboxIds?:string[]): Promise<{ data: CampaignPoolMailbox[] | null; error?: string;invalidatedCount?:number;reservedCount?:number;unchanged?:boolean }> {
  const result = await engineFetch<{ pool: CampaignPoolMailbox[];invalidatedCount:number;reservedCount:number;unchanged:boolean }>(`/campaigns/${campaignId}/mailboxes`, {
    method: 'PUT',
    body: JSON.stringify({ mailboxIds,...(expectedMailboxIds?{expectedMailboxIds}:{}) }),
  });
  if (result.data && !result.isMock) return { data: result.data.pool,invalidatedCount:result.data.invalidatedCount,reservedCount:result.data.reservedCount,unchanged:result.data.unchanged };
  return { data: null, error: result.error || 'Sender pool could not be saved.' };
}

/** Lifecycle transition for one campaign. 409 answers carry the server's named reason. */
export async function setCampaignStatus(
  campaignId: string,
  status: 'draft' | 'active' | 'paused',
): Promise<{ data: { id: string; status: string } | null; error?: string }> {
  const result = await engineFetch<{ id: string; status: string }>(`/campaigns/${campaignId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  if (result.data && !result.isMock) return { data: result.data };
  return { data: null, error: result.error || 'Campaign status could not be changed.' };
}

export type WaterfallJobStatusState =
  | { state: 'ok'; jobId: string; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'needs_review'; totalQueued: number; completedCount: number; uncertainCount: number; attempts: number; error: string | null }
  | { state: 'unavailable'; message: string }
  | { state: 'not_found' }
  | { state: 'error'; message: string };

/**
 * D3: read the honest job status from the engine. The engine answers 503
 * {queued:false, message} while durable persistence is not mounted and 404
 * for a job outside the session workspace; both bodies must survive intact,
 * so engineFetch's generic 5xx mapping cannot be used here. Callers must
 * render needs_review explicitly and must never invent progress.
 */
export async function getWaterfallJobStatus(jobId: string): Promise<WaterfallJobStatusState> {
  try {
    const res = await fetch(`/api/engine/waterfall/jobs/${jobId}`, {
      method: 'GET',
      credentials: 'same-origin',
    });
    const body = (await res.json().catch(() => null)) as any;
    if (res.status === 503) {
      return { state: 'unavailable', message: body?.message || 'Job status is not available yet.' };
    }
    if (res.status === 404) return { state: 'not_found' };
    if (res.ok && body && typeof body.jobId === 'string') {
      return {
        state: 'ok',
        jobId: body.jobId,
        status: body.status,
        totalQueued: body.totalQueued ?? 0,
        completedCount: body.completedCount ?? 0,
        uncertainCount: body.uncertainCount ?? 0,
        attempts: body.attempts ?? 0,
        error: body.error ?? null,
      };
    }
    return { state: 'error', message: body?.error || `Engine responded with status ${res.status}` };
  } catch {
    return { state: 'error', message: 'Engine service temporarily unavailable.' };
  }
}
/**
 * Project Registry Services
 */
export async function fetchWorkspaceProjects(): Promise<{
  projects: ProjectResponse[];
  error?: string;
}> {
  const res = await engineFetch<ProjectResponse[]>('/projects', { method: 'GET' });
  if (res.data) return { projects: res.data };
  return { projects: [], error: res.error || 'Failed to fetch projects' };
}

export async function createWorkspaceProject(
  input: CreateProjectRequest
): Promise<{ project: ProjectResponse | null; error?: string; status?: number }> {
  const res = await engineFetch<ProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { project: res.data, error: res.error, status: res.status };
}

/**
 * Agent Token Services
 */
export async function fetchWorkspaceAgentTokens(): Promise<{
  tokens: AgentTokenListItem[];
  error?: string;
}> {
  const res = await engineFetch<AgentTokenListItem[]>('/agent-tokens', { method: 'GET' });
  if (res.data) return { tokens: res.data };
  return { tokens: [], error: res.error || 'Failed to fetch agent tokens' };
}

export async function issueWorkspaceAgentToken(
  input: IssueAgentTokenRequest
): Promise<{ data: AgentTokenResponse | null; error?: string; status?: number }> {
  const res = await engineFetch<AgentTokenResponse>('/agent-tokens', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { data: res.data, error: res.error, status: res.status };
}

export async function revokeWorkspaceAgentToken(
  tokenId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await engineFetch<{ id: string; revoked: boolean }>(`/agent-tokens/${tokenId}/revoke`, {
    method: 'POST',
  });
  if (res.data?.revoked) return { success: true };
  return { success: false, error: res.error || 'Failed to revoke agent token' };
}

export async function fetchSetupHealth(): Promise<{
  health: SetupHealthResponse | null;
  error?: string;
}> {
  try {
    const res = await fetch('/api/projects/setup-health', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { health: null, error: `Health check failed with status ${res.status}` };
    }
    const data = await res.json();
    return { health: data as SetupHealthResponse };
  } catch (err: unknown) {
    return { health: null, error: err instanceof Error ? err.message : 'Failed to query setup health' };
  }
}

export async function importCapturedLeads(
  experimentId: string,
  input: ImportCapturedLeadsRequest
): Promise<{ data: ImportCapturedLeadsResponse | null; error?: string }> {
  const res = await engineFetch<ImportCapturedLeadsResponse>(
    `/validator/experiments/${experimentId}/import-leads`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  if (res.data) return { data: res.data };
  return { data: null, error: res.error || 'Failed to import captured leads' };
}

export interface RunItem {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  startedAt: string;
  createdAt?: string;
  error?: string;
}

export async function fetchRunsList(): Promise<{ data: { runs: RunItem[] } | null; error?: string }> {
  try {
    const res = await fetch('/api/runs');
    if (!res.ok) return { data: null, error: `Failed to fetch runs: ${res.status}` };
    const json = await res.json();
    const rows = (json?.rows ?? []) as Array<{ id: string; label?: string; kind?: string; status: string; error?: string | null; finishedAt?: string }>;
    return {
      data: {
        runs: rows.map((r) => ({
          id: r.id,
          name: r.label || r.kind || r.id,
          status: r.status === 'succeeded' ? 'completed' : r.status === 'failed' ? 'failed' : 'pending',
          startedAt: r.finishedAt || new Date().toISOString(),
          createdAt: r.finishedAt,
          error: r.error ?? undefined,
        })),
      },
    };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}



export async function fetchSavedTableSchema(tableId:string){return engineFetch<import('@leadloom/contracts').SavedTableSchema>('/workspace/tables/'+encodeURIComponent(tableId)+'/schema');}
