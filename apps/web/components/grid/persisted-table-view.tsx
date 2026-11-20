'use client';

import React from 'react';
import { Card } from '@leadloom/ui';
import { WaterfallCellPayloadSchema } from '@leadloom/contracts';
import { WaterfallCell } from './cells/waterfall-cell';
import type { WorkspaceTableRows } from '../../lib/engine-client';

/**
 * Read-only rendering of a persisted workspace table.
 *
 * Waterfall-typed columns render through the honest WaterfallCell (real trace,
 * failure states, unverified cost labels). Stored values that fail the payload
 * schema render as unrecognized data, never as a fake success and never a raw
 * JSON dump. Every other column type renders its plain value.
 */
export interface PersistedTableSelection {
  selected: ReadonlySet<string>;
  onToggle: (rowId: string) => void;
}

export function PersistedTableView({ data, selection }: { data: WorkspaceTableRows; selection?: PersistedTableSelection }) {
  const colSpan = data.columns.length + (selection ? 1 : 0);
  return (
    <Card className="p-0 overflow-auto border border-border-subtle">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-subtle bg-canvas-surface/90">
            {selection && <th className="px-3 py-2 w-8" aria-label="Select rows" />}
            {data.columns.map((c) => (
              <th key={c.id} className="text-left px-3 py-2 font-semibold text-text-primary whitespace-nowrap">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-text-muted" colSpan={colSpan}>
                0 rows saved yet.
              </td>
            </tr>
          ) : (
            data.rows.map((r) => (
              <tr key={r.rowId} className="border-b border-border-subtle last:border-0">
                {selection && (
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${r.rowId}`}
                      checked={selection.selected.has(r.rowId)}
                      onChange={() => selection.onToggle(r.rowId)}
                    />
                  </td>
                )}
                {data.columns.map((c) => {
                  if (c.type === 'waterfall') {
                    const parsed = WaterfallCellPayloadSchema.safeParse(r.values[c.name]);
                    return (
                      <td key={c.id} className="px-3 py-2 text-text-secondary align-top max-w-[280px]">
                        {parsed.success ? (
                          <WaterfallCell payload={parsed.data} />
                        ) : (
                          <span
                            className="text-text-muted"
                            title="Stored cell data does not match the waterfall payload schema"
                          >
                            —
                          </span>
                        )}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={c.id}
                      className="px-3 py-2 text-text-secondary align-top max-w-[280px] truncate"
                      title={String(r.values[c.name] ?? '')}
                    >
                      {r.values[c.name] === true ? 'yes' : r.values[c.name] === false ? 'no' : String(r.values[c.name] ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}
