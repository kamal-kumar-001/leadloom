import { describe, it, expect } from 'vitest';
import { refreshBoundCells, mergeRefreshedCells, type CellRefreshBinding } from '../waterfall-cell-refresh';
import type { WorkspaceTableRows } from '../engine-client';
import type { WaterfallCellPayload } from '@leadloom/contracts';

/**
 * D3 read/refresh seam, tested with LOCAL FIXTURES ONLY (injected fetch).
 * Proves binding discipline: only the rows bound at dispatch are read out,
 * missing/invalid payloads are reported rather than invented, and a failed
 * fetch mutates nothing.
 */

const PAYLOAD: WaterfallCellPayload = {
  value: 'ada@northstar.example',
  status: 'success',
  trace: [
    { step: 1, provider: 'apollo', status: 'hit', latency_ms: 210, cost_microcents: 100, reason: 'Match found' },
  ],
  telemetry: { provider_attributed: 'apollo', tier: 1, latency_ms: 210, cost_microcents: 100 },
};

const BINDING: CellRefreshBinding = {
  tableId: 'table-1',
  rowIds: ['row-a', 'row-b', 'row-c'],
  columnName: 'Work Email',
};

function tableRows(rows: WorkspaceTableRows['rows']): { data: WorkspaceTableRows; error?: undefined } {
  return {
    data: {
      table: { id: 'table-1', name: 'Leads', rowCount: rows.length },
      columns: [{ id: 'col-1', name: 'Work Email', type: 'waterfall' }],
      rows,
    },
  };
}

describe('refreshBoundCells (mocked fetch)', () => {
  it('returns parsed payloads for bound rows and reports the rest, touching nothing else', async () => {
    const result = await refreshBoundCells(BINDING, async () =>
      tableRows([
        { rowId: 'row-a', values: { 'Work Email': PAYLOAD } },
        { rowId: 'row-b', values: { 'Work Email': 'not-a-payload' } },
        // row-c absent from the response entirely
        { rowId: 'row-UNBOUND', values: { 'Work Email': PAYLOAD } },
      ])
    );
    expect(result.kind).toBe('refreshed');
    if (result.kind !== 'refreshed') return;
    expect(result.cells).toEqual([{ rowId: 'row-a', payload: PAYLOAD }]);
    expect(result.missingRowIds).toEqual(['row-b', 'row-c']);
    // The unbound row is never returned, even though it has a valid payload.
    expect(result.cells.some((c) => c.rowId === 'row-UNBOUND')).toBe(false);
  });

  it('reports a failed fetch without inventing cells', async () => {
    const result = await refreshBoundCells(BINDING, async () => ({ data: null, error: 'Engine unreachable' }));
    expect(result).toEqual({ kind: 'failed', message: 'Engine unreachable' });
  });

  it('reports a null body with a fallback message', async () => {
    const result = await refreshBoundCells(BINDING, async () => ({ data: null }));
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') expect(result.message.length).toBeGreaterThan(0);
  });

  it('returns an empty refresh (not a failure) when every bound row is missing', async () => {
    const result = await refreshBoundCells(BINDING, async () => tableRows([]));
    expect(result.kind).toBe('refreshed');
    if (result.kind !== 'refreshed') return;
    expect(result.cells).toEqual([]);
    expect(result.missingRowIds).toEqual(['row-a', 'row-b', 'row-c']);
  });
});


describe('mergeRefreshedCells', () => {
  const base = tableRows([
    { rowId: 'row-a', values: { 'Work Email': PAYLOAD, Name: 'Ada' } },
    { rowId: 'row-b', values: { 'Work Email': 'pending legacy import', Name: 'Grace' } },
    { rowId: 'row-c', values: { 'Work Email': PAYLOAD, Name: 'Alan' } },
  ]).data;

  it('applies refreshed payloads to bound rows only and reports the missing', () => {
    const newer: WaterfallCellPayload = { ...PAYLOAD, value: 'grace@acme.example' };
    const merged = mergeRefreshedCells(base, 'Work Email', {
      kind: 'refreshed',
      cells: [{ rowId: 'row-b', payload: newer }],
      missingRowIds: ['row-c'],
    });
    expect(merged.applied).toBe(1);
    expect(merged.missingRowIds).toEqual(['row-c']);
    // row-b got the new payload; the schema-invalid old value is replaced.
    expect(merged.data.rows[1].values['Work Email']).toEqual(newer);
    // row-a untouched; row-c keeps its prior value (a missing refresh never erases).
    expect(merged.data.rows[0]).toEqual(base.rows[0]);
    expect(merged.data.rows[2]).toEqual(base.rows[2]);
    // the input snapshot was not mutated
    expect(base.rows[1].values['Work Email']).toBe('pending legacy import');
  });

  it('a failed refresh returns the snapshot unchanged', () => {
    const merged = mergeRefreshedCells(base, 'Work Email', { kind: 'failed', message: 'down' });
    expect(merged.data).toBe(base);
    expect(merged.applied).toBe(0);
  });
});
