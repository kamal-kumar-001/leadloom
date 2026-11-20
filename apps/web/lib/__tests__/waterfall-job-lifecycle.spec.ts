import { describe, it, expect } from 'vitest';
import { createJobLifecycle, type BoundJob } from '../waterfall-job-lifecycle';
import type { WaterfallJobStatusState, WorkspaceTableRows } from '../engine-client';
import type { CellRefreshResult } from '../waterfall-cell-refresh';
import type { WaterfallJobView } from '../waterfall-job-view-model';
import type { WaterfallCellPayload } from '@leadloom/contracts';

/**
 * D3 dispatch -> poll -> terminal -> refresh coordination, with INJECTED
 * clients only (no engine, no DOM). Covers the races pure merge tests cannot:
 * late responses after table close/reopen, and a new job before an old
 * refresh returns.
 */

const PAYLOAD: WaterfallCellPayload = {
  value: 'ada@northstar.example',
  status: 'success',
  trace: [{ step: 1, provider: 'apollo', status: 'hit', latency_ms: 210, cost_microcents: 100, reason: 'Match found' }],
  telemetry: { provider_attributed: 'apollo', tier: 1, latency_ms: 210, cost_microcents: 100 },
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function rowsWith(cellValue: unknown): WorkspaceTableRows {
  return {
    table: { id: 'table-1', name: 'Leads', rowCount: 1 },
    columns: [{ id: 'col-1', name: 'Work Email', type: 'waterfall' }],
    rows: [{ rowId: 'row-a', values: { 'Work Email': cellValue } }],
  };
}

const running: WaterfallJobStatusState = {
  state: 'ok', jobId: 'j', status: 'running', totalQueued: 1, completedCount: 0, uncertainCount: 0, attempts: 0, error: null,
};
const succeeded = (jobId: string): WaterfallJobStatusState => ({
  state: 'ok', jobId, status: 'succeeded', totalQueued: 1, completedCount: 1, uncertainCount: 0, attempts: 1, error: null,
});

interface Harness {
  lifecycle: ReturnType<typeof createJobLifecycle>;
  views: Array<WaterfallJobView | null>;
  applies: Array<{ tableId: string; columnName: string; result: CellRefreshResult }>;
  notes: string[];
  statusCalls: number;
  rowFetches: Array<ReturnType<typeof deferred<{ data: WorkspaceTableRows }>>>;
  fireTick: () => void;
  setSnapshot: (s: { tableId: string | null; loadedAt: number }) => void;
  setNow: (t: number) => void;
}

function harness(statuses: WaterfallJobStatusState[]): Harness {
  const timers: Array<() => void> = [];
  const views: Harness['views'] = [];
  const applies: Harness['applies'] = [];
  const notes: string[] = [];
  const rowFetches: Harness['rowFetches'] = [];
  let snapshot = { tableId: 'table-1' as string | null, loadedAt: 100 };
  let now = 100;
  let statusCalls = 0;
  const lifecycle = createJobLifecycle({
    fetchStatus: () => {
      const s = statuses[Math.min(statusCalls, statuses.length - 1)];
      statusCalls += 1;
      return Promise.resolve(s);
    },
    fetchRows: () => {
      const d = deferred<{ data: WorkspaceTableRows }>();
      rowFetches.push(d);
      return d.promise;
    },
    getSnapshot: () => snapshot,
    onView: (v) => views.push(v),
    onApply: (tableId, columnName, result) => applies.push({ tableId, columnName, result }),
    onNote: (m) => notes.push(m),
    now: () => now,
    intervalMs: 10,
    setTimeoutFn: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeoutFn: () => {},
  });
  return {
    lifecycle, views, applies, notes, rowFetches,
    get statusCalls() { return statusCalls; },
    fireTick: () => timers.shift()?.(),
    setSnapshot: (s) => { snapshot = s; },
    setNow: (t) => { now = t; },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('job lifecycle coordination', () => {
  it('happy path: polls, terminates, refreshes the bound cells once', async () => {
    const h = harness([running, succeeded('j1')]);
    const job: BoundJob = { jobId: 'j1', rowIds: ['row-a'], tableId: 'table-1', columnName: 'Work Email' };
    h.lifecycle.startJob(job);
    await flush(); // first tick: running
    expect(h.views).toEqual([null, { kind: 'polling', label: 'Waterfall running: 0/1 rows complete' }]);
    h.fireTick();
    await flush(); // second tick: terminal -> refresh issued
    expect(h.views.at(-1)).toMatchObject({ kind: 'done', tone: 'ok' });
    expect(h.rowFetches).toHaveLength(1);
    h.rowFetches[0].resolve({ data: rowsWith(PAYLOAD) });
    await flush();
    expect(h.applies).toHaveLength(1);
    expect(h.applies[0].result).toMatchObject({ kind: 'refreshed', cells: [{ rowId: 'row-a', payload: PAYLOAD }] });
    expect(h.notes).toEqual([]);
  });

  it('a new job before the old refresh returns: the stale refresh never applies', async () => {
    const h = harness([succeeded('j1')]);
    h.lifecycle.startJob({ jobId: 'j1', rowIds: ['row-a'], tableId: 'table-1', columnName: 'Work Email' });
    await flush(); // terminal immediately -> R1 pending
    expect(h.rowFetches).toHaveLength(1);

    // New dispatch on the same table before R1 resolves.
    h.lifecycle.startJob({ jobId: 'j2', rowIds: ['row-a'], tableId: 'table-1', columnName: 'Work Email' });
    await flush(); // j2 terminal immediately (same fixture) -> R2 pending
    expect(h.rowFetches).toHaveLength(2);

    // R2 resolves first and applies.
    const newer: WaterfallCellPayload = { ...PAYLOAD, value: 'grace@acme.example' };
    h.rowFetches[1].resolve({ data: rowsWith(newer) });
    await flush();
    expect(h.applies).toHaveLength(1);
    expect(h.applies[0].result).toMatchObject({ kind: 'refreshed', cells: [{ rowId: 'row-a', payload: newer }] });

    // R1 resolves late: dropped by the generation guard, never overwrites R2.
    h.rowFetches[0].resolve({ data: rowsWith(PAYLOAD) });
    await flush();
    expect(h.applies).toHaveLength(1);
  });

  it('a refresh read started before a close/reopen is dropped: the reopened snapshot is newer', async () => {
    const h = harness([succeeded('j1')]);
    h.lifecycle.startJob({ jobId: 'j1', rowIds: ['row-a'], tableId: 'table-1', columnName: 'Work Email' });
    await flush(); // R1 pending, read started at now=100
    expect(h.rowFetches).toHaveLength(1);

    // User closes the table, then reopens it later: the reopen fetches a
    // fresh snapshot at t=200, newer than R1's read at t=100.
    h.setSnapshot({ tableId: null, loadedAt: 150 });
    h.setSnapshot({ tableId: 'table-1', loadedAt: 200 });
    h.rowFetches[0].resolve({ data: rowsWith(PAYLOAD) });
    await flush();
    expect(h.applies).toHaveLength(0);
    expect(h.notes).toEqual([]);
  });

  it('a refresh resolving after the table was closed applies nothing', async () => {
    const h = harness([succeeded('j1')]);
    h.lifecycle.startJob({ jobId: 'j1', rowIds: ['row-a'], tableId: 'table-1', columnName: 'Work Email' });
    await flush();
    h.setSnapshot({ tableId: null, loadedAt: 150 }); // closed
    h.rowFetches[0].resolve({ data: rowsWith(PAYLOAD) });
    await flush();
    expect(h.applies).toHaveLength(0);
  });

  it('stop() silences late views and late refreshes', async () => {
    const h = harness([succeeded('j1')]);
    h.lifecycle.startJob({ jobId: 'j1', rowIds: ['row-a'], tableId: 'table-1', columnName: 'Work Email' });
    await flush(); // terminal view emitted, R1 pending
    const viewsBefore = h.views.length;
    h.lifecycle.stop();
    h.rowFetches[0].resolve({ data: rowsWith(PAYLOAD) });
    h.fireTick(); // would be a late tick if the poller had not stopped
    await flush();
    expect(h.views.length).toBe(viewsBefore);
    expect(h.applies).toHaveLength(0);
    expect(h.notes).toEqual([]);
  });

  it('a job refreshes once even if a terminal view were somehow emitted twice', async () => {
    const h = harness([succeeded('j1')]);
    h.lifecycle.startJob({ jobId: 'j1', rowIds: ['row-a'], tableId: 'table-1', columnName: 'Work Email' });
    await flush();
    h.rowFetches[0].resolve({ data: rowsWith(PAYLOAD) });
    await flush();
    expect(h.rowFetches).toHaveLength(1);
    expect(h.applies).toHaveLength(1);
  });
});
