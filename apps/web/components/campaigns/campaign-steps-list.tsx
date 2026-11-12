'use client';

import React from 'react';
import { Card } from '@leadloom/ui';
import { Clock } from 'lucide-react';
import type { WorkspaceCampaignStep } from '../../lib/engine-client';

/**
 * Read-only view of a real campaign's stored steps (from the workspace API).
 * Distinct from the labeled sample preview: this is live campaign configuration.
 */
export function CampaignStepsList({ steps }: { steps: WorkspaceCampaignStep[] }) {
  const ordered = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);
  if (ordered.length === 0) {
    return <p className="text-xs text-text-muted">This campaign has no steps configured yet.</p>;
  }
  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border-subtle">
      {ordered.map((step) => (
        <div key={step.stepNumber} className="relative">
          <div className="absolute -left-6 top-3 w-5 h-5 rounded-full bg-canvas-elevated border-2 border-brand-loom flex items-center justify-center text-[10px] font-bold text-brand-loom">
            {step.stepNumber}
          </div>
          <Card className="p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-text-primary">Step {step.stepNumber}: Outbound Email</span>
              {step.delayHours > 0 ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas-elevated text-brand-weave flex items-center gap-1 border border-border-subtle">
                  <Clock className="w-3 h-3" /> Wait {step.delayHours}h after previous step
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-signal-verified/15 text-signal-verified border border-signal-verified/30">
                  Sends after release
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-text-secondary mb-1.5 font-mono">
              Subject: <span className="text-text-primary font-sans">{step.subject}</span>
            </div>
            <p className="text-xs text-text-muted bg-canvas-elevated p-2.5 rounded-lg border border-border-subtle whitespace-pre-wrap font-mono">
              {step.bodyTemplate}
            </p>
          </Card>
        </div>
      ))}
    </div>
  );
}
