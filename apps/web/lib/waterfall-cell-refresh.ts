import { WaterfallCellPayloadSchema, type WaterfallCellPayload } from '@leadloom/contracts';
import type { WorkspaceTableRows } from './engine-client';

/**
 * D3 read/refresh seam: after a real waterfall job reaches a terminal state,
 * refetch the cells for EXACTLY the rows bound at dispatch time - never the
 * live selection, never any other row.
 *
 * Deliberately pure: it fetches through an injected client and RETURNS the
 * parsed cells; applying them to a store or canvas is the caller's choice.
 * Nothing here mutates anything, and a fetch failure is reported, never
 * smoothed over.
 *
 * Not yet wired to a live canvas: the demo grid has no real table id, so no
 * component calls this today. It becomes the refresh path when the persisted
 * tables canvas renders waterfall cells (see docs/plan/MISSING_WORK.md D3).
 */
export interface CellRefreshBinding {
  tableId: string;
  /** Row ids captured in the job context at dispatch time. */
  rowIds: string[];
  /** The waterfall column's display name (workspace rows key values by name). */
  columnName: string;
}

export type CellRefreshResult =
  | {
      kind: 'refreshed';
      cells: Array<{ rowId: string; payload: WaterfallCellPayload }>;
      /** Bound rows with no fresh, valid payload: absent from the response,
       *  no value for the column, or a value that fails the payload schema.
       *  Reported, never invented. */
      missingRowIds: string[];
    }
  | { kind: 'failed'; message: string };

export async function refreshBoundCells(
  binding: CellRefreshBinding,
  fetchRows: (tableId: string) => Promise<{ data: WorkspaceTableRows | null; error?: string }>
): Promise<CellRefreshResult> {
  const { data, error } = await fetchRows(binding.tableId);
  if (error || !data) {
    return { kind: 'failed', message: error || 'Could not read table rows from the engine.' };
  }
  const cells: Array<{ rowId: string; payload: WaterfallCellPayload }> = [];
  const missingRowIds: string[] = [];
  const byRowId = new Map(data.rows.map((r) => [r.rowId, r]));
  for (const rowId of binding.rowIds) {
    const row = byRowId.get(rowId);
    const parsed = row ? WaterfallCellPayloadSchema.safeParse(row.values[binding.columnName]) : null;
    if (parsed?.success) {
      cells.push({ rowId, payload: parsed.data });
    } else {
      missingRowIds.push(rowId);
    }
  }
  return { kind: 'refreshed', cells, missingRowIds };
}


/**
 * Apply refreshed cells to a persisted-table snapshot. Pure: returns a NEW
 * WorkspaceTableRows. Only the bound rows and the bound column are touched;
 * every other row/value is carried over untouched. Rows named in
 * missingRowIds keep their existing stored value - a failed refresh never
 * erases what was there.
 */
export function mergeRefreshedCells(
  data: WorkspaceTableRows,
  columnName: string,
  result: CellRefreshResult
): { data: WorkspaceTableRows; applied: number; missingRowIds: string[] } {
  if (result.kind === 'failed') return { data, applied: 0, missingRowIds: [] };
  const byRowId = new Map(result.cells.map((c) => [c.rowId, c.payload]));
  const rows = data.rows.map((r) => {
    const payload = byRowId.get(r.rowId);
    if (!payload) return r;
    return { ...r, values: { ...r.values, [columnName]: payload } };
  });
  return { data: { ...data, rows }, applied: result.cells.length, missingRowIds: result.missingRowIds };
}
