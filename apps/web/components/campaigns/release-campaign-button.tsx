'use client';

import React, { useState } from 'react';
import { Button } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import { Unlock } from 'lucide-react';
import { releaseCampaign } from '../../lib/engine-client';

interface ReleaseCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  onReleased: () => void;
}

/**
 * Gated release for one campaign: moves reviewed 'approved' messages to the
 * send-reservable queue. Blocked server-side when the send gate is off; the
 * toast reports the real outcome from the API, never a promise.
 */
export function ReleaseCampaignButton({ campaignId, campaignName, onReleased }: ReleaseCampaignButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const run = async () => {
    setIsReleasing(true);
    try {
      const res = await releaseCampaign(campaignId);
      if (res.error) {
        notify.error(res.error);
      } else if (res.released > 0 && res.sendingEnabled) {
        notify.success(`Released ${res.released} approved message${res.released === 1 ? '' : 's'} for sending in ${campaignName}`);
      } else if (res.released > 0) {
        notify.info(`Released ${res.released} message${res.released === 1 ? '' : 's'}, but sending is disabled by the server gate`);
      } else if (!res.sendingEnabled) {
        notify.info('Sending stays disabled - the server send gate blocks release');
      } else {
        notify.info('No approved messages waiting to release for this campaign');
      }
      onReleased();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Release failed');
    } finally {
      setIsReleasing(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)} className="text-xs gap-1.5" title="Move approved, reviewed messages to the send queue (blocked while the send gate is off)">
        <Unlock className="w-3.5 h-3.5" />
        <span>Release</span>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="primary" onClick={run} disabled={isReleasing} className="text-xs">
        {isReleasing ? 'Releasing...' : 'Confirm release'}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={isReleasing} className="text-xs">
        Cancel
      </Button>
    </div>
  );
}
