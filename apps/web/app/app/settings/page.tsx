'use client';

import React from 'react';
import type { EntitlementDecision } from '@leadloom/contracts';
import { Badge, Button } from '@leadloom/ui';
import { toast } from 'sonner';
import {
  Settings,
  ShieldCheck,
  CreditCard,
  Users,
  Database,
  Mail,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface EntitlementRow {
  key: string;
  label: string;
  description: string;
  decision: EntitlementDecision;
}

// Simulated server-evaluated entitlement decisions (UI renders decisions directly, never computes them)
const MOCK_ENTITLEMENT_DECISIONS: EntitlementRow[] = [
  {
    key: 'enrichment_credits',
    label: 'Monthly Enrichment Credits',
    description: 'Allowance for executing multi-tier waterfall resolution cascades.',
    decision: {
      allowed: true,
      reason: 'ok',
      limit: 10000,
      used: 3420,
      remaining: 6580,
    },
  },
  {
    key: 'seats',
    label: 'Team Workspace Seats',
    description: 'Active team members with access to tables and campaigns.',
    decision: {
      allowed: true,
      reason: 'ok',
      limit: 5,
      used: 2,
      remaining: 3,
    },
  },
  {
    key: 'mailboxes',
    label: 'Connected Mailbox Senders',
    description: 'Maximum parallel inboxes in outbound rotation pools.',
    decision: {
      allowed: true,
      reason: 'ok',
      limit: 10,
      used: 1,
      remaining: 9,
    },
  },
  {
    key: 'outbound_sending',
    label: 'Outbound Cold Email Dispatch',
    description: 'Paid email dispatch through external mailbox SMTP/OAuth.',
    decision: {
      allowed: false,
      reason: 'limit_reached',
      limit: 1000,
      used: 1000,
      remaining: 0,
    },
  },
  {
    key: 'ai_researcher',
    label: 'AI Intent Researcher Signals',
    description: 'Perplexity & LLM web crawling for company signals.',
    decision: {
      allowed: true,
      reason: 'ok',
    },
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Workspace Settings & Plan Entitlements</h1>
            <Badge variant="matrix" className="font-mono text-xs">
              Demo data
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Tenant administration, team seat assignments, and server-enforced quota limits.
          </p>
        </div>

        <Badge variant="subtle" className="text-xs font-mono py-1 px-3">
          Plan: Scale Tier (Config-Driven)
        </Badge>
      </div>

      {/* Plan Details & Zero-Trust Notice */}
      <div className="p-5 rounded-xl bg-canvas-surface border border-border-subtle shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-brand-loom" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary">Current Workspace Plan: Scale Tier</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-signal-verified/15 text-signal-verified">
                Billing Status: Active
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Zero-Trust Architecture: Quotas and entitlements are computed strictly server-side by <code className="text-brand-loom">EntitlementService</code>. The browser UI never dictates plan authority.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.info('Billing management is disabled in demo mode')}
          className="text-xs shrink-0"
        >
          Manage Subscription
        </Button>
      </div>

      {/* Entitlements Table */}
      <section className="bg-canvas-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-loom" />
            <h2 className="text-sm font-semibold text-text-primary">Server-Evaluated Entitlements</h2>
          </div>
          <span className="text-xs font-mono text-text-muted">Direct from EntitlementDecision</span>
        </div>

        <div className="divide-y divide-border-subtle">
          {MOCK_ENTITLEMENT_DECISIONS.map((item) => {
            const { decision } = item;
            const hasNumericQuota = typeof decision.limit === 'number' && typeof decision.used === 'number';
            const percentageUsed = hasNumericQuota && decision.limit ? Math.min(100, Math.round((decision.used! / decision.limit) * 100)) : 0;

            return (
              <div key={item.key} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-canvas-elevated/30 transition-colors">
                <div className="max-w-md">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary">{item.label}</span>
                    {decision.allowed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-signal-verified/15 text-signal-verified">
                        <CheckCircle2 className="w-3 h-3" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-signal-failed/15 text-signal-failed">
                        <XCircle className="w-3 h-3" /> Gated ({decision.reason})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
                </div>

                <div className="flex items-center gap-4 sm:justify-end">
                  {hasNumericQuota ? (
                    <div className="text-right">
                      <div className="text-xs font-mono text-text-secondary">
                        <span className="font-semibold text-text-primary">{decision.used}</span> / {decision.limit} ({decision.remaining} remaining)
                      </div>
                      <div className="w-40 h-1.5 rounded-full bg-canvas-subtle overflow-hidden mt-1.5 border border-border-subtle">
                        <div
                          className={`h-full rounded-full ${
                            percentageUsed > 90 ? 'bg-signal-failed' : 'bg-brand-loom'
                          }`}
                          style={{ width: `${percentageUsed}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-text-muted">Feature Flag: {decision.allowed ? 'Enabled' : 'Disabled'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Workspace Team Members */}
      <section className="bg-canvas-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-weave" />
            <h2 className="text-sm font-semibold text-text-primary">Tenant Team Members</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.info('Invite team member (simulated)')}
            className="text-xs py-1"
          >
            Invite Member
          </Button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-canvas-elevated/40 border border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center text-xs font-bold text-brand-loom">
                K
              </div>
              <div>
                <div className="text-xs font-semibold text-text-primary">Kamal (Workspace Owner)</div>
                <div className="text-[11px] text-text-muted font-mono">kamal@leadloom.dev</div>
              </div>
            </div>
            <Badge variant="subtle" className="text-[10px] font-mono">
              Tenant Role: admin
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-canvas-elevated/40 border border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-weave/20 border border-brand-weave/30 flex items-center justify-center text-xs font-bold text-brand-weave">
                A
              </div>
              <div>
                <div className="text-xs font-semibold text-text-primary">Alex Chen (Growth Engineer)</div>
                <div className="text-[11px] text-text-muted font-mono">alex@leadloom.dev</div>
              </div>
            </div>
            <Badge variant="subtle" className="text-[10px] font-mono">
              Tenant Role: member
            </Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
