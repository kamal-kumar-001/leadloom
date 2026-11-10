'use client';

import React from 'react';
import { Badge, Button } from '@leadloom/ui';
import {
  Building,
  Shield,
  Layers,
  Database,
  Activity,
  Calendar,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';

const MOCK_TENANTS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Acme Growth Labs',
    owner: 'alex@acme.com',
    planId: 'plan_scale',
    planName: 'Scale Tier',
    status: 'active',
    members: 4,
    enrichmentCreditsUsed: 3420,
    creditLimit: 10000,
    created: '2026-11-01',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'DevOps Engine Core',
    owner: 'sarah@devopsengine.io',
    planId: 'plan_growth',
    planName: 'Growth Tier',
    status: 'active',
    members: 2,
    enrichmentCreditsUsed: 890,
    creditLimit: 2500,
    created: '2026-11-04',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'SaaS Alpha Ventures',
    owner: 'ken@alphaventures.vc',
    planId: 'plan_growth',
    planName: 'Growth Tier',
    status: 'trialing',
    members: 1,
    enrichmentCreditsUsed: 120,
    creditLimit: 500,
    created: '2026-11-09',
  },
];

const MOCK_AUDIT_LOGS = [
  {
    id: 'aud_01',
    actor: 'system_cron',
    action: 'vault.dek_rotation',
    target: 'tenant_11111111',
    status: 'success',
    timestamp: '2026-11-10 17:15:02 UTC',
    ip: '10.0.4.12',
  },
  {
    id: 'aud_02',
    actor: 'platform_admin (kamal)',
    action: 'plan.limit_override',
    target: 'tenant_22222222',
    status: 'success',
    timestamp: '2026-11-10 16:42:19 UTC',
    ip: '192.168.1.101',
  },
  {
    id: 'aud_03',
    actor: 'alex@acme.com',
    action: 'mailbox.verify_dns',
    target: 'alex-outreach@loom.dev',
    status: 'success',
    timestamp: '2026-11-10 15:30:45 UTC',
    ip: '82.165.197.1',
  },
  {
    id: 'aud_04',
    actor: 'unknown_ip',
    action: 'auth.failed_attempt',
    target: 'admin@acme.com',
    status: 'rejected_401',
    timestamp: '2026-11-10 14:12:00 UTC',
    ip: '198.51.100.4',
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-8">
      {/* Top Telemetry Row */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Platform Overview</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Multi-tenant instances, vault operations, and global system health
            </p>
          </div>
          <Badge variant="subtle" className="font-mono text-xs">
            Demo data • Operator View
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle">
            <div className="text-xs text-text-muted">Active Workspaces</div>
            <div className="text-2xl font-bold text-text-primary mt-1">3</div>
            <div className="text-[11px] text-signal-verified mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> All DB schemas isolated
            </div>
          </div>

          <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle">
            <div className="text-xs text-text-muted">Total Enriched Leads</div>
            <div className="text-2xl font-bold text-text-primary mt-1">4,430</div>
            <div className="text-[11px] text-text-secondary mt-1">Across 3 active tables</div>
          </div>

          <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle">
            <div className="text-xs text-text-muted">Active Mailbox Pools</div>
            <div className="text-2xl font-bold text-text-primary mt-1">6</div>
            <div className="text-[11px] text-signal-verified mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> SPF / DKIM valid
            </div>
          </div>

          <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle">
            <div className="text-xs text-text-muted">Vault Security Envelope</div>
            <div className="text-2xl font-bold text-text-primary mt-1">AES-256</div>
            <div className="text-[11px] text-signal-verified mt-1 flex items-center gap-1">
              <Shield className="w-3 h-3" /> KEK/DEK verified
            </div>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <section className="bg-canvas-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-brand-loom" />
            <h2 className="text-sm font-semibold text-text-primary">Registered Tenant Workspaces</h2>
          </div>
          <span className="text-xs font-mono text-text-muted">3 tenants registered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas-elevated/50 text-text-muted font-mono uppercase text-[10px] border-b border-border-subtle">
              <tr>
                <th className="py-2.5 px-4">Organization</th>
                <th className="py-2.5 px-4">Tenant ID</th>
                <th className="py-2.5 px-4">Plan</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Credit Metering</th>
                <th className="py-2.5 px-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {MOCK_TENANTS.map((t) => (
                <tr key={t.id} className="hover:bg-canvas-elevated/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-text-primary">{t.name}</div>
                    <div className="text-text-muted text-[11px]">{t.owner}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-text-muted text-[11px]">{t.id.slice(0, 18)}...</td>
                  <td className="py-3 px-4 font-medium text-brand-loom">{t.planName}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-signal-verified/15 text-signal-verified">
                      <span className="w-1.5 h-1.5 rounded-full bg-signal-verified" />
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-canvas-subtle overflow-hidden">
                        <div
                          className="h-full bg-brand-loom rounded-full"
                          style={{ width: `${(t.enrichmentCreditsUsed / t.creditLimit) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-text-muted font-mono">
                        {t.enrichmentCreditsUsed} / {t.creditLimit}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-text-muted font-mono">{t.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Global Audit Log */}
      <section id="audit" className="bg-canvas-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-weave" />
            <h2 className="text-sm font-semibold text-text-primary">Global Security & Audit Log</h2>
          </div>
          <span className="text-xs font-mono text-text-muted">Live event stream</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-canvas-elevated/50 text-text-muted uppercase text-[10px] border-b border-border-subtle">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Target</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Source IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {MOCK_AUDIT_LOGS.map((log) => (
                <tr key={log.id} className="hover:bg-canvas-elevated/30 transition-colors">
                  <td className="py-2.5 px-4 text-text-muted">{log.timestamp}</td>
                  <td className="py-2.5 px-4 text-text-primary">{log.actor}</td>
                  <td className="py-2.5 px-4 text-brand-loom font-semibold">{log.action}</td>
                  <td className="py-2.5 px-4 text-text-secondary">{log.target}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        log.status === 'success'
                          ? 'bg-signal-verified/15 text-signal-verified'
                          : 'bg-signal-failed/15 text-signal-failed'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-text-muted">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
