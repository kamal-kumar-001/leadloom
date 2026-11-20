'use client';
// LOCAL HARNESS PREVIEW ONLY (visual verification of the delivery-event timeline).
// Not linked anywhere; renders static fixture data, no engine calls.
import React from 'react';
import { JobTimeline } from '@/components/campaigns/job-timeline';
import type { JobTimelineResponse } from '@/lib/engine-client';

const withReplies: JobTimelineResponse = {
  campaign: { id: '00000000-0000-4000-8000-000000000001', name: 'Q4 Outreach (fixture)', status: 'active' },
  job: {
    id: '00000000-0000-4000-8000-000000000002',
    recipientEmail: 'ada@northstar.example',
    stepNumber: 1,
    status: 'accepted',
    attempts: 1,
  },
  statusNote: 'Status transition times are not separately recorded; events show only recorded timestamps.',
  events: [
    { kind: 'queued', at: '2026-11-09T09:00:00.000Z', note: 'job created' },
    { kind: 'scheduled', at: '2026-11-10T09:00:00.000Z', note: 'planned send time' },
    { kind: 'dispatch_started', at: '2026-11-10T09:00:05.000Z', note: 'worker claimed the job for dispatch' },
    { kind: 'status_recorded', at: '2026-11-10T09:01:00.000Z', note: 'last record update; status transition times are not separately recorded' },
    { kind: 'reply', at: '2026-11-11T10:00:00.000Z', classification: 'question', note: 'reply received' },
    { kind: 'reply', at: '2026-11-12T10:00:00.000Z', classification: 'interested', note: 'reply received' },
  ],
};

const minimal: JobTimelineResponse = {
  campaign: withReplies.campaign,
  job: { ...withReplies.job, id: '00000000-0000-4000-8000-000000000003', recipientEmail: 'grace@acme.example', status: 'pending', attempts: 0 },
  statusNote: withReplies.statusNote,
  events: [
    { kind: 'queued', at: '2026-11-13T08:30:00.000Z', note: 'job created' },
    { kind: 'scheduled', at: '2026-11-14T09:00:00.000Z', note: 'planned send time' },
  ],
};

export default function PreviewJobTimelinePage() {
  return (
    <main className="min-h-screen bg-surface-primary p-8 font-mono">
      <h1 className="mb-6 text-sm text-text-primary">Job timeline states (local preview)</h1>
      <div className="max-w-2xl space-y-8">
        <section data-shot="timeline-full" className="rounded-lg border border-border-subtle p-4">
          <JobTimeline timeline={withReplies} />
        </section>
        <section data-shot="timeline-minimal" className="rounded-lg border border-border-subtle p-4">
          <JobTimeline timeline={minimal} />
        </section>
      </div>
    </main>
  );
}
