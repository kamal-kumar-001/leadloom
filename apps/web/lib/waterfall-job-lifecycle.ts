import type { WaterfallJobStatusState, WorkspaceTableRows } from './engine-client';
import { startJobPolling, type JobPoller } from './waterfall-job-poller';
import { refreshBoundCells, type CellRefreshResult } from './waterfall-cell-refresh';
import type { WaterfallJobView } from './waterfall-job-view-model';

/**
 * D3 coordination for a REAL waterfall job dispatched from a persisted table:
 * poll the job, and on a terminal state refresh exactly the bound cells into
 * the currently open snapshot.
 *
 * Race boundaries this coordinator keeps (all unit-tested with injected
 * clients, no engine needed):
 * - a new job supersedes the followed one: the old poller stops, the old
 *   job's late status responses never emit, and its pending refresh is
 *   dropped if a newer refresh for the same table has been issued;
 * - a refresh applies ONLY while its table is still the open snapshot AND
 *   the snapshot was loaded no later than the refresh's read started
 *   (close/reopen loads a newer snapshot; a pre-reopen refresh read would be
 *   older than what the reopen already fetched, so it is dropped);
 * - one refresh per job, ever;
 * - stop() silences everything: late views, late refreshes, late notes.
 *
 * Applying cells to state stays with the caller (onApply); this module never
 * mutates anything itself.
 */
export interface BoundJob {
  jobId: string;
  rowIds: string[];
  tableId: string;
  columnName: string;
}

export interface JobLifecycleDeps {
  fetchStatus: (jobId: string) => Promise<WaterfallJobStatusState>;
  fetchRows: (tableId: string) => Promise<{ data: WorkspaceTableRows | null; error?: string }>;
  /** The currently open table snapshot: the apply guard's source of truth. */
  getSnapshot: () => { tableId: string | null; loadedAt: number };
  onView: (view: WaterfallJobView | null) => void;
  /** Fires only when the refresh still applies to the current snapshot. */
  onApply: (tableId: string, columnName: string, result: CellRefreshResult) => void;
  onNote?: (message: string) => void;
  now?: () => number;
  intervalMs?: number;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

export interface JobLifecycle {
  startJob: (job: BoundJob) => void;
  stop: () => void;
}

export function createJobLifecycle(deps: JobLifecycleDeps): JobLifecycle {
  const now = deps.now ?? (() => Date.now());
  let stopped = false;
  let poller: JobPoller | null = null;
  let currentJobId: string | null = null;
  const refreshedJobs = new Set<string>();
  const refreshGeneration = new Map<string, number>();

  function refreshOnce(job: BoundJob) {
    if (refreshedJobs.has(job.jobId)) return;
    refreshedJobs.add(job.jobId);
    const gen = (refreshGeneration.get(job.tableId) ?? 0) + 1;
    refreshGeneration.set(job.tableId, gen);
    const fetchStartedAt = now();
    void refreshBoundCells(
      { tableId: job.tableId, rowIds: job.rowIds, columnName: job.columnName },
      deps.fetchRows
    ).then((result) => {
      if (stopped) return;
      // A newer refresh for this table superseded this one.
      if (refreshGeneration.get(job.tableId) !== gen) return;
      const snapshot = deps.getSnapshot();
      // The user closed the table, opened another, or re-opened this one
      // after the refresh's read started (a newer snapshot already exists).
      if (snapshot.tableId !== job.tableId || snapshot.loadedAt > fetchStartedAt) return;
      deps.onApply(job.tableId, job.columnName, result);
      if (result.kind === 'failed') {
        deps.onNote?.(`Cells not refreshed: ${result.message}`);
      } else if (result.missingRowIds.length > 0) {
        deps.onNote?.(
          `Refreshed ${result.cells.length} cell(s); ${result.missingRowIds.length} bound row(s) have no fresh result stored.`
        );
      }
    });
  }

  return {
    startJob(job) {
      // A new dispatch supersedes the followed job; the old job keeps running
      // on the engine, but this surface follows the newest one only.
      poller?.stop();
      currentJobId = job.jobId;
      deps.onView(null);
      poller = startJobPolling(job.jobId, {
        fetchStatus: deps.fetchStatus,
        intervalMs: deps.intervalMs,
        setTimeoutFn: deps.setTimeoutFn,
        clearTimeoutFn: deps.clearTimeoutFn,
        onView: (view) => {
          if (stopped || currentJobId !== job.jobId) return;
          deps.onView(view);
          if (view.kind === 'done') refreshOnce(job);
        },
      });
    },
    stop() {
      stopped = true;
      poller?.stop();
    },
  };
}
