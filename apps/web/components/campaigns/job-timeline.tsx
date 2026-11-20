'use client';

import React from 'react';
import { Badge } from '@leadloom/ui';
import type { JobTimelineResponse } from '../../lib/engine-client';
import { jobTimelineEventView } from '../../lib/job-timeline-view-model';

/**
 * Delivery-event timeline for one outbound job (presentational).
 * Every row maps to a timestamp recorded server-side. The current status is
 * a summary line, never an event, and statusNote stays visible so nobody
 * reads a record update as a delivery transition.
 */
function fmt(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

const toneDot: Record<string, string> = {
  neutral: 'bg-text-muted',
  active: 'bg-accent-primary',
  muted: 'bg-border-subtle',
  reply: 'bg-status-verified',
};

export function JobTimeline({ timeline }: { timeline: JobTimelineResponse }) {
  const { job, events, statusNote } = timeline;
  return (
    <div className="space-y-2" data-testid="job-timeline">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-text-primary break-all">{job.recipientEmail}</span>
        <span className="text-text-muted font-mono">step {job.stepNumber}</span>
        <Badge variant="subtle" className="text-[10px] font-mono">{job.status.toUpperCase()}</Badge>
        <span className="text-text-muted font-mono">attempts {job.attempts}</span>
      </div>
      <ol className="relative ml-1.5 space-y-2 border-l border-border-subtle pl-4">
        {events.map((e, i) => {
          const v = jobTimelineEventView(e);
          return (
            <li key={`${e.kind}-${e.at}-${i}`} className="relative text-xs">
              <span className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ${toneDot[v.tone]}`} />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-text-primary">{v.label}</span>
                <span className="font-mono text-[11px] text-text-secondary">{fmt(e.at)}</span>
              </div>
              {v.detail && <p className="text-[11px] text-text-muted">{v.detail}</p>}
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-text-muted font-mono">{statusNote}</p>
    </div>
  );
}
