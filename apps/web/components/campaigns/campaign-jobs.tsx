'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, Button, Badge } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import { RefreshCw } from 'lucide-react';
import { fetchCampaignJobs, type CampaignJobRow } from '../../lib/engine-client';

/**
 * Per-recipient job drill-down: the queue rows the scheduler holds for one
 * campaign, with status, schedule and attempt counts. Metadata only - step
 * bodies and provider ids stay server-side.
 */
function fmt(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

export function CampaignJobs({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [jobs, setJobs] = useState<CampaignJobRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchCampaignJobs(campaignId);
    if (res.error) {
      notify.error(res.error);
    } else {
      setJobs(res.data?.jobs ?? []);
    }
    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Jobs in {campaignName}</h2>
          <p className="text-[11px] text-text-muted font-mono mt-0.5">
            Scheduled and dispatched steps per recipient. Newest activity first; the 100 most recent jobs.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={isLoading} className="text-xs gap-1.5">
          <RefreshCw className="w-3 h-3" />
          <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
        </Button>
      </div>

      {jobs.length > 0 ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border-subtle divide-y divide-border-subtle">
          <div className="grid grid-cols-[1.4fr_auto_auto_1fr_auto_1fr] gap-4 px-3 py-1.5 text-[10px] uppercase tracking-wide text-text-muted font-mono">
            <span>Recipient</span>
            <span>Step</span>
            <span>Status</span>
            <span>Scheduled</span>
            <span>Attempts</span>
            <span>Updated</span>
          </div>
          {jobs.map((j) => (
            <div key={j.id} className="grid grid-cols-[1.4fr_auto_auto_1fr_auto_1fr] gap-4 px-3 py-1.5 text-xs">
              <span className="font-mono text-text-primary break-all">{j.recipientEmail}</span>
              <span className="text-text-secondary">{j.stepNumber}</span>
              <span>
                <Badge variant={j.status === 'sent' ? 'verified' : j.status === 'failed' ? 'muted' : 'subtle'} className="text-[10px] font-mono">
                  {j.status.toUpperCase()}
                </Badge>
              </span>
              <span className="text-text-secondary">{fmt(j.scheduledAt)}</span>
              <span className="text-text-secondary">{j.attempts}</span>
              <span className="text-text-secondary">{fmt(j.updatedAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-full min-h-24 rounded-lg border border-dashed border-border-subtle flex items-center justify-center">
          <span className="text-xs text-text-muted">{isLoading ? 'Loading...' : 'No jobs scheduled for this campaign yet'}</span>
        </div>
      )}
    </Card>
  );
}
