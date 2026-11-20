import { describe, it, expect } from 'vitest';
import { jobTimelineEventView } from '../job-timeline-view-model';
import type { JobTimelineEvent } from '../engine-client';

const at = '2026-11-10T09:00:00.000Z';

describe('jobTimelineEventView', () => {
  it('labels scheduled as a planned send, never a delivery', () => {
    const v = jobTimelineEventView({ kind: 'scheduled', at });
    expect(v.label).toBe('Planned send');
    expect(v.label).not.toMatch(/sent|delivered/i);
    expect(v.tone).toBe('neutral');
  });

  it('keeps the not-separately-recorded note on status_recorded', () => {
    const note = 'last record update; status transition times are not separately recorded';
    const v = jobTimelineEventView({ kind: 'status_recorded', at, note });
    expect(v.label).toBe('Record updated');
    expect(v.detail).toBe(note);
    expect(v.tone).toBe('muted');
  });

  it('surfaces reply classification and nothing else', () => {
    const v = jobTimelineEventView({ kind: 'reply', at, classification: 'interested', note: 'reply received' });
    expect(v.label).toBe('Reply received');
    expect(v.detail).toBe('classified: interested');
    expect(v.tone).toBe('reply');
  });

  it('maps every kind without a success label or tone', () => {
    const kinds: JobTimelineEvent['kind'][] = ['queued', 'scheduled', 'dispatch_started', 'status_recorded', 'reply'];
    for (const kind of kinds) {
      const v = jobTimelineEventView({ kind, at });
      expect(v.label).not.toMatch(/sent|delivered|success/i);
      expect(['neutral', 'active', 'muted', 'reply']).toContain(v.tone);
    }
  });
});
