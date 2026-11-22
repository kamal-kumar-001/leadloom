import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRunsView, runsRegistryPathForUser } from '../runs-view-model';

describe('runs-view-model', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'leadloom-runs-vm-')); process.env.LEADLOOM_RUNS_DIR = dir; });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); delete process.env.LEADLOOM_RUNS_DIR; });

  it('maps the owner email to a per-user registry path', () => {
    expect(runsRegistryPathForUser('kamal@example.com')).toMatch(/run-registry-kamal-example-com-[0-9a-f]{12}\.json$/);
  });

  it('returns an honest empty state when no registry exists', () => {
    const view = buildRunsView('kamal@example.com');
    expect(view.state).toBe('empty');
    expect(view.rows).toEqual([]);
    expect(view.summary.total).toBe(0);
  });

  it('returns rows newest-first with a correct summary', () => {
    writeFileSync(runsRegistryPathForUser('kamal@example.com'), JSON.stringify({
      version: 1,
      runs: [
        { id: 'a', kind: 'idea-research', status: 'SUCCESS', startedAt: '2026-11-19T18:00:00Z', finishedAt: '2026-11-19T18:00:10Z', label: 'older', artifacts: ['/x.json'], tokensUsed: 100, provenance: 'mock-connector' },
        { id: 'b', kind: 'agent-run', status: 'REFUSED', startedAt: '2026-11-19T18:05:00Z', finishedAt: '2026-11-19T18:05:01Z', label: 'newer', artifacts: [], tokensUsed: null, provenance: 'live-connector' },
      ],
    }));
    const view = buildRunsView('kamal@example.com');
    expect(view.state).toBe('ok');
    expect(view.rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(view.summary).toEqual({ total: 2, succeeded: 1, failed: 0, refused: 1, tokensKnown: 100, usageUnknown: 1 });
    expect(view.rows[0].tokensUsed).toBeNull();
    expect(view.rows[1].artifactCount).toBe(1);
    expect(view.hasSampleData).toBe(true); // one row came through the mock connector
    expect(view.rows[0].provenance).toBe('live-connector');
    expect(view.rows[1].provenance).toBe('mock-connector');
  });

  it('reports no sample data when every row is live or local', () => {
    writeFileSync(runsRegistryPathForUser('kamal@example.com'), JSON.stringify({
      version: 1,
      runs: [
        { id: 'a', kind: 'landing-render', status: 'SUCCESS', startedAt: '2026-11-19T18:00:00Z', finishedAt: '2026-11-19T18:00:10Z', label: 'render', artifacts: [], tokensUsed: null },
      ],
    }));
    const view = buildRunsView('kamal@example.com');
    expect(view.hasSampleData).toBe(false);
    expect(view.rows[0].provenance).toBeNull();
    expect(view.summary.usageUnknown).toBe(1);
    expect(view.summary.tokensKnown).toBe(0);
  });

  it('surfaces a corrupt registry as an error state, never as fake data', () => {
    writeFileSync(runsRegistryPathForUser('kamal@example.com'), '{"version":1,"runs":"oops"}');
    const view = buildRunsView('kamal@example.com');
    expect(view.state).toBe('corrupt');
    expect(view.errorDetail).toContain('unsupported registry shape');
  });
});
