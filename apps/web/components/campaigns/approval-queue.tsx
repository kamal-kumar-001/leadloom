'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, EmptyState } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import {
  fetchApprovalQueue,
  approveOutboundJobs,
  rejectOutboundJobs,
  setApprovalSenderMailbox,
  fetchWorkspaceMailboxes,
  type OutboundApprovalRow,
  type ApprovalQueueStats,
  type WorkspaceMailboxRow,
} from '../../lib/engine-client';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Mail,
  Check,
  X,
  Info,
  Calendar,
} from 'lucide-react';

interface ApprovalQueueProps {
  campaignId?: string;
  onStatusChange?: () => void;
}

/** Per-message sender pin: rotate across the campaign's current pool, or pin to one mailbox from it. */
function SenderPinSelect({
  item,
  mailboxes,
  isUpdating,
  onChange,
}: {
  item: OutboundApprovalRow;
  mailboxes: WorkspaceMailboxRow[];
  isUpdating: boolean;
  onChange: (jobId: string, mailboxId: string | null) => void;
}) {
  const pool = item.availableMailboxIds ?? item.senderMailboxIds ?? [];
  if (pool.length === 0)
    return <span className="text-text-secondary">no sender mailboxes assigned to this campaign</span>;
  return (
    <select
      data-job-id={item.id}
      value={item.senderMailboxId ?? ''}
      disabled={isUpdating}
      onChange={(e) => onChange(item.id, e.target.value || null)}
      className="bg-canvas border border-border-subtle rounded-md px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-brand-loom disabled:opacity-50"
    >
      <option value="">
        Rotate across {pool.length} assigned mailbox{pool.length === 1 ? '' : 'es'}
      </option>
      {pool.map((id) => (
        <option key={id} value={id}>
          Pin to {mailboxes.find((m) => m.id === id)?.email ?? `${id.slice(0, 8)}...`}
        </option>
      ))}
    </select>
  );
}

