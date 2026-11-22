'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, Button } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import { AtSign, RefreshCw } from 'lucide-react';
import {
  fetchWorkspaceMailboxes,
  fetchCampaignMailboxPool,
  setCampaignMailboxPool,
  type WorkspaceMailboxRow,
} from '../../lib/engine-client';

/**
 * Sender pool for one campaign: which connected mailboxes may send its
 * messages. Saving replaces the whole pool. A campaign with an empty pool
 * cannot have its messages approved for sending (server-enforced).
 */
export function CampaignSenders({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [mailboxes, setMailboxes] = useState<WorkspaceMailboxRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expected,setExpected]=useState<string[]|null>(null);
  const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);setError(null);setNotice(null);setExpected(null);
    const [all, pool] = await Promise.all([fetchWorkspaceMailboxes(), fetchCampaignMailboxPool(campaignId)]);
    if (all.error) {notify.error(all.error);setError(all.error);}
    else setMailboxes(all.data ?? []);
    if (pool.error) {notify.error(pool.error);setError(pool.error);}
    else {const ids=(pool.data??[]).map(m=>m.id);setSelected(new Set(ids));if(!all.error)setExpected(ids);}
    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if(expected===null)return;setError(null);setNotice(null);setIsSaving(true);
    const res = await setCampaignMailboxPool(campaignId, Array.from(selected),expected);
    if (res.error) {
      notify.error(res.error);setError(res.error);
    } else {
      const ids=(res.data??[]).map(m=>m.id);setExpected(ids);setSelected(new Set(ids));
      setNotice((res.unchanged?'Saved pool already matches. ':'Sender pool saved. ')+(res.invalidatedCount??0)+' held or released messages returned to review. '+(res.reservedCount??0)+' messages already reserved may be in flight and were not recalled.');
      const count = res.data?.length ?? 0;
      if (count === 0) {
        notify.info(`Sender pool cleared for ${campaignName} - its messages cannot be approved until a sender is assigned`);
      } else {
        notify.success(`Sender pool saved for ${campaignName}: ${count} mailbox${count === 1 ? '' : 'es'}`);
      }
    }
    setIsSaving(false);
  };

  return (
    <Card className="p-5 space-y-4" data-testid="campaign-senders">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AtSign className="w-4 h-4 text-brand-matrix" />
          <h3 className="text-xs font-semibold text-text-primary">Sender pool for {campaignName}</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={isLoading||isSaving} className="text-xs gap-1.5">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Discard selection and reload</span>
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        Only checked mailboxes may send this campaign&apos;s messages. Saving replaces the whole pool.
        An empty pool blocks message approval. A changed pool returns held and released-but-unreserved messages to review. Already reserved messages may be in flight and cannot be recalled here. Stale selections cannot overwrite another saved pool.
      </p>
      {isLoading ? (
        <p className="text-xs text-text-muted">Loading mailboxes...</p>
      ) : mailboxes.length === 0 ? (
        <p className="text-xs text-text-muted">
          No mailboxes connected in this workspace. Connect one under Mailboxes before assigning a sender pool.
        </p>
      ) : (
        <ul className="space-y-2">
          {mailboxes.map((mb) => (
            <li key={mb.id}>
              <label className="flex items-center gap-2.5 text-xs text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  aria-label={'Allow sender '+mb.email}
                  checked={selected.has(mb.id)}
                  onChange={() => toggle(mb.id)}
                  disabled={isSaving||isLoading||expected===null}
                  className="accent-current"
                />
                <span className="font-mono">{mb.email}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error&&<p role="alert" className="text-xs text-signal-failed">{error}</p>}{notice&&<p role="status" className="text-xs text-signal-verified">{notice}</p>}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" variant="primary" onClick={save} disabled={isLoading || isSaving||expected===null} className="text-xs">
          {isSaving ? 'Saving...' : 'Save sender pool'}
        </Button>
      </div>
    </Card>
  );
}
