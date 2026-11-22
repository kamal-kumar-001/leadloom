/**
 * Run registry: one local JSON index of every pipeline step Leadloom has run
 * (signal ingests, research reports, landing renders, agent runs). Feeds the
 * unified status view. Local artifact only - no DB, no network.
 * Append-only by design: a run record is never mutated after completion,
 * so the status view can never silently rewrite history.
 */

export type RunKind = 'signal-ingest' | 'idea-research' | 'idea-qa' | 'landing-render' | 'agent-run';
export type RunStatus = 'SUCCESS' | 'FAILED' | 'REFUSED';

export interface RunRecord {
  id: string;
  kind: RunKind;
  status: RunStatus;
  startedAt: string; // ISO
  finishedAt: string; // ISO
  /** Human-readable one-liner, e.g. the intake idea or connector id. */
  label: string;
  /** Local artifact paths produced (relative or absolute), never URLs to published things. */
  artifacts: string[];
  /** null = usage unknown. Never rendered as 0: unknown is unknown. */
  tokensUsed: number | null;
  /** 'mock-connector' = simulated dev run, no real agent executed; 'live-connector' = a real local CLI ran. Absent = local step with no agent. */
  provenance?: 'mock-connector' | 'live-connector';
  error?: string;
}

/**
 * Best-effort secret redaction for free-text fields before they are persisted.
 * Labels are short excerpts of PRIVATE user ideas; the length cap alone does
 * not stop a user pasting a key into an idea, so common credential shapes are
 * redacted on top of the cap. Not a guarantee - the registry is a local,
 * owner-readable file, never an export surface.
 */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,            // OpenAI-style keys
  /\bAIza[0-9A-Za-z_-]{20,}/g,           // Google API keys
  /\bghp_[A-Za-z0-9]{20,}/g,             // GitHub PATs
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,     // GitHub fine-grained PATs
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,     // Slack tokens
  /\bAKIA[0-9A-Z]{16}\b/g,               // AWS access key ids
  /\bBearer\s+[A-Za-z0-9._~-]{16,}/gi,   // bearer tokens
  /\b[0-9a-f]{40,}\b/gi,                 // long hex secrets
];

export function redactSensitive(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[redacted]');
  return out;
}

export interface RunRegistryData {
  version: 1;
  runs: RunRecord[];
}

export function emptyRegistry(): RunRegistryData {
  return { version: 1, runs: [] };
}

export function parseRegistry(raw: string): RunRegistryData {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('registry file is not valid JSON');
  }
  if (data?.version !== 1 || !Array.isArray(data.runs)) throw new Error('unsupported registry shape');
  for (const r of data.runs) {
    if (typeof r?.id !== 'string' || typeof r?.kind !== 'string' || typeof r?.status !== 'string') {
      throw new Error('corrupt run record in registry');
    }
  }
  return data as RunRegistryData;
}

export function makeRunId(kind: RunKind, startedAt: string, seq: number): string {
  return `${kind}-${startedAt.replace(/[:.]/g, '-')}-${seq}`;
}

export function summarize(data: RunRegistryData): { total: number; byStatus: Record<RunStatus, number>; tokensKnown: number; usageUnknown: number } {
  const byStatus: Record<RunStatus, number> = { SUCCESS: 0, FAILED: 0, REFUSED: 0 };
  let tokensKnown = 0;
  let usageUnknown = 0;
  for (const r of data.runs) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.tokensUsed === null || r.tokensUsed === undefined) usageUnknown++;
    else tokensKnown += r.tokensUsed;
  }
  return { total: data.runs.length, byStatus, tokensKnown, usageUnknown };
}
