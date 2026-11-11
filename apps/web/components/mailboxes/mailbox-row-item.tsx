'use client';

import React, { useState } from 'react';
import { Card, Badge, Button } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import {
  WorkspaceMailboxRow,
  testMailboxConnection,
  deleteMailbox,
} from '../../lib/engine-client';
import { ConfirmDialog } from '../feedback/confirm-dialog';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface MailboxRowItemProps {
  mailbox: WorkspaceMailboxRow;
  isAdmin: boolean;
  onRefresh: () => void;
}

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

function renderConnectionBadge(status?: string | null, errorCode?: string | null) {
  const s = (status || '').toLowerCase();
  if (s === 'ok' || s === 'connected' || s === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-signal-verified/15 text-signal-verified border border-signal-verified/30">
        <CheckCircle2 className="w-3 h-3" />
        <span>Login verified</span>
      </span>
    );
  }
  if (s === 'failed') {
    return (
      <span
        title={errorCode ? `Error code: ${errorCode}` : 'Connection test failed'}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-signal-failed/15 text-signal-failed border border-signal-failed/30"
      >
        <AlertCircle className="w-3 h-3" />
        <span>Failed{errorCode ? `: ${errorCode}` : ''}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-canvas-elevated text-text-muted border border-border-subtle">
      <Clock className="w-3 h-3" />
      <span>Never checked</span>
    </span>
  );
}

export function MailboxRowItem({
  mailbox: m,
  isAdmin,
  onRefresh,
}: MailboxRowItemProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const quotaPercent =
    m.dailySendLimit > 0
      ? Math.min(100, Math.round((m.sentToday / m.dailySendLimit) * 100))
      : 0;

  async function handleTestConnection() {
    if (isTesting) return;
    setIsTesting(true);
    try {
      const res = await testMailboxConnection(m.id);
      if (res.data) {
        notify.success('Connection test passed: login verified. No email was sent.');
        onRefresh();
      } else {
        notify.error(res.error || 'Connection test failed.');
        onRefresh();
      }
    } catch {
      notify.error('Failed to run connection test.');
    } finally {
      setIsTesting(false);
    }
  }

  async function handleRemoveConfirm() {
    if (isRemoving) return;
    setIsRemoving(true);
    try {
      const res = await deleteMailbox(m.id);
      if (res.success) {
        notify.success('Mailbox removed.');
        setIsRemoveConfirmOpen(false);
        onRefresh();
      } else {
        notify.error(res.error || 'Failed to remove mailbox.');
      }
    } catch {
      notify.error('Network error removing mailbox.');
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Card className="p-5 hover:border-border-muted transition-all shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Mailbox Identity & Status */}
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
              {m.authType && (
                <Badge variant="subtle" className="text-[10px] font-mono">
                  {m.authType}
                </Badge>
              )}
              {renderConnectionBadge(m.connectionStatus, m.connectionErrorCode)}
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-canvas-elevated text-text-secondary border border-border-subtle">
                Health: {m.healthScore > 0 ? `${m.healthScore}/100` : '—'}
              </span>
            </div>

            {/* DNS Status (not claimed from password connect) */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {renderDnsChip('SPF', m.spfStatus)}
              {renderDnsChip('DKIM', m.dkimStatus)}
              {renderDnsChip('DMARC', m.dmarcStatus)}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-text-muted font-mono">
              <span>
                Last login check:{' '}
                {m.connectionCheckedAt
                  ? new Date(m.connectionCheckedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Never checked'}
              </span>
              <span>•</span>
              <span>
                Last DNS health check:{' '}
                {m.lastHealthCheckAt
                  ? new Date(m.lastHealthCheckAt).toLocaleDateString()
                  : 'Never checked'}
              </span>
            </div>
          </div>
        </div>

        {/* Quota Progress & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:justify-end">
          <div className="text-left sm:text-right">
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

          {/* Admin Controls */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="text-xs py-1.5 gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing...' : 'Test connection'}</span>
              </Button>

              <button
                type="button"
                onClick={() => setIsRemoveConfirmOpen(true)}
                title="Remove mailbox"
                className="p-2 rounded-lg text-text-muted hover:text-signal-failed hover:bg-signal-failed/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-failed"
                aria-label={`Remove mailbox ${m.email}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isRemoveConfirmOpen}
        title="Remove Mailbox"
        description={`Are you sure you want to remove ${m.email}? This will remove the mailbox and delete its stored credentials from Leadloom.`}
        confirmLabel="Remove Mailbox"
        cancelLabel="Keep Mailbox"
        variant="danger"
        isLoading={isRemoving}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setIsRemoveConfirmOpen(false)}
      />
    </Card>
  );
}
