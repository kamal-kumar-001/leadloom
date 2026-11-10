'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Badge, Card, EmptyState } from '@leadloom/ui';
import {
  fetchWorkspaceMailboxes,
  fetchWorkspaceSuppressions,
  type WorkspaceMailboxRow,
  type WorkspaceSuppressionRow,
} from '../../../lib/engine-client';
import { notify } from '@/lib/notify';
import {
  Mail,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Clock,
  Send,
  Sliders,
  Check,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import { DnsInspectorModal } from '../../../components/mailboxes/dns-inspector-modal';

function renderDnsChip(label: 'SPF' | 'DKIM' | 'DMARC', status: string) {
  const s = (status || 'unknown').toLowerCase();
  if (s === 'verified' || s === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-signal-verified/15 text-signal-verified border border-signal-verified/30">
        <Check className="w-3 h-3 stroke-[2.5]" />
        <span>{label}: Verified</span>
      </span>
    );
  }
  if (s === 'failed' || s === 'fail') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-signal-failed/15 text-signal-failed border border-signal-failed/30">
        <XCircle className="w-3 h-3 stroke-[2.5]" />
        <span>{label}: Failed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-canvas-elevated text-text-muted border border-border-subtle">
      <HelpCircle className="w-3 h-3" />
      <span>{label}: Unknown</span>
    </span>
  );
}

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState<WorkspaceMailboxRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [suppressions, setSuppressions] = useState<WorkspaceSuppressionRow[]>([]);
  const [suppressionsLoading, setSuppressionsLoading] = useState(true);
  const [suppressionsError, setSuppressionsError] = useState<string | null>(null);

  const [activeDnsDomain, setActiveDnsDomain] = useState<string | null>(null);

  const loadMailboxes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWorkspaceMailboxes();
      if (res.data) {
        setMailboxes(res.data);
      } else {
        setError(res.error || 'Failed to fetch workspace mailboxes');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Engine connection error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSuppressions = useCallback(async () => {
    setSuppressionsLoading(true);
    setSuppressionsError(null);
    try {
      const res = await fetchWorkspaceSuppressions();
      if (res.data) {
        setSuppressions(res.data);
      } else {
        setSuppressionsError(res.error || 'Failed to fetch suppressions');
      }
    } catch (err: unknown) {
      setSuppressionsError(err instanceof Error ? err.message : 'Engine connection error');
    } finally {
      setSuppressionsLoading(false);
    }
  }, []);

  const handleRefreshAll = useCallback(() => {
    loadMailboxes();
    loadSuppressions();
  }, [loadMailboxes, loadSuppressions]);

  useEffect(() => {
    loadMailboxes();
    loadSuppressions();
  }, [loadMailboxes, loadSuppressions]);

  const handleConnectProvider = (providerName: string) => {
    notify.info(`OAuth2 bridge redirect to ${providerName} consent screen`);
  };

  const totalSendLimit = mailboxes.reduce((acc, m) => acc + (m.dailySendLimit || 0), 0);
  const totalSentToday = mailboxes.reduce((acc, m) => acc + (m.sentToday || 0), 0);
  const activeCount = mailboxes.filter((m) => !m.isPaused).length;
  const avgHealth =
    mailboxes.length > 0
      ? `${Math.round(mailboxes.reduce((acc, m) => acc + (m.healthScore || 0), 0) / mailboxes.length)}%`
      : '—';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Outbound Mailbox Pool
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Deliverability engine with jittered dispatch (45-180s) and RFC 8058 one-click unsubscribe.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshAll}
            disabled={isLoading || suppressionsLoading}
            className="text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(isLoading || suppressionsLoading) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
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

      {/* Honest Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-text-muted">Total Connected Senders</div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {isLoading ? '—' : mailboxes.length}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {activeCount} active in sender pool
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted">Aggregate Daily Quota</div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {isLoading ? '—' : `${totalSentToday} / ${totalSendLimit}`}
          </div>
          <div className="text-[11px] text-text-muted mt-1">Safe volume threshold</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted">Average Health Score</div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {isLoading ? '—' : avgHealth}
          </div>
          <div className="text-[11px] text-text-muted mt-1">DNS record alignment</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted">Dispatch Jitter Timing</div>
          <div className="text-2xl font-bold text-text-primary mt-1">45-180s</div>
          <div className="text-[11px] text-brand-weave mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Anti-spam rate spreading
          </div>
        </Card>
      </div>

      {/* Mailbox List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Sender Health & Record Validation</h2>
          {!isLoading && !error && (
            <span className="text-xs text-text-muted font-mono">
              {mailboxes.length} {mailboxes.length === 1 ? 'mailbox' : 'mailboxes'}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="p-5 animate-pulse space-y-3">
                <div className="h-5 w-56 bg-canvas-elevated rounded" />
                <div className="h-4 w-40 bg-canvas-elevated rounded" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 border-signal-failed/30 bg-signal-failed/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-signal-failed">Failed to load workspace mailboxes</p>
              <p className="text-xs text-text-muted mt-0.5">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={loadMailboxes} className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry</span>
            </Button>
          </Card>
        ) : mailboxes.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<Mail className="w-6 h-6 text-text-muted" />}
              title="No mailboxes yet"
              description="Connect an SMTP/OAuth sender to start outbound sequences."
            />
          </Card>
        ) : (
          mailboxes.map((m) => {
            const domain = m.email.split('@')[1] || 'leadloom.dev';
            const quotaPercent = m.dailySendLimit > 0 ? Math.min(100, Math.round((m.sentToday / m.dailySendLimit) * 100)) : 0;

            return (
              <Card
                key={m.id}
                className="p-5 hover:border-border-muted transition-all shadow-sm"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-brand-loom" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text-primary">{m.email}</span>
                        <Badge variant={m.isPaused ? 'muted' : 'verified'} className="text-[10px] font-mono">
                          {m.isPaused ? 'Paused' : 'Active'}
                        </Badge>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-canvas-elevated text-text-secondary border border-border-subtle">
                          Health: {m.healthScore > 0 ? `${m.healthScore}/100` : '—'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {renderDnsChip('SPF', m.spfStatus)}
                        {renderDnsChip('DKIM', m.dkimStatus)}
                        {renderDnsChip('DMARC', m.dmarcStatus)}
                      </div>
                      <p className="text-[11px] text-text-muted mt-2 font-mono">
                        Last health check: {m.lastHealthCheckAt ? new Date(m.lastHealthCheckAt).toLocaleDateString() : 'Never checked'}
                      </p>
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
                          style={{ width: `${quotaPercent}%` }}
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
              </Card>
            );
          })
        )}
      </div>

      {/* Suppression list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Suppression list</h2>
            <ShieldAlert className="w-4 h-4 text-text-muted" />
          </div>
          {!suppressionsLoading && !suppressionsError && (
            <span className="text-xs text-text-muted font-mono">
              {suppressions.length} {suppressions.length === 1 ? 'record' : 'records'}
            </span>
          )}
        </div>

        {suppressionsLoading ? (
          <Card className="p-6 animate-pulse space-y-3">
            <div className="h-4 w-48 bg-canvas-elevated rounded" />
            <div className="h-4 w-32 bg-canvas-elevated rounded" />
          </Card>
        ) : suppressionsError ? (
          <Card className="p-6 border-signal-failed/30 bg-signal-failed/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-signal-failed">Failed to load suppressions</p>
              <p className="text-xs text-text-muted mt-0.5">{suppressionsError}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadSuppressions}
              className="text-xs focus-visible:ring-2 focus-visible:ring-brand-loom"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry</span>
            </Button>
          </Card>
        ) : suppressions.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<ShieldAlert className="w-6 h-6 text-text-muted" />}
              title="No suppressed contacts yet"
              description="Opted-out or bounced recipient addresses are recorded as non-reversible hashes to prevent future sends."
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0 border border-border-subtle shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-canvas-surface/80 text-text-muted font-mono">
                    <th className="py-2.5 px-4 font-medium">Address hash</th>
                    <th className="py-2.5 px-4 font-medium">Reason</th>
                    <th className="py-2.5 px-4 font-medium">Source</th>
                    <th className="py-2.5 px-4 font-medium text-right">Added date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-sans">
                  {suppressions.map((s) => (
                    <tr key={s.id} className="hover:bg-canvas-elevated/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-text-primary">
                        <span className="bg-canvas-elevated border border-border-subtle px-2 py-0.5 rounded text-[11px] font-mono">
                          {s.hashPrefix}…
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">
                        {s.reason ? (
                          <Badge variant="subtle" className="text-[10px] font-mono">
                            {s.reason}
                          </Badge>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-text-secondary">
                        {s.source || <span className="text-text-muted">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-text-muted font-mono text-[11px]">
                        {new Date(s.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked View (no horizontal scroll at 390px) */}
            <div className="sm:hidden divide-y divide-border-subtle">
              {suppressions.map((s) => (
                <div key={s.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Address hash</span>
                    <span className="font-mono bg-canvas-elevated border border-border-subtle px-1.5 py-0.5 rounded text-[11px] text-text-primary">
                      {s.hashPrefix}…
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Reason</span>
                    <span className="text-text-secondary">
                      {s.reason ? (
                        <Badge variant="subtle" className="text-[10px] font-mono">
                          {s.reason}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Source</span>
                    <span className="text-text-secondary">{s.source || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Added date</span>
                    <span className="text-text-muted font-mono text-[11px]">
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
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
