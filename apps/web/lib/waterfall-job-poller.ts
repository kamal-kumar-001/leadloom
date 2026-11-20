import type { WaterfallJobStatusState } from './engine-client';
import { waterfallJobView, shouldPollJob, type WaterfallJobView } from './waterfall-job-view-model';

/**
 * D3: testable polling engine for a REAL waterfall job id.
 *
 * Boundaries it keeps:
 * - polls only the job id it was started with; never invents one;
 * - every emitted view is derived from the engine's own status payload via
 *   waterfallJobView;
 * - stops emitting and scheduling on any terminal/non-live state, on a fetch
 *   throw (surfaced as an error view, never retried into a spin), and on
 *   stop() - including suppressing a response that resolves after stop();
 * - a response from an earlier generation never overwrites a newer tick.
 *
 * Timer and fetch are injected so the behavior is testable with local
 * fixtures; no engine, D2 flag, or provider contact is needed for the tests.
 */
export interface JobPollerOptions {
  fetchStatus: (jobId: string) => Promise<WaterfallJobStatusState>;
  onView: (view: WaterfallJobView) => void;
  intervalMs?: number;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

export interface JobPoller {
  stop(): void;
}

export function startJobPolling(jobId: string, options: JobPollerOptions): JobPoller {
  const intervalMs = options.intervalMs ?? 3000;
  const setT = options.setTimeoutFn ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearT =
    options.clearTimeoutFn ?? ((handle: unknown) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]));
  let stopped = false;
  let generation = 0;
  let timer: unknown = null;

  const tick = async () => {
    const gen = ++generation;
    let view: WaterfallJobView;
    try {
      view = waterfallJobView(await options.fetchStatus(jobId));
    } catch {
      // getWaterfallJobStatus already folds transport failures into an 'error'
      // state; a throw reaching here is a defect, and the honest response is a
      // single error view, not a retry storm.
      view = { kind: 'error', label: 'Job status check failed unexpectedly.' };
    }
    if (stopped || gen !== generation) return;
    options.onView(view);
    if (shouldPollJob(view)) timer = setT(tick, intervalMs);
  };

  void tick();

  return {
    stop() {
      stopped = true;
      generation++;
      if (timer !== null) {
        clearT(timer);
        timer = null;
      }
    },
  };
}
