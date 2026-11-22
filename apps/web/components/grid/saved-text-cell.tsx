'use client';
import React from 'react';
import { engineFetch } from '../../lib/engine-client';

export function SavedTextCell({ tableId, rowId, columnId, columnName, value, editable, onSaved }: { tableId: string; rowId: string; columnId: string; columnName: string; value: unknown; editable: boolean; onSaved: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [expected, setExpected] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const text = value === true ? 'yes' : value === false ? 'no' : value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (!editable || (value != null && typeof value !== 'string')) return <span title={text}>{text}</span>;
  async function save() {
    setBusy(true); setError(null);
    const result = await engineFetch(`/workspace/tables/${tableId}/cells`, { method: 'PATCH', body: JSON.stringify({ rowId, columnId, expectedValue: expected, value: draft }) });
    if (!mounted.current) return;
    setBusy(false);
    if (result.error || !result.data) { setError(result.error || 'Cell save was not confirmed. Keep your edit and reload before retrying.'); return; }
    setEditing(false); onSaved();
  }
  if (!editing) return <button type="button" aria-label={'Edit ' + columnName + ' in row ' + rowId} className="block w-full text-left min-h-5 truncate hover:underline" title={text || 'Edit empty text cell'} onClick={() => { setDraft(text); setExpected(typeof value === 'string' ? value : null); setError(null); setEditing(true); }}>{text || <span className="text-text-muted">Empty, edit</span>}</button>;
  return <div className="min-w-[240px] whitespace-normal space-y-2" data-testid="saved-cell-editor">
    <textarea aria-label={'New value for ' + columnName} maxLength={10000} rows={3} value={draft} disabled={busy} onChange={e => setDraft(e.target.value)} className="w-full p-2 rounded border border-border-muted bg-canvas-elevated text-text-primary" />
    {error && <p role="alert" className="text-signal-failed text-xs">{error}</p>}
    <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => void save()} className="text-brand-loom underline">{busy ? 'Saving cell...' : 'Save cell'}</button><button type="button" disabled={busy} onClick={() => setEditing(false)} className="text-text-muted underline">Cancel edit</button></div>
  </div>;
}
