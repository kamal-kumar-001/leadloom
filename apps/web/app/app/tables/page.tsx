'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Badge, Card, EmptyState } from '@leadloom/ui';
import {
  fetchWorkspaceTables,
  fetchWorkspaceTableRows,
  dispatchWaterfall,
  getWaterfallJobStatus,
  type WorkspaceTableRow,
  type WorkspaceTableRows,
} from '../../../lib/engine-client';
import { mergeRefreshedCells } from '../../../lib/waterfall-cell-refresh';
import { createJobLifecycle, type JobLifecycle } from '../../../lib/waterfall-job-lifecycle';
import { type WaterfallJobView } from '../../../lib/waterfall-job-view-model';
import { WaterfallJobStatusLine } from '../../../components/grid/waterfall-job-status-line';
import { LoomVirtualGrid } from '../../../components/grid/loom-virtual-grid';
import { PreFlightBar } from '../../../components/grid/pre-flight-bar';
import { ThreadInspector } from '../../../components/grid/drawers/thread-inspector';
import { LoomViewDrawer } from '../../../components/sequencer/loom-view-drawer';
import { CsvImporterModal } from '../../../components/grid/csv-importer-modal';
import { AddWaterfallModal } from '../../../components/grid/add-waterfall-modal';
import { useLoomStore } from '../../../store/loom-store';
import { PersistedTableView } from '../../../components/grid/persisted-table-view';
import {
  Filter,
  ArrowUpDown,
  Play,
  Mail,
  SlidersHorizontal,
  UploadCloud,
  Layers,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

export default function TablesPage() {
  const [tables, setTables] = useState<WorkspaceTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTable, setOpenTable] = useState<WorkspaceTableRows | null>(null);
  const [openTableError, setOpenTableError] = useState<string | null>(null);

  async function openPersistedTable(tableId: string) {
    setOpenTable(null);
    setOpenTableError(null);
    setTableSelection(new Set());
    setPersistedJobView(null);
    setPersistedOutcome(null);
    snapshotRef.current = { tableId: null, loadedAt: Date.now() };
    const res = await fetchWorkspaceTableRows(tableId);
    if (res.data) {
      setOpenTable(res.data);
      snapshotRef.current = { tableId: res.data.table.id, loadedAt: Date.now() };
    } else setOpenTableError(res.error || 'Failed to load table rows');
  }

  // D3 real dispatch from a persisted table: selection is bound at dispatch
  // time, the returned job id drives polling, and on a terminal state ONLY
  // the bound rows of THIS table are refetched and merged - never the live
  // selection, never another table. queued:false is surfaced as the engine's
  // own message; nothing is implied or mutated on failure.
  const [tableSelection, setTableSelection] = useState<ReadonlySet<string>>(new Set());
  const [persistedJobView, setPersistedJobView] = useState<WaterfallJobView | null>(null);
  const [persistedOutcome, setPersistedOutcome] = useState<string | null>(null);
  const [persistedDispatching, setPersistedDispatching] = useState(false);
  // The open-table snapshot the lifecycle's apply guard reads. loadedAt is
  // when the snapshot was FETCHED - a refresh read started before that never
  // applies (lib/waterfall-job-lifecycle.ts, race-tested).
  const snapshotRef = React.useRef<{ tableId: string | null; loadedAt: number }>({ tableId: null, loadedAt: 0 });
  const lifecycleRef = React.useRef<JobLifecycle | null>(null);
  if (!lifecycleRef.current) {
    lifecycleRef.current = createJobLifecycle({
      fetchStatus: getWaterfallJobStatus,
      fetchRows: fetchWorkspaceTableRows,
      getSnapshot: () => snapshotRef.current,
      onView: setPersistedJobView,
      onApply: (tableId, columnName, result) => {
        setOpenTable((current) => {
          if (!current || current.table.id !== tableId) return current;
          return mergeRefreshedCells(current, columnName, result).data;
        });
      },
      onNote: setPersistedOutcome,
    });
  }
  useEffect(() => () => lifecycleRef.current?.stop(), []);

  const waterfallColumn = openTable?.columns.find((c) => c.type === 'waterfall') ?? null;

  function togglePersistedRow(rowId: string) {
    setTableSelection((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  async function runWaterfallOnPersisted() {
    if (!openTable || !waterfallColumn || tableSelection.size === 0) return;
    setPersistedDispatching(true);
    setPersistedOutcome(null);
    try {
      const rowIds = Array.from(tableSelection);
      const outcome = await dispatchWaterfall(waterfallColumn.id, rowIds);
      if (outcome.queued && outcome.jobId) {
        lifecycleRef.current?.startJob({ jobId: outcome.jobId, rowIds, tableId: openTable.table.id, columnName: waterfallColumn.name });
        setPersistedOutcome(`Queued: ${outcome.totalQueued ?? rowIds.length} rows (job ${outcome.jobId}).`);
      } else {
        setPersistedOutcome(
          `Dispatch not available yet: ${outcome.message ?? 'The engine did not accept the dispatch; nothing was queued.'} Your selection is unchanged.`
        );
      }
    } finally {
      setPersistedDispatching(false);
    }
  }


  const table = useLoomStore((state) => state.table);
  const toggleSequencer = useLoomStore((state) => state.toggleSequencer);
  const isSequencerOpen = useLoomStore((state) => state.isSequencerOpen);
  const runWaterfallForSelected = useLoomStore((state) => state.runWaterfallForSelected);
  const importRows = useLoomStore((state) => state.importRows);
  const addWaterfallColumn = useLoomStore((state) => state.addWaterfallColumn);

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isWaterfallModalOpen, setIsWaterfallModalOpen] = useState(false);

  const loadTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWorkspaceTables();
      if (res.data) {
        setTables(res.data);
      } else {
        setError(res.error || 'Failed to fetch workspace tables');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Engine connection error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Workspace Lead Tables
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Persisted prospect tables and enrichment pipelines saved to your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadTables}
            disabled={isLoading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 1. Real Workspace Tables List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Persisted Tables</h2>
          {!isLoading && !error && (
            <span className="text-xs text-text-muted font-mono">
              {tables.length} {tables.length === 1 ? 'table' : 'tables'} found
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="p-4 animate-pulse space-y-2">
                <div className="h-5 w-48 bg-canvas-elevated rounded" />
                <div className="h-4 w-32 bg-canvas-elevated rounded" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 border-signal-failed/30 bg-signal-failed/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-signal-failed">Failed to load workspace tables</p>
              <p className="text-xs text-text-muted mt-0.5">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={loadTables} className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry</span>
            </Button>
          </Card>
        ) : tables.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<Layers className="w-6 h-6 text-text-muted" />}
              title="No tables yet"
              description="Create or import your first lead table."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((tbl) => (
              <Card
                key={tbl.id}
                className="p-5 flex flex-col justify-between hover:border-border-muted transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="w-4 h-4 text-brand-loom shrink-0" />
                      <span className="text-sm font-bold text-text-primary truncate">{tbl.name}</span>
                    </div>
                    <Badge variant="subtle" className="text-[10px] font-mono shrink-0">
                      {tbl.rowCount.toLocaleString()} rows
                    </Badge>
                  </div>
                  <p className="text-[11px] text-text-muted mt-3 font-mono">
                    Created: {new Date(tbl.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-end">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openPersistedTable(tbl.id)}>
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open Table</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 1b. Real persisted table contents (read-only) */}
      {(openTable || openTableError) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              {openTable ? `Table: ${openTable.table.name}` : 'Table'}
            </h2>
            <button className="text-xs text-text-muted underline" onClick={() => { setOpenTable(null); setOpenTableError(null); snapshotRef.current = { tableId: null, loadedAt: Date.now() }; }}>
              Close
            </button>
          </div>
          {openTableError && (
            <Card className="p-4 border-signal-failed/30 bg-signal-failed/5 text-sm text-signal-failed">{openTableError}</Card>
          )}
          {openTable && (
            <>
              <PersistedTableView
                data={openTable}
                selection={waterfallColumn ? { selected: tableSelection, onToggle: togglePersistedRow } : undefined}
              />
              {waterfallColumn && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    disabled={tableSelection.size === 0 || persistedDispatching}
                    onClick={runWaterfallOnPersisted}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {persistedDispatching
                        ? 'Dispatching...'
                        : tableSelection.size === 0
                          ? `Select rows to run "${waterfallColumn.name}"`
                          : `Run Waterfall on ${tableSelection.size} selected`}
                    </span>
                  </Button>
                </div>
              )}
              {persistedJobView && <WaterfallJobStatusLine view={persistedJobView} />}
              {persistedOutcome && (
                <p className="text-xs text-text-muted leading-snug break-words">{persistedOutcome}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* 2. Interactive Grid Canvas (Sample Preview) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Interactive Grid Canvas</h2>
            <Badge variant="subtle" className="text-[10px] font-mono">
              Sample preview
            </Badge>
          </div>
          <p className="text-xs text-text-muted">
            Interactive demo canvas with virtualized scrolling, CSV import, and waterfall simulation.
          </p>
        </div>

        <Card className="p-0 overflow-hidden border border-border-subtle flex flex-col h-[560px]">
          {/* Grid Filter / Action Toolbar */}
          <div className="min-h-12 py-2 gap-2 overflow-x-auto whitespace-nowrap min-w-0 border-b border-border-subtle bg-canvas-surface/90 px-4 flex items-center justify-between text-xs shrink-0 select-none">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary text-xs">{table.name}</span>
              <Badge variant="subtle" className="font-mono text-[10px]">
                {table.rowCount.toLocaleString()} rows (Demo data)
              </Badge>
              <div className="h-4 w-px bg-border-subtle mx-1" />
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-canvas-elevated text-text-secondary transition-colors">
                <Filter className="w-3.5 h-3.5" /> Filter
              </button>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-canvas-elevated text-text-secondary transition-colors">
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort
              </button>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-canvas-elevated text-text-secondary transition-colors">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Grouping
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Add Waterfall Column Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsWaterfallModalOpen(true)}
                className="text-xs py-1.5 gap-1.5 border-border-subtle hover:border-border-strong"
              >
                <Layers className="w-3.5 h-3.5 text-brand-loom" />
                <span>Add Waterfall</span>
              </Button>

              {/* Import CSV Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCsvModalOpen(true)}
                className="text-xs py-1.5 gap-1.5 border-border-subtle hover:border-border-strong"
              >
                <UploadCloud className="w-3.5 h-3.5 text-signal-verified" />
                <span>Import CSV</span>
              </Button>

              {/* Outbound Sequencer Drawer Toggle */}
              <button
                onClick={() => toggleSequencer()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-canvas-elevated text-text-secondary hover:text-text-primary transition-all active:scale-[0.97]"
              >
                <Mail className="w-3.5 h-3.5 text-brand-weave" />
                <span>{isSequencerOpen ? 'Hide Sequencer' : 'Outbound Loom'}</span>
              </button>

              {/* Execute / Simulate Waterfall */}
              <Button
                size="sm"
                variant="primary"
                onClick={() => runWaterfallForSelected()}
                className="text-xs py-1.5 gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Waterfall</span>
              </Button>
            </div>
          </div>

          {/* Main Table Canvas Area */}
          <div className="flex-1 flex overflow-hidden p-3 relative">
            {table.rowCount === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <EmptyState
                  icon={<Layers className="w-6 h-6 text-text-muted" />}
                  title="No rows in this table"
                  description="Import a CSV or configure waterfall enrichment columns to populate leads."
                />
              </div>
            ) : (
              <>
                <LoomVirtualGrid />
                <PreFlightBar />
                <ThreadInspector />
                <LoomViewDrawer />
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Modals */}
      <CsvImporterModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImport={(rows) => importRows(rows)}
      />

      <AddWaterfallModal
        isOpen={isWaterfallModalOpen}
        onClose={() => setIsWaterfallModalOpen(false)}
        onAddColumn={(name, tiers, exitPredicate) =>
          addWaterfallColumn(name, tiers, exitPredicate)
        }
      />
    </div>
  );
}
