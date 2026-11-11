'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, EmptyState } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import {
  fetchApprovalQueue,
  approveOutboundJobs,
  rejectOutboundJobs,
  type OutboundApprovalRow,
  type ApprovalQueueStats,
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
  const [bulkLoading, setBulkLoading] = useState<'approve' | 'reject' | null>(null);

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

  const handleBulkApprove = async () => {
    setBulkLoading('approve');
    try {
      const res = await approveOutboundJobs({ all: true, campaignId });
      if (res.error) {
        notify.error(res.error);
      } else {
        notify.success(
          `Approved and held ${res.approvedCount ?? 0} messages (sending stays disabled)` +
            ((res.staleCount ?? 0) > 0 ? `; ${res.staleCount} changed since queueing and still need review` : ''),
        );
        await loadQueue();
        onStatusChange?.();
      }
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Batch approval failed');
    } finally {
      setBulkLoading(null);
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

              <Button
                size="sm"
                variant="primary"
                onClick={handleBulkApprove}
                disabled={Boolean(bulkLoading) || Boolean(actionLoadingId)}
                className="text-xs gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{bulkLoading === 'approve' ? 'Approving...' : 'Approve All'}</span>
              </Button>
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
            Approving signs off the exact recipient, wording and sender context shown here and holds the message as approved. Approved messages do not become schedulable and no external mail server calls are made. If the campaign content changes after approval, the approval is withdrawn and the message returns here for review.
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
                  {item.bodySnippet && (
                    <div className="p-2.5 rounded bg-canvas-elevated/40 border border-border-subtle text-text-secondary italic text-xs leading-relaxed">
                      &ldquo;{item.bodySnippet}&rdquo;
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
                      disabled={isActing || Boolean(bulkLoading)}
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
