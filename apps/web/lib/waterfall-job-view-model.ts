import type { WaterfallJobStatusState } from './engine-client';

/**
 * D3: what the grid may say about a running job, derived ONLY from the
 * engine's status payload. No invented progress; terminal states stop
 * polling; needs_review is surfaced, never smoothed over.
 */
export type WaterfallJobView =
  | { kind: 'polling'; label: string }
  | { kind: 'done'; label: string; tone: 'ok' | 'failed' | 'review' }
  | { kind: 'unavailable'; label: string }
  | { kind: 'gone'; label: string }
  | { kind: 'error'; label: string };

export function waterfallJobView(state: WaterfallJobStatusState): WaterfallJobView {
  switch (state.state) {
    case 'ok': {
      const progress = `${state.completedCount}/${state.totalQueued} rows`;
      if (state.status === 'queued' || state.status === 'running') {
        return { kind: 'polling', label: `Waterfall running: ${progress} complete` };
      }
      if (state.status === 'succeeded') return { kind: 'done', tone: 'ok', label: `Waterfall complete: ${progress}` };
      if (state.status === 'needs_review') {
        return {
          kind: 'done', tone: 'review',
          label: `Needs review: ${state.uncertainCount} row(s) have an uncertain provider outcome and were not retried (${progress} complete)`,
        };
      }
      if (state.status === 'cancelled') return { kind: 'done', tone: 'failed', label: `Waterfall cancelled (${progress} complete)` };
      return { kind: 'done', tone: 'failed', label: `Waterfall failed: ${state.error ?? 'unknown engine error'} (${progress} complete)` };
    }
    case 'unavailable':
      return { kind: 'unavailable', label: state.message };
    case 'not_found':
      return { kind: 'gone', label: 'This job is no longer available.' };
    case 'error':
      return { kind: 'error', label: state.message };
  }
}

/**
 * D3: a dispatched job belongs to the selection that existed at dispatch
 * time. When the live selection has moved on, the status line must SAY the
 * job belongs to the earlier selection rather than silently sitting under
 * the new one. Returns the qualifier to render, or null when the job still
 * belongs to the current selection (or there is no job).
 */
export function jobContextLabel(
  job: { selectionKey: string; rowCount: number } | null,
  currentSelectionKey: string
): string | null {
  if (!job) return null;
  if (job.selectionKey === currentSelectionKey) return null;
  return `Job from a previous selection (${job.rowCount} row${job.rowCount === 1 ? '' : 's'})`;
}

/** Polling continues only while the engine reports live work. */
export function shouldPollJob(view: WaterfallJobView): boolean {
  return view.kind === 'polling';
}

/**
 * The tone class the shared status line renders for a view. Lives in the
 * view-model (not the component) so the exact mapping the wired UI renders
 * is unit-testable without a DOM harness.
 */
export function waterfallJobToneClass(view: WaterfallJobView): string {
  if (view.kind === 'done') {
    if (view.tone === 'ok') return 'text-signal-verified';
    if (view.tone === 'review') return 'text-signal-warning';
    return 'text-signal-failed';
  }
  if (view.kind === 'gone' || view.kind === 'error' || view.kind === 'unavailable') {
    return 'text-signal-failed';
  }
  return 'text-text-muted';
}
