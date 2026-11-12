'use client';

import React, { useState } from 'react';
import { Button } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import { Play, Pause } from 'lucide-react';
import { setCampaignStatus } from '../../lib/engine-client';

interface CampaignStatusButtonProps {
  campaignId: string;
  campaignName: string;
  status: string;
  onChanged: () => void;
}

/**
 * Campaign lifecycle control: Activate (from draft/paused) or Pause (from
 * active), with a confirm step. The server owns the transition rules
 * (steps + sender pool required to activate); its named reason is shown
 * verbatim when it refuses.
 */
export function CampaignStatusButton({ campaignId, campaignName, status, onChanged }: CampaignStatusButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const target = status === 'active' ? 'paused' : 'active';
  const label = status === 'active' ? 'Pause' : 'Activate';
  const Icon = status === 'active' ? Pause : Play;

  const run = async () => {
    setIsBusy(true);
    const res = await setCampaignStatus(campaignId, target);
    if (res.error) {
      notify.error(res.error);
    } else if (res.data?.status === 'active') {
      notify.success(`${campaignName} is active - its approved messages can dispatch when the send gate is on`);
    } else if (res.data?.status === 'paused') {
      notify.info(`${campaignName} is paused - dispatch stops until it is reactivated`);
    } else {
      notify.info(`${campaignName} is back to draft`);
    }
    setIsBusy(false);
    setConfirming(false);
    onChanged();
  };

  if (!confirming) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)} className="text-xs gap-1.5"
        title={status === 'active' ? 'Pause dispatch for this campaign' : 'Activate this campaign (requires steps and a sender pool)'}>
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="primary" onClick={run} disabled={isBusy} className="text-xs">
        {isBusy ? `${label.slice(0, -1)}ing...` : `Confirm ${label.toLowerCase()}`}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={isBusy} className="text-xs">
        Cancel
      </Button>
    </div>
  );
}
