'use client';

import React from 'react';
import { Card, Badge } from '@leadloom/ui';
import { Info, Gauge, Layers, Mail, Table2, Sparkles, Send } from 'lucide-react';
import type { LimitKey } from '@leadloom/contracts';

interface DefinedLimitItem {
  key: LimitKey;
  label: string;
  description: string;
  icon: React.ElementType;
}

const DEFINED_LIMITS: DefinedLimitItem[] = [
  {
    key: 'seats',
    label: 'Workspace Seats',
    description: 'Active team members allowed with collaborative workspace access.',
    icon: Layers,
  },
  {
    key: 'mailboxes',
    label: 'Outbound Mailbox Senders',
    description: 'Parallel inboxes in deliverability rotation with SPF/DKIM telemetry.',
    icon: Mail,
  },
  {
    key: 'tables',
    label: 'Virtual Grid Loom Tables',
    description: 'High-density spreadsheet tables supporting 50,000+ contact rows.',
    icon: Table2,
  },
  {
    key: 'enrichment_credits_per_month',
    label: 'Monthly Waterfall Credits',
    description: 'Allowance for executing multi-tier waterfall contact enrichment waterfalls.',
    icon: Sparkles,
  },
  {
    key: 'emails_per_month',
    label: 'Monthly Outbound Emails',
    description: 'Jittered sequence dispatch volume across connected mailboxes.',
    icon: Send,
  },
];

export function PlanLimitsCard() {
  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              Plan & System Limits
            </h2>
            <Badge variant="catchall" className="text-[10px] font-mono py-0 px-2">
              not_enforced
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Limits defined for this product. They are not enforced yet.
          </p>
        </div>
      </div>

      {/* Mandatory Notice */}
      <div className="p-3.5 rounded-lg border border-signal-catchall/30 bg-signal-catchall/10 flex items-start gap-3">
        <Info className="w-4 h-4 text-signal-catchall shrink-0 mt-0.5" />
        <div className="text-xs text-text-primary space-y-0.5">
          <p className="font-semibold text-signal-catchall">
            Limits are defined but not enforced yet
          </p>
          <p className="text-text-muted leading-relaxed text-[11px]">
            The core engine health telemetry reports entitlements as <code className="font-mono text-text-primary">not_enforced</code>. System boundaries are established contractually, but usage quotas are currently unrestricted in this deployment.
          </p>
        </div>
      </div>

      {/* Read-Only Limits List (No usage bars, no used/remaining numbers) */}
      <div className="divide-y divide-border-subtle border-t border-border-subtle">
        {DEFINED_LIMITS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="py-3 first:pt-3.5 last:pb-1 flex items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-canvas-elevated border border-border-subtle flex items-center justify-center shrink-0 text-text-muted mt-0.5 sm:mt-0">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-text-primary">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-text-muted leading-relaxed truncate sm:whitespace-normal">
                    {item.description}
                  </div>
                </div>
              </div>

              <div className="shrink-0 self-center">
                <Badge variant="subtle" className="font-mono text-[10px]">
                  {item.key}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
