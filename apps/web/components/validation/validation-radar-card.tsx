'use client';

import React from 'react';
import { Badge, Button } from '@leadloom/ui';
import { ValidationScorecardResponse } from '@leadloom/contracts';
import { Flame, AlertTriangle, Snowflake, ArrowRight, CheckCircle2 } from 'lucide-react';

export interface ValidationRadarCardProps {
  scorecard: ValidationScorecardResponse;
  onPromoteToCampaign?: () => void;
}

export function ValidationRadarCard({ scorecard, onPromoteToCampaign }: ValidationRadarCardProps) {
  const { verdict, verdictScore, metrics, actionableSummary } = scorecard;

  const isHighPull = verdict === 'high_pull';
  const isPivot = verdict === 'pivot_positioning';

  return (
    <div className="rounded-2xl border border-border-muted bg-canvas-surface/90 p-6 backdrop-blur-xl shadow-2xl font-sans">
      {/* Header with Verdict Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-subtle">
        <div>
          <h3 className="font-bold text-text-primary text-base">Validation Radar & Go/No-Go Scorecard</h3>
          <p className="text-xs font-mono text-text-muted mt-0.5">Automated hypothesis telemetry</p>
        </div>

        {isHighPull && (
          <Badge variant="verified" className="text-xs py-1 px-3">
            <Flame className="w-3.5 h-3.5 mr-1.5 fill-current" />
            BUILD NOW (Score: {verdictScore}/100)
          </Badge>
        )}
        {isPivot && (
          <Badge variant="catchall" className="text-xs py-1 px-3">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            PIVOT POSITIONING (Score: {verdictScore}/100)
          </Badge>
        )}
        {!isHighPull && !isPivot && (
          <Badge variant="failed" className="text-xs py-1 px-3">
            <Snowflake className="w-3.5 h-3.5 mr-1.5" />
            LOW PULL — KILL IDEA (Score: {verdictScore}/100)
          </Badge>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 font-mono">
        <div className="p-3 rounded-xl border border-border-subtle bg-canvas-elevated/40">
          <div className="text-[11px] text-text-muted">Micro-Page Conv.</div>
          <div className="text-lg font-bold text-text-primary mt-1">
            {(metrics.pageConversionRate * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-signal-verified">Target: &gt; 8.0%</div>
        </div>

        <div className="p-3 rounded-xl border border-border-subtle bg-canvas-elevated/40">
          <div className="text-[11px] text-text-muted">Outreach Reply %</div>
          <div className="text-lg font-bold text-text-primary mt-1">
            {(metrics.replyRate * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-signal-verified">Benchmark: 5.0%</div>
        </div>

        <div className="p-3 rounded-xl border border-border-subtle bg-canvas-elevated/40">
          <div className="text-[11px] text-text-muted">Resonance Fit</div>
          <div className="text-lg font-bold text-brand-loom mt-1">
            {(metrics.positiveResonanceRate * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-text-muted">Target: &gt; 40%</div>
        </div>

        <div className="p-3 rounded-xl border border-border-subtle bg-canvas-elevated/40">
          <div className="text-[11px] text-text-muted">Waitlist Leads</div>
          <div className="text-lg font-bold text-signal-verified mt-1">
            {metrics.waitlistCount} Leads
          </div>
          <div className="text-[10px] text-text-muted">Survey Complete</div>
        </div>
      </div>

      {/* Summary Note & Recommendations */}
      <div className="p-3.5 rounded-xl border border-border-subtle bg-canvas-elevated/20 text-xs font-mono text-text-secondary leading-relaxed mb-6">
        <span className="text-text-muted font-bold">Orchestrator Diagnosis: </span>
        <span className="text-text-primary">{actionableSummary}</span>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
        <span className="text-xs font-mono text-text-muted">
          Active Route: <a href={scorecard.pageUrl} target="_blank" rel="noreferrer" className="text-brand-loom hover:underline">{scorecard.pageUrl}</a>
        </span>
        <Button size="sm" variant="primary" onClick={onPromoteToCampaign}>
          <span>Promote to Full Outreach Sequence</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
