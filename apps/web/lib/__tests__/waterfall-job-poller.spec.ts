import { describe, it, expect } from 'vitest';
import { startJobPolling } from '../waterfall-job-poller';
import { jobContextLabel, type WaterfallJobView } from '../waterfall-job-view-model';
import type { WaterfallJobStatusState } from '../engine-client';

/**
 * D3 polling behavior, tested with LOCAL FIXTURES ONLY: the status client is
 * a mocked function and the timer is manual. No D2 flag, no engine, no
 * provider contact. These tests prove loop behavior (start, continue, stop,
 * cleanup, stale suppression), not engine integration.
 */

type OkState = Extract<WaterfallJobStatusState, { state: 'ok' }>;

const running = (completedCount: number): OkState => ({
  state: 'ok',
  jobId: 'job-1',
  status: 'running',
  totalQueued: 4,
  completedCount,
  uncertainCount: 0,
  attempts: 1,
  error: null,
});

function manualTimer() {
  const pending: Array<{ handle: object; fn: () => void; ms: number }> = [];
  return {
    setTimeoutFn: (fn: () => void, ms: number) => {
      const handle = {};
      pending.push({ handle, fn, ms });
      return handle;
    },
    clearTimeoutFn: (handle: unknown) => {
      const i = pending.findIndex((p) => p.handle === handle);
      if (i >= 0) pending.splice(i, 1);
    },
    runNext: () => {
      const next = pending.shift();
      next?.fn();
    },
    pendingCount: () => pending.length,
    intervals: () => pending.map((p) => p.ms),
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('startJobPolling (mocked client + manual timer)', () => {
  it('polls immediately, continues while live, and stops at succeeded', async () => {
    const timer = manualTimer();
    const responses = [running(1), running(2), { ...running(4), status: 'succeeded' as const }];
    const views: WaterfallJobView[] = [];
    startJobPolling('job-1', {
      fetchStatus: async () => responses.shift() ?? { ...running(4), status: 'succeeded' as const },
      onView: (v) => views.push(v),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    await tick();
    expect(views.map((v) => v.kind)).toEqual(['polling']);
    expect(views[0]).toMatchObject({ label: 'Waterfall running: 1/4 rows complete' });
    expect(timer.pendingCount()).toBe(1);
    expect(timer.intervals()).toEqual([3000]);

    timer.runNext();
    await tick();
    expect(views.map((v) => v.kind)).toEqual(['polling', 'polling']);

    timer.runNext();
    await tick();
    expect(views.map((v) => v.kind)).toEqual(['polling', 'polling', 'done']);
    expect(views[2]).toMatchObject({ tone: 'ok' });
    expect(timer.pendingCount()).toBe(0); // terminal: nothing scheduled
  });

  it('stops on needs_review and surfaces it as a review tone, never retried', async () => {
    const timer = manualTimer();
    const views: WaterfallJobView[] = [];
    startJobPolling('job-1', {
      fetchStatus: async () => ({ ...running(3), status: 'needs_review' as const, uncertainCount: 1 }),
      onView: (v) => views.push(v),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    await tick();
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ kind: 'done', tone: 'review' });
    expect(views[0].kind === 'done' && views[0].label).toContain('not retried');
    expect(timer.pendingCount()).toBe(0);
  });

  const nonLiveStates: Array<[string, WaterfallJobStatusState]> = [
    ['unavailable', { state: 'unavailable', message: 'Job status is not available yet.' }],
    ['not_found', { state: 'not_found' }],
    ['error', { state: 'error', message: 'status route exploded' }],
  ];
  it.each(nonLiveStates)('stops on non-live %s state', async (_name, state) => {
    const timer = manualTimer();
    const views: WaterfallJobView[] = [];
    startJobPolling('job-1', {
      fetchStatus: async () => state,
      onView: (v) => views.push(v),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    await tick();
    expect(views).toHaveLength(1);
    expect(views[0].kind).not.toBe('polling');
    expect(timer.pendingCount()).toBe(0);
  });

  it('turns a fetch throw into a single error view and stops (no retry storm)', async () => {
    const timer = manualTimer();
    const views: WaterfallJobView[] = [];
    let calls = 0;
    startJobPolling('job-1', {
      fetchStatus: async () => {
        calls++;
        throw new Error('defect');
      },
      onView: (v) => views.push(v),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    await tick();
    expect(calls).toBe(1);
    expect(views).toEqual([{ kind: 'error', label: 'Job status check failed unexpectedly.' }]);
    expect(timer.pendingCount()).toBe(0);
  });

  it('cleanup: stop() while a fetch is in flight suppresses its late response', async () => {
    const timer = manualTimer();
    const views: WaterfallJobView[] = [];
    let release!: (s: WaterfallJobStatusState) => void;
    const poller = startJobPolling('job-1', {
      fetchStatus: () => new Promise((res) => (release = res)),
      onView: (v) => views.push(v),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    poller.stop();
    release(running(1));
    await tick();
    expect(views).toHaveLength(0);
    expect(timer.pendingCount()).toBe(0);
  });

  it('cleanup: stop() after a live view cancels the scheduled tick', async () => {
    const timer = manualTimer();
    const views: WaterfallJobView[] = [];
    const poller = startJobPolling('job-1', {
      fetchStatus: async () => running(1),
      onView: (v) => views.push(v),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    await tick();
    expect(views).toHaveLength(1);
    expect(timer.pendingCount()).toBe(1);
    poller.stop();
    expect(timer.pendingCount()).toBe(0);
  });

  it('selection change: a stopped old-job poller never overwrites the new job\'s view', async () => {
    // Mirrors the component: job-1's poller is disposed when the user changes
    // selection and job-2 starts; job-1's in-flight response must not clobber.
    const timer = manualTimer();
    const views: Array<{ source: string; view: WaterfallJobView }> = [];
    let releaseOld!: (s: WaterfallJobStatusState) => void;
    const oldPoller = startJobPolling('job-1', {
      fetchStatus: () => new Promise((res) => (releaseOld = res)),
      onView: (v) => views.push({ source: 'job-1', view: v }),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    const newPoller = startJobPolling('job-2', {
      fetchStatus: async () => running(2),
      onView: (v) => views.push({ source: 'job-2', view: v }),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    oldPoller.stop();
    releaseOld({ ...running(4), status: 'succeeded' as const });
    await tick();
    expect(views).toHaveLength(1);
    expect(views[0].source).toBe('job-2');
    newPoller.stop();
  });
});

describe('jobContextLabel (selection binding)', () => {
  const job = { selectionKey: 'row-a,row-b,row-c', rowCount: 3 };
  it('is null while the job still belongs to the current selection', () => {
    expect(jobContextLabel(job, 'row-a,row-b,row-c')).toBeNull();
  });
  it('is null when there is no job', () => {
    expect(jobContextLabel(null, 'anything')).toBeNull();
  });
  it('qualifies the job when the live selection moved on', () => {
    expect(jobContextLabel(job, 'row-d')).toBe('Job from a previous selection (3 rows)');
  });
  it('uses the singular for one row', () => {
    expect(jobContextLabel({ selectionKey: 'row-a', rowCount: 1 }, 'row-b')).toBe(
      'Job from a previous selection (1 row)'
    );
  }
  );
});
