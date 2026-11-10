'use client';

import React, { useState } from 'react';
import { MOCK_MAILBOX_HEALTH } from '@leadloom/contracts';
import { Button, Badge } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Clock,
  Send,
  Zap,
  Sliders,
  Check,
  ExternalLink,
} from 'lucide-react';
import { DnsInspectorModal } from '../../../components/mailboxes/dns-inspector-modal';

export default function MailboxesPage() {
  const [mailboxes] = useState(MOCK_MAILBOX_HEALTH);
  const [checking, setChecking] = useState(false);
  const [activeDnsDomain, setActiveDnsDomain] = useState<string | null>(null);

  const handleRunHealthCheck = async () => {
    setChecking(true);
    await new Promise((r) => setTimeout(r, 600));
    notify.info('[Sample] Simulated DNS SPF/DKIM/DMARC health verification complete');
    setChecking(false);
  };

  const handleConnectProvider = (providerName: string) => {
    notify.info(`[Sample] Simulated OAuth2 bridge redirect to ${providerName} consent screen`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Outbound Mailbox Pool
            </h1>
            <Badge variant="matrix" className="font-mono text-xs">
              Demo data
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Deliverability engine with jittered dispatch (45-180s) and RFC 8058 one-click unsubscribe.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunHealthCheck}
            disabled={checking}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>Verify DNS Records</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleConnectProvider('Google Workspace')}
            className="text-xs gap-1.5"
          >
            <span>+ Google Mailbox</span>
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => handleConnectProvider('Microsoft 365')}
            className="text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Microsoft 365</span>
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle">
          <div className="text-xs text-text-muted">Total Connected Senders</div>
          <div className="text-2xl font-bold text-text-primary mt-1">{mailboxes.length}</div>
          <div className="text-[11px] text-signal-verified mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Warm-up cycle active
          </div>
        </div>

        <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle">
          <div className="text-xs text-text-muted">Aggregate Daily Quota</div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {mailboxes.reduce((acc, m) => acc + m.sentToday, 0)} /{' '}
            {mailboxes.reduce((acc, m) => acc + m.dailySendLimit, 0)}
          </div>
          <div className="text-[11px] text-text-muted mt-1">Safe volume threshold</div>
        </div>

        <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle">
          <div className="text-xs text-text-muted">Average Health Score</div>
          <div className="text-2xl font-bold text-signal-verified mt-1">98%</div>
          <div className="text-[11px] text-signal-verified mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> 100% DNS record alignment
          </div>
        </div>

        <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle">
          <div className="text-xs text-text-muted">Dispatch Jitter Timing</div>
          <div className="text-2xl font-bold text-text-primary mt-1">45-180s</div>
          <div className="text-[11px] text-brand-weave mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Anti-spam rate spreading
          </div>
        </div>
      </div>

      {/* Mailbox List */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Sender Health & Record Validation</h2>

        {mailboxes.map((m) => {
          const domain = m.email.split('@')[1] || 'loom-outreach.dev';
          return (
            <div
              key={m.id}
              className="p-5 rounded-xl bg-canvas-surface border border-border-subtle hover:border-border-muted transition-all shadow-sm"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-brand-loom" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">{m.email}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-signal-verified/15 text-signal-verified">
                        Health {m.healthScore}/100
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-canvas-elevated text-text-muted">
                        Demo data
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono">
                      <span className="flex items-center gap-1 text-signal-verified">
                        <Check className="w-3 h-3" /> SPF: {m.spfStatus}
                      </span>
                      <span className="flex items-center gap-1 text-signal-verified">
                        <Check className="w-3 h-3" /> DKIM: {m.dkimStatus}
                      </span>
                      <span className="flex items-center gap-1 text-signal-verified">
                        <Check className="w-3 h-3" /> DMARC: {m.dmarcStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quota Progress & DNS Inspect Action */}
                <div className="flex items-center gap-4 lg:justify-end">
                  <div className="text-right">
                    <div className="text-xs text-text-muted font-mono">
                      Sent today: <span className="font-semibold text-text-primary">{m.sentToday}</span> / {m.dailySendLimit}
                    </div>
                    <div className="w-36 h-2 rounded-full bg-canvas-elevated overflow-hidden mt-1.5 border border-border-subtle">
                      <div
                        className="h-full bg-signal-verified rounded-full"
                        style={{ width: `${(m.sentToday / m.dailySendLimit) * 100}%` }}
                      />
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveDnsDomain(domain)}
                    className="text-xs py-1.5 gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-signal-verified" />
                    <span>Inspect DNS</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DNS Inspector Modal */}
      {activeDnsDomain && (
        <DnsInspectorModal
          domain={activeDnsDomain}
          isOpen={!!activeDnsDomain}
          onClose={() => setActiveDnsDomain(null)}
        />
      )}
    </div>
  );
}
