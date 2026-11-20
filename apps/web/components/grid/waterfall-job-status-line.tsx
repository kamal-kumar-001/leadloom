'use client';

import React from 'react';
import { waterfallJobToneClass, type WaterfallJobView } from '../../lib/waterfall-job-view-model';

/**
 * D3 status line: the single shared renderer for a waterfall job view.
 * Every label and tone comes from waterfall-job-view-model, which derives
 * ONLY from the engine's status payload - no invented progress, no smoothing
 * over needs_review. Used by the wired PreFlightBar; not a preview fixture.
 */
export function WaterfallJobStatusLine({
  view,
  contextNote,
}: {
  view: WaterfallJobView;
  contextNote?: string | null;
}) {
  return (
    <div
      className={`w-full max-w-[78vw] md:max-w-md border-t border-border-subtle pt-2 text-xs leading-snug break-words ${waterfallJobToneClass(view)}`}
    >
      {contextNote && (
        <span className="block text-[10px] uppercase tracking-wide opacity-75 mb-0.5">{contextNote}</span>
      )}
      {view.label}
    </div>
  );
}
