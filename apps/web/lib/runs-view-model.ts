import { readFileSync } from 'node:fs';
import {
  parseRegistry,
  registryPathFor,
  summarize,
  type RunRecord,
} from '@leadloom/engine/src/modules/run-registry';

/**
 * Server-side view model for the Run Status slice: reads the LOCAL run
 * registry JSON written by the engine modules. No DB, no network.
 * Missing file = an honest "no runs yet" state; corrupt file = an honest
 * error state. Neither is ever rendered as fake data.
 * Mock-connector runs are flagged as SAMPLE DATA at page level and per row;
 * usage that was never measured is "unknown", never rendered as zero.
 */

export interface RunRowView {
  id: string;
  kind: RunRecord['kind'];
  status: RunRecord['status'];
  label: string;
  finishedAt: string;
  tokensUsed: number | null;
  provenance: 'mock-connector' | 'live-connector' | null;
  artifactCount: number;
  error: string | null;
}

export interface RunsViewData {
  state: 'ok' | 'empty' | 'corrupt';
  rows: RunRowView[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    refused: number;
    tokensKnown: number;
    usageUnknown: number;
  };
  /** True when any row came through the mock connector - page shows a SAMPLE DATA banner. */
  hasSampleData: boolean;
  registryPath: string;
  errorDetail: string | null;
}

export function emptyRunsView(registryPath: string): RunsViewData {
  return {
    state: 'empty', rows: [], registryPath, errorDetail: null, hasSampleData: false,
    summary: { total: 0, succeeded: 0, failed: 0, refused: 0, tokensKnown: 0, usageUnknown: 0 },
  };
}

export function runsRegistryPathForUser(email: string): string {
  const base = process.env.LEADLOOM_RUNS_DIR || '/tmp/leadloom-runs';
  return registryPathFor(base, email);
}

export function buildRunsView(email: string): RunsViewData {
  const registryPath = runsRegistryPathForUser(email);
  let raw: string;
  try {
    raw = readFileSync(registryPath, 'utf8');
  } catch (e: any) {
    if (e?.code === 'ENOENT') return emptyRunsView(registryPath);
    throw e;
  }
  try {
    const data = parseRegistry(raw);
    const s = summarize(data);
    const rows = [...data.runs]
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
      .map((r) => ({
        id: r.id, kind: r.kind, status: r.status, label: r.label,
        finishedAt: r.finishedAt, tokensUsed: r.tokensUsed,
        provenance: r.provenance ?? null,
        artifactCount: r.artifacts.length, error: r.error ?? null,
      }));
    return {
      state: 'ok', rows, registryPath, errorDetail: null,
      hasSampleData: rows.some((r) => r.provenance === 'mock-connector'),
      summary: {
        total: s.total, succeeded: s.byStatus.SUCCESS, failed: s.byStatus.FAILED,
        refused: s.byStatus.REFUSED, tokensKnown: s.tokensKnown, usageUnknown: s.usageUnknown,
      },
    };
  } catch (e) {
    return {
      ...emptyRunsView(registryPath),
      state: 'corrupt',
      errorDetail: (e as Error).message,
    };
  }
}
