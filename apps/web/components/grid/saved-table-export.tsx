'use client';
import React from 'react';
import { Button } from '@leadloom/ui';
import { downloadCsv } from '../../lib/csv-export';
export function SavedTableExport({ tableId }: { tableId: string }) {
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
  return <div className="space-y-1"><Button size="sm" variant="outline" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/engine/workspace/tables/' + encodeURIComponent(tableId) + '/export', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw Error(body.error || 'Table export failed. No partial export was created.'); }
      if (!response.headers.get('content-type')?.startsWith('text/csv')) throw Error('Unexpected export format. No file was downloaded.');
      downloadCsv(await response.text(), 'leadloom-table-' + tableId + '.csv');
    } catch (e) { setError(e instanceof Error ? e.message : 'Table export failed.'); }
    finally { setBusy(false); }
  }}>{busy ? 'Preparing CSV...' : 'Export saved table CSV'}</Button>
  <p className="text-[11px] text-text-muted">All saved rows in one snapshot, not just this page. Up to 5,000 rows / 100 columns / 100,000 cells / 2 MB of values. Formula-like cells receive a safety apostrophe.</p>
  {error && <p role="alert" className="text-xs text-signal-failed">{error}</p>}</div>;
}
