'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Button, Badge } from '@leadloom/ui';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  href: string;
  actionText: string;
  isComplete: boolean;
  /** false when the engine has no endpoint that can prove this step, so no status is claimed. */
  tracked: boolean;
}

interface GettingStartedChecklistProps {
  hasProviderKeys: boolean;
  hasMailboxes?: boolean;
  hasTables?: boolean;
}

export function GettingStartedChecklist({
  hasProviderKeys,
  hasMailboxes = false,
  hasTables = false,
}: GettingStartedChecklistProps) {
  const steps: ChecklistStep[] = [
    {
      id: 'keys',
      title: 'Add a provider key',
      description: 'Connect your Apollo, Hunter, or Dropcontact API key to enable waterfall enrichment at wholesale cost.',
      href: '/app/connectors',
      actionText: 'Open connectors',
      isComplete: hasProviderKeys,
      tracked: true,
    },
    {
      id: 'mailboxes',
      title: 'Connect a mailbox',
      description: 'Configure custom domain SPF/DKIM DNS records to route outbound steps with jittered delivery.',
      href: '/app/mailboxes',
      actionText: 'Open sample page',
      isComplete: false,
      tracked: false,
    },
    {
      id: 'tables',
      title: 'Create a table',
      description: 'Import target prospect accounts into the high-density virtual grid loom.',
      href: '/app/tables',
      actionText: 'Open sample page',
      isComplete: false,
      tracked: false,
    },
  ];

  const trackedSteps = steps.filter((s) => s.tracked);
  const completedCount = trackedSteps.filter((s) => s.isComplete).length;
  const progressPercent = Math.round((completedCount / trackedSteps.length) * 100);

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              Get Started Checklist
            </h2>
            <Badge variant="subtle" className="text-[11px] font-mono">
              {completedCount} of {trackedSteps.length} verified
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Only steps the workspace can verify are counted. Others are not tracked yet.
          </p>
        </div>
        <div className="w-full sm:w-36 space-y-1.5 self-center">
          <div className="flex justify-between text-[10px] font-mono text-text-muted">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-canvas-elevated h-1.5 rounded-full overflow-hidden border border-border-subtle">
            <div
              className="bg-brand-loom h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-border-subtle border-t border-border-subtle">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="py-3.5 first:pt-4 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5">
                {step.isComplete ? (
                  <div
                    aria-label="Completed"
                    className="w-5 h-5 rounded-full bg-signal-verified/15 text-signal-verified border border-signal-verified/40 flex items-center justify-center shrink-0"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <div
                    aria-label="Pending"
                    className="w-5 h-5 rounded-full border border-border-muted bg-canvas-elevated flex items-center justify-center shrink-0 text-text-muted text-[10px] font-mono"
                  >
                    {idx + 1}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      step.isComplete ? 'text-text-primary' : 'text-text-primary'
                    }`}
                  >
                    {step.title}
                  </span>
                  {!step.tracked && (
                    <Badge variant="muted" className="text-[10px] py-0 px-1.5 font-mono">
                      Not tracked yet
                    </Badge>
                  )}
                  {step.isComplete && (
                    <Badge variant="verified" className="text-[10px] py-0 px-1.5 font-mono">
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5 max-w-xl leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>

            <div className="self-end sm:self-center shrink-0">
              <Link href={step.href}>
                <Button
                  variant={step.isComplete ? 'outline' : 'primary'}
                  size="sm"
                  className="text-xs"
                >
                  <span>{step.actionText}</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
