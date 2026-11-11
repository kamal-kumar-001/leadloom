'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, Button, Badge } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import { Users, Upload, RefreshCw } from 'lucide-react';
import {
  fetchCampaignRecipients,
  importCampaignRecipients,
  type CampaignRecipientRow,
  type RecipientImportInput,
} from '../../lib/engine-client';

/**
 * Campaign recipients: the entry path into the per-campaign recipient store
 * that strict per-recipient message resolution reads. Paste one recipient per
 * line: email, first name, company (CSV, later columns optional).
 */
function parseCsv(text: string): { rows: RecipientImportInput[]; skipped: number } {
  const rows: RecipientImportInput[] = [];
  let skipped = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [email, firstName, companyName] = line.split(',').map((c) => c.trim());
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      skipped++;
      continue;
    }
    rows.push({ email, firstName: firstName || null, companyName: companyName || null });
  }
  return { rows, skipped };
}

export function CampaignRecipients({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [recipients, setRecipients] = useState<CampaignRecipientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchCampaignRecipients(campaignId);
    if (res.error) {
      notify.error(res.error);
    } else {
      setRecipients(res.data?.recipients ?? []);
    }
    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleImport = async () => {
    const { rows, skipped } = parseCsv(importText);
    if (rows.length === 0) {
      notify.error(skipped > 0 ? `No valid email lines (${skipped} skipped)` : 'Paste at least one recipient line');
      return;
    }
    setIsImporting(true);
    const res = await importCampaignRecipients(campaignId, rows);
    setIsImporting(false);
    if (res.error) {
      notify.error(res.error);
      return;
    }
    notify.success(
      `Imported ${res.data?.upserted ?? rows.length} recipient${rows.length === 1 ? '' : 's'}` +
        (skipped > 0 ? ` (${skipped} invalid line${skipped === 1 ? '' : 's'} skipped)` : ''),
    );
    setImportText('');
    await load();
  };

  return (
    <Card className="p-4 space-y-3 border-border-subtle">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-matrix" />
          <span className="text-xs font-semibold text-text-primary">Recipients: {campaignName}</span>
          <Badge variant="subtle" className="text-[10px] font-mono">
            {isLoading ? '...' : `${recipients.length} stored`}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={isLoading} className="text-xs gap-1">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      <p className="text-[11px] text-text-muted font-mono">
        One per line: email, first name, company. Template variables like {'{{name}}'} / {'{{company}}'} resolve from
        these values; a recipient missing a value a template needs stays held at review.
      </p>

      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder={'ada@acme.example, Ada, Acme Corp\nbob@globex.example, Bob, Globex'}
        rows={3}
        className="w-full rounded-md bg-canvas-elevated/40 border border-border-subtle p-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-loom"
      />
      <div className="flex justify-end">
        <Button size="sm" variant="primary" onClick={handleImport} disabled={isImporting || !importText.trim()} className="text-xs gap-1.5">
          <Upload className="w-3 h-3" />
          <span>{isImporting ? 'Importing...' : 'Import recipients'}</span>
        </Button>
      </div>

      {recipients.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border-subtle divide-y divide-border-subtle">
          {recipients.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
              <span className="font-mono text-text-primary truncate">{r.email}</span>
              <span className="text-text-muted truncate ml-3">
                {[r.firstName, r.companyName].filter(Boolean).join(' - ') || 'no name/company on file'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
