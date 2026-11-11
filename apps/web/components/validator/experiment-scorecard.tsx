'use client';

import React from 'react';
import { Badge, Card } from '@leadloom/ui';
import { X } from 'lucide-react';
import type { ExperimentScorecard } from '../../lib/engine-client';

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-canvas-elevated p-3">
      <div className="text-[10px] uppercase font-mono text-text-muted">{label}</div>
      <div className="text-lg font-bold text-text-primary mt-0.5 font-mono">{value}</div>
    </div>
  );
}

/**
 * Real per-experiment scorecard (GET /validator/experiments/:id/scorecard).
 * Metrics come only from observed inputs: page loads, waitlist signups and
 * owner-recorded outreach numbers. Zero-data states say so plainly; a pending
 * verdict means there is not enough signal, never implied demand.
 */
export function ExperimentScorecardPanel({
  scorecard,
  onClose,
}: {
  scorecard: ExperimentScorecard;
  onClose: () => void;
}) {
  const m = scorecard.metrics;
  const hasPageData = m.visitors > 0 || m.waitlistCount > 0;
  const hasOutreachData = m.outreachSent > 0;

  return (
    <Card className="p-5 sm:p-6 space-y-5 border border-border-subtle shadow-sm">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Experiment scorecard</h2>
            <Badge variant={scorecard.verdict === 'pending' ? 'matrix' : 'subtle'} className="text-[10px] font-mono">
              {scorecard.verdict === 'pending' ? 'Pending - not enough signal yet' : scorecard.verdict}
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1 max-w-2xl">{scorecard.hypothesis}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scorecard"
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-canvas-elevated"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <div className="text-[10px] uppercase font-mono text-text-muted mb-2">Smoke-test page (observed)</div>
        {hasPageData ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Metric label="Page loads" value={String(m.visitors)} />
            <Metric label="Waitlist signups" value={String(m.waitlistCount)} />
            <Metric label="Signup rate" value={pct(m.pageConversionRate)} />
          </div>
        ) : (
          <p className="text-xs text-text-muted">No page traffic yet. Share the published page to start measuring real interest.</p>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase font-mono text-text-muted mb-2">Outreach (recorded by you)</div>
        {hasOutreachData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Outreach sent" value={String(m.outreachSent)} />
            <Metric label="Replies" value={String(m.replies)} />
            <Metric label="Reply rate" value={pct(m.replyRate)} />
            <Metric label="Positive replies" value={String(m.positiveReplies)} />
          </div>
        ) : (
          <p className="text-xs text-text-muted">No outreach recorded yet. These numbers are entered by your team, not estimated.</p>
        )}
      </div>

      <p className="text-xs text-text-secondary border-t border-border-subtle pt-3">{scorecard.actionableSummary}</p>
    </Card>
  );
}
