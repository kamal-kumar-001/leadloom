'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, EmptyState } from '@leadloom/ui';
import {
  fetchWorkspaceMailboxes,
  fetchWorkspaceSuppressions,
  fetchMailboxPresets,
  fetchAuthMe,
  type WorkspaceMailboxRow,
  type WorkspaceSuppressionRow,
  type MailboxPreset,
} from '../../../lib/engine-client';
import {
  MailboxRowItem,
  ConnectMailboxDialog,
  UnbuiltProvidersCard,
} from '../../../components/mailboxes';
import {
  Mail,
  ShieldAlert,
  RefreshCw,
  Plus,
  Info,
} from 'lucide-react';

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState<WorkspaceMailboxRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [suppressions, setSuppressions] = useState<WorkspaceSuppressionRow[]>([]);
  const [suppressionsLoading, setSuppressionsLoading] = useState(true);
  const [suppressionsError, setSuppressionsError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [presets, setPresets] = useState<MailboxPreset[]>([]);
  const [isConnectFeatureEnabled, setIsConnectFeatureEnabled] = useState(true);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);

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

  const loadPresetsAndUser = useCallback(async () => {
    try {
      const [meRes, presetsRes] = await Promise.all([
        fetchAuthMe(),
        fetchMailboxPresets(),
      ]);

      if (meRes.data) {
        const role = meRes.data.role;
        setIsAdmin(role === 'admin' || role === 'owner');
      }

      if (presetsRes.unavailable) {
        setIsConnectFeatureEnabled(false);
        setPresets([]);
      } else if (presetsRes.data) {
        setIsConnectFeatureEnabled(true);
        setPresets(presetsRes.data);
      }
    } catch {
      // Degrade gracefully if metadata endpoint errors
      setIsConnectFeatureEnabled(false);
    }
  }, []);

  const handleRefreshAll = useCallback(() => {
    loadMailboxes();
    loadSuppressions();
    loadPresetsAndUser();
  }, [loadMailboxes, loadSuppressions, loadPresetsAndUser]);

  useEffect(() => {
    loadMailboxes();
    loadSuppressions();
    loadPresetsAndUser();
  }, [loadMailboxes, loadSuppressions, loadPresetsAndUser]);

  const totalSendLimit = mailboxes.reduce((acc, m) => acc + (m.dailySendLimit || 0), 0);
  const totalSentToday = mailboxes.reduce((acc, m) => acc + (m.sentToday || 0), 0);
  const activeCount = mailboxes.filter((m) => !m.isPaused).length;
  const checked = mailboxes.filter((m) => m.lastHealthCheckAt);
  const avgHealth =
    checked.length > 0
      ? `${Math.round(checked.reduce((acc, m) => acc + (m.healthScore || 0), 0) / checked.length)}%`
      : '—';
  const pausedCount = mailboxes.length - activeCount;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Outbound Mailbox Pool
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Mailboxes, sender health and the suppression list for this workspace.
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

          {isConnectFeatureEnabled ? (
            isAdmin ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsConnectDialogOpen(true)}
                className="text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Connect a mailbox</span>
              </Button>
            ) : null
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Mailbox connection is not enabled on this server"
              className="text-xs gap-1.5"
            >
              <span>Connect a mailbox: not available yet</span>
            </Button>
          )}
        </div>
      </div>

      {/* Honest Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-text-muted">Mailboxes</div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {isLoading ? '—' : mailboxes.length}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {activeCount} not paused
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted">Configured daily limit</div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {isLoading ? '—' : `${totalSendLimit}/day`}
          </div>
          <div className="text-[11px] text-text-muted mt-1">Sum of configured limits. Sending is not enabled; sent so far: {totalSentToday}</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted">Average Health Score</div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {isLoading ? '—' : avgHealth}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {checked.length > 0
              ? `${checked.length} checked mailbox${checked.length === 1 ? '' : 'es'}`
              : 'No health check has run yet'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted">Paused Mailboxes</div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {isLoading ? '—' : pausedCount}
          </div>
          <div className="text-[11px] text-text-muted mt-1">Not used for sending</div>
        </Card>
      </div>

      {/* Feature Flag Notice if Disabled on Host */}
      {!isConnectFeatureEnabled && (
        <Card className="p-4 bg-canvas-surface border-border-subtle flex items-start gap-3">
          <Info className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
          <div className="text-xs text-text-muted leading-relaxed">
            <span className="font-semibold text-text-secondary block mb-0.5">
              Mailbox connection is not enabled on this server
            </span>
            Connecting IMAP/SMTP mailboxes requires the{' '}
            <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-canvas-elevated border border-border-subtle">
              LEADLOOM_MAILBOX_CONNECT_ENABLED
            </code>{' '}
            engine flag. Existing mailboxes and suppressions remain accessible.
          </div>
        </Card>
      )}

      {/* Mailbox List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Sender Health & Connection Status
          </h2>
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
              <p className="text-sm font-medium text-signal-failed">
                Failed to load workspace mailboxes
              </p>
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
              title="No mailboxes connected yet"
              description="Connect an IMAP/SMTP sender to verify and store the login. Sending is not enabled yet."
              action={
                isAdmin && isConnectFeatureEnabled ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsConnectDialogOpen(true)}
                    className="text-xs gap-1.5 mt-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Connect a mailbox</span>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          mailboxes.map((m) => (
            <MailboxRowItem
              key={m.id}
              mailbox={m}
              isAdmin={isAdmin}
              onRefresh={loadMailboxes}
            />
          ))
        )}
      </div>

      {/* Unbuilt Providers & Roadmap */}
      <UnbuiltProvidersCard />

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
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-canvas-elevated border border-border-subtle text-text-secondary">
                            {s.reason}
                          </span>
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
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-canvas-elevated border border-border-subtle text-text-secondary">
                          {s.reason}
                        </span>
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

      {/* Connect Mailbox Dialog */}
      <ConnectMailboxDialog
        isOpen={isConnectDialogOpen}
        presets={presets}
        onClose={() => setIsConnectDialogOpen(false)}
        onSuccess={loadMailboxes}
      />
    </div>
  );
}
