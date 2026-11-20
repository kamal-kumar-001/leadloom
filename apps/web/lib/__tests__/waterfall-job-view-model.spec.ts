import { describe, it, expect } from 'vitest';
import { waterfallJobView, shouldPollJob, waterfallJobToneClass } from '../waterfall-job-view-model';

const ok = (over: object) => ({ state: 'ok' as const, jobId: 'j', status: 'running' as const, totalQueued: 3, completedCount: 1, uncertainCount: 0, attempts: 0, error: null, ...over });

describe('waterfallJobView', () => {
  it('running/queued poll with real progress only', () => {
    const v = waterfallJobView(ok({}));
    expect(v).toMatchObject({ kind: 'polling', label: 'Waterfall running: 1/3 rows complete' });
    expect(shouldPollJob(v)).toBe(true);
  });
  it('succeeded stops polling with the final count', () => {
    const v = waterfallJobView(ok({ status: 'succeeded', completedCount: 3 }));
    expect(v).toMatchObject({ kind: 'done', tone: 'ok', label: 'Waterfall complete: 3/3 rows' });
    expect(shouldPollJob(v)).toBe(false);
  });
  it('needs_review is surfaced with the uncertain count, never smoothed over', () => {
    const v = waterfallJobView(ok({ status: 'needs_review', completedCount: 2, uncertainCount: 1 }));
    expect(v.kind).toBe('done');
    if (v.kind === 'done') { expect(v.tone).toBe('review'); expect(v.label).toContain('1 row(s)'); expect(v.label).toContain('not retried'); }
    expect(shouldPollJob(v)).toBe(false);
  });
  it('failed carries the engine error, unavailable/not_found/error never fabricate progress', () => {
    expect(waterfallJobView(ok({ status: 'failed', error: 'boom' })).label).toContain('boom');
    expect(waterfallJobView({ state: 'unavailable', message: 'not implemented' })).toMatchObject({ kind: 'unavailable' });
    expect(waterfallJobView({ state: 'not_found' })).toMatchObject({ kind: 'gone' });
    expect(waterfallJobView({ state: 'error', message: 'down' })).toMatchObject({ kind: 'error' });
  });
});

describe('waterfallJobToneClass (the exact mapping the wired status line renders)', () => {
  it('maps every view kind to the shared component tone', () => {
    expect(waterfallJobToneClass({ kind: 'polling', label: 'x' })).toBe('text-text-muted');
    expect(waterfallJobToneClass({ kind: 'done', tone: 'ok', label: 'x' })).toBe('text-signal-verified');
    expect(waterfallJobToneClass({ kind: 'done', tone: 'review', label: 'x' })).toBe('text-signal-warning');
    expect(waterfallJobToneClass({ kind: 'done', tone: 'failed', label: 'x' })).toBe('text-signal-failed');
    expect(waterfallJobToneClass({ kind: 'gone', label: 'x' })).toBe('text-signal-failed');
    expect(waterfallJobToneClass({ kind: 'error', label: 'x' })).toBe('text-signal-failed');
    expect(waterfallJobToneClass({ kind: 'unavailable', label: 'x' })).toBe('text-signal-failed');
  });
  it('every state produced by waterfallJobView carries a tone the component accepts', () => {
    // end-to-end over the view-model: each engine state maps to a non-empty tone class
    const states = [
      ok({}), ok({ status: 'succeeded' }), ok({ status: 'needs_review' }), ok({ status: 'failed' }),
      ok({ status: 'cancelled' }), { state: 'unavailable', message: 'm' } as const,
      { state: 'not_found' } as const, { state: 'error', message: 'm' } as const,
    ];
    for (const s of states) expect(waterfallJobToneClass(waterfallJobView(s)).length).toBeGreaterThan(0);
  });
});
