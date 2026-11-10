'use client';

import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLoomStore } from '../../store/loom-store';
import { WaterfallCell } from './cells/waterfall-cell';
import { Badge } from '@leadloom/ui';

export function LoomVirtualGrid() {
  const parentRef = useRef<HTMLDivElement>(null);

  const table = useLoomStore((state) => state.table);
  const rowOrder = useLoomStore((state) => state.rowOrder);
  const rowsById = useLoomStore((state) => state.rowsById);
  const selectedRowIds = useLoomStore((state) => state.selectedRowIds);
  const toggleRowSelection = useLoomStore((state) => state.toggleRowSelection);
  const selectAllRows = useLoomStore((state) => state.selectAllRows);
  const activeCell = useLoomStore((state) => state.activeCell);
  const setActiveCell = useLoomStore((state) => state.setActiveCell);
  const setInspectorRowId = useLoomStore((state) => state.setInspectorRowId);

  const allSelected = rowOrder.length > 0 && selectedRowIds.size === rowOrder.length;

  const rowVirtualizer = useVirtualizer({
    count: rowOrder.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // 40px fixed row height for compact high density
    overscan: 6,
  });

  // Keyboard navigation listener (Arrow keys move focus, Space opens inspector)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCell) return;
      const currentIndex = rowOrder.indexOf(activeCell.rowId);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextId = rowOrder[Math.min(rowOrder.length - 1, currentIndex + 1)];
        setActiveCell({ rowId: nextId, colId: activeCell.colId });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevId = rowOrder[Math.max(0, currentIndex - 1)];
        setActiveCell({ rowId: prevId, colId: activeCell.colId });
      } else if (e.key === ' ') {
        e.preventDefault();
        setInspectorRowId(activeCell.rowId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, rowOrder, setActiveCell, setInspectorRowId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-hidden">
      {/* Table Virtual Container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto border border-border-subtle bg-canvas-surface/80 rounded-lg shadow-inner relative"
      >
        {/* Sticky Table Header */}
        <div className="sticky top-0 z-30 flex border-b border-border-subtle bg-canvas-elevated font-mono text-xs text-text-muted select-none">
          <div className="w-12 py-2.5 px-3 flex items-center justify-center border-r border-border-subtle shrink-0">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => selectAllRows(e.target.checked)}
              className="rounded bg-canvas border-border-muted accent-brand-loom cursor-pointer"
            />
          </div>
          <div className="w-12 py-2.5 px-3 border-r border-border-subtle shrink-0 text-center">#</div>
          {table.columns.map((col) => (
            <div
              key={col.id}
              style={{ width: `${col.width}px` }}
              className="py-2.5 px-4 border-r border-border-subtle font-medium text-text-secondary truncate shrink-0"
            >
              {col.name}
            </div>
          ))}
        </div>

        {/* Virtualized Rows Canvas */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowId = rowOrder[virtualRow.index];
            const row = rowsById[rowId];
            if (!row) return null;

            const isSelected = selectedRowIds.has(rowId);
            const isRowActive = activeCell?.rowId === rowId;

            return (
              <div
                key={rowId}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`flex border-b border-border-subtle text-xs transition-colors ${
                  isSelected ? 'bg-brand-loom/5' : isRowActive ? 'bg-canvas-subtle/70' : 'hover:bg-canvas-subtle/40'
                }`}
              >
                {/* Checkbox column */}
                <div className="w-12 px-3 flex items-center justify-center border-r border-border-subtle shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRowSelection(rowId)}
                    className="rounded bg-canvas border-border-muted accent-brand-loom cursor-pointer"
                  />
                </div>

                {/* Row Index */}
                <div className="w-12 px-3 flex items-center justify-center border-r border-border-subtle font-mono text-text-muted shrink-0">
                  {virtualRow.index + 1}
                </div>

                {/* Dynamic Data Columns */}
                {table.columns.map((col) => {
                  const cellData = row.cells[col.id];
                  const isCellActive = activeCell?.rowId === rowId && activeCell?.colId === col.id;

                  return (
                    <div
                      key={col.id}
                      style={{ width: `${col.width}px` }}
                      onClick={() => setActiveCell({ rowId, colId: col.id })}
                      className={`px-4 flex items-center border-r border-border-subtle truncate shrink-0 ${
                        isCellActive ? 'outline outline-2 -outline-offset-2 outline-brand-loom bg-brand-loom/10' : ''
                      }`}
                    >
                      {col.type === 'waterfall' ? (
                        <WaterfallCell
                          payload={cellData as any}
                          onInspect={() => setInspectorRowId(rowId)}
                        />
                      ) : col.type === 'intent_signal' ? (
                        <Badge variant="loom">{String(cellData || '')}</Badge>
                      ) : (
                        <span className="font-sans text-text-primary truncate">
                          {String(cellData ?? '')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