export function ApprovalQueue({ campaignId, onStatusChange }: ApprovalQueueProps) {
  const [items, setItems] = useState<OutboundApprovalRow[]>([]);
  const [stats, setStats] = useState<ApprovalQueueStats>({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState<'reject' | null>(null);
  const [mailboxes, setMailboxes] = useState<WorkspaceMailboxRow[]>([]);
  const [senderLoadingId, setSenderLoadingId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchApprovalQueue(campaignId);
      if (res.data) {
        setItems(res.data.items);
        setStats(res.data.stats);
      } else {
        setError(res.error || 'Failed to load approval queue');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Engine connection failed');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    // Mailbox identities for the per-message sender selector (pool membership comes from each item).
    fetchWorkspaceMailboxes().then((res) => {
      if (res.data) setMailboxes(res.data);
    });
  }, []);

  const handleSenderChange = async (jobId: string, mailboxId: string | null) => {
    setSenderLoadingId(jobId);
    const res = await setApprovalSenderMailbox(jobId, mailboxId);
    setSenderLoadingId(null);
    if (res.error || !res.updated) {
      notify.error(res.error || 'Sender could not be updated');
      return;
    }
    notify.success(mailboxId ? 'Sender pinned - review and approve to sign off the pinned sender' : 'Sender back to pool rotation - review and approve to sign off');
    await loadQueue();
  };

  const handleApproveOne = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const res = await approveOutboundJobs({ jobIds: [jobId] });
      if (res.error) {
        notify.error(res.error);
      } else if ((res.approvedCount ?? 0) === 0 && (res.staleCount ?? 0) > 0) {
        notify.info('Content changed since this message was queued - review the updated text, then approve again');
        await loadQueue();
        onStatusChange?.();
      } else {
        notify.success('Message approved and held (sending stays disabled)');
        await loadQueue();
        onStatusChange?.();
      }
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectOne = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const res = await rejectOutboundJobs({ jobIds: [jobId] });
      if (res.error) {
        notify.error(res.error);
      } else {
        notify.info('Message rejected and excluded from sequence');
        await loadQueue();
        onStatusChange?.();
      }
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkReject = async () => {
    setBulkLoading('reject');
    try {
      const res = await rejectOutboundJobs({ all: true, campaignId });
      if (res.error) {
        notify.error(res.error);
      } else {
        notify.info(`Rejected ${res.rejectedCount} messages`);
        await loadQueue();
        onStatusChange?.();
      }
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Batch rejection failed');
    } finally {
      setBulkLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-loom/10 border border-brand-loom/30 flex items-center justify-center text-brand-loom">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary tracking-tight">
                Approval-Before-Send Queue
              </h2>
              <Badge variant="matrix" className="text-[10px] font-mono">
                G9 Active
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Human signs off on recipients and copy before dispatch. Replies halt the sequence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={loadQueue}
            disabled={isLoading || Boolean(actionLoadingId) || Boolean(bulkLoading)}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {items.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkReject}
                disabled={Boolean(bulkLoading) || Boolean(actionLoadingId)}
                className="text-xs gap-1.5 text-signal-failed border-signal-failed/30 hover:bg-signal-failed/10"
              >
                <X className="w-3.5 h-3.5" />
                <span>{bulkLoading === 'reject' ? 'Rejecting...' : 'Reject All'}</span>
              </Button>

              {/* No Approve All: every approval must follow a human reading the exact recipient, wording and sender context on the item. */}
            </>
          )}
        </div>
      </div>

      {/* Honest Sending Safety Banner */}
      <div className="p-3.5 rounded-lg border border-brand-loom/25 bg-brand-loom/5 text-xs text-text-secondary flex items-start gap-2.5">
        <Info className="w-4 h-4 text-brand-loom shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-text-primary">
            Outreach dispatch is disabled system-wide
          </p>
          <p className="text-text-muted">
            Approving signs off the exact recipient, wording and sender context shown on the item and holds the message as approved. Approved messages do not become schedulable and no external mail server calls are made. Approval re-checks the current campaign content at click time: if anything changed since the message was queued, the approval is not recorded and you review the updated text instead. Campaign editing is not available yet; when it ships, edits must invalidate existing approvals before they can be released.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-text-muted">AWAITING REVIEW</span>
            <p className="text-lg font-bold text-text-primary font-mono">{stats.pendingCount}</p>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-signal-pending animate-pulse" />
        </Card>

        <Card className="p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-text-muted">APPROVED (HELD)</span>
            <p className="text-lg font-bold text-text-primary font-mono">{stats.approvedCount}</p>
          </div>
          <CheckCircle2 className="w-4 h-4 text-signal-verified" />
        </Card>

        <Card className="p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-text-muted">REJECTED</span>
            <p className="text-lg font-bold text-text-primary font-mono">{stats.rejectedCount}</p>
          </div>
          <XCircle className="w-4 h-4 text-signal-failed" />
        </Card>
      </div>

      {/* Queue Body */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="p-5 animate-pulse space-y-3">
              <div className="h-4 w-48 bg-canvas-elevated rounded" />
              <div className="h-3 w-64 bg-canvas-elevated rounded" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-5 border-signal-failed/30 bg-signal-failed/5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-signal-failed">Failed to load approval queue</p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadQueue} className="text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Retry</span>
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<CheckCircle2 className="w-6 h-6 text-signal-verified" />}
            title="Approval queue is clear"
            description="No messages are awaiting review. When leads and sequences are generated, they will queue here for your explicit sign-off before dispatch."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isActing = actionLoadingId === item.id;
            return (
              <Card
                key={item.id}
                className="p-4 hover:border-border-muted transition-all shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-brand-loom shrink-0" />
                    <span className="text-sm font-semibold text-text-primary font-mono truncate">
                      {item.recipientEmail}
                    </span>
                    <Badge variant="subtle" className="text-[10px] font-mono shrink-0">
                      Step {item.stepNumber}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] font-mono text-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <span className="text-[11px] font-mono text-text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(item.scheduledAt).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="text-text-muted font-mono text-[11px]">
                    Campaign: <span className="text-text-secondary font-sans font-medium">{item.campaignName}</span>
                  </div>
                  {item.subject && (
                    <div className="font-medium text-text-primary">
                      Subject: <span className="font-sans font-normal">{item.subject}</span>
                    </div>
                  )}
                  {item.bodyTemplate ? (
                    <details className="rounded bg-canvas-elevated/40 border border-border-subtle text-xs leading-relaxed">
                      <summary className="cursor-pointer select-none p-2.5 text-text-secondary">
                        <span className="italic">&ldquo;{item.bodySnippet}&rdquo;</span>
                        <span className="ml-2 text-[10px] font-mono text-text-muted">click to review full text</span>
                      </summary>
                      <pre className="whitespace-pre-wrap font-sans not-italic p-2.5 pt-0 text-text-secondary">{item.bodyTemplate}</pre>
                    </details>
                  ) : item.bodySnippet ? (
                    <div className="p-2.5 rounded bg-canvas-elevated/40 border border-border-subtle text-text-secondary italic text-xs leading-relaxed">
                      &ldquo;{item.bodySnippet}&rdquo;
                    </div>
                  ) : null}
                  <div className="text-text-muted font-mono text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Sender:</span>
                    <SenderPinSelect
                      item={item}
                      mailboxes={mailboxes}
                      isUpdating={senderLoadingId === item.id}
                      onChange={handleSenderChange}
                    />
                  </div>
                  {item.stale && (
                    <div className="text-[11px] font-mono text-signal-pending">
                      Content changed since this message was queued. The first approval only refreshes the review snapshot; a second approval signs it off.
                    </div>
                  )}
                  {item.resolutionErrors && item.resolutionErrors.length > 0 && (
                    <div className="text-[11px] font-mono text-signal-failed rounded border border-signal-failed/40 bg-signal-failed/10 p-2 space-y-0.5">
                      <div>Held: this message cannot be assembled for the recipient. Approving is blocked until fixed:</div>
                      {item.resolutionErrors.map((err, i) => (
                        <div key={i} className="pl-2">- {err}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-signal-pending">
                    <span className="w-2 h-2 rounded-full bg-signal-pending animate-pulse" />
                    <span>Awaiting human approval</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectOne(item.id)}
                      disabled={isActing || Boolean(bulkLoading)}
                      className="text-xs h-7 px-2.5 text-signal-failed border-signal-failed/30 hover:bg-signal-failed/10 gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleApproveOne(item.id)}
                      disabled={isActing || Boolean(bulkLoading) || (item.resolutionErrors?.length ?? 0) > 0}
                      title={(item.resolutionErrors?.length ?? 0) > 0 ? 'Held: fix the template or recipient so the message can be assembled' : undefined}
                      className="text-xs h-7 px-2.5 gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Approve</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
