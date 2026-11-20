'use client';

import React from 'react';
import { Button } from '@leadloom/ui';
import { Play, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLoomStore } from '../../store/loom-store';
import { notify } from '../../lib/notify';
import { dispatchWaterfall, estimateWaterfallCost, getWaterfallJobStatus } from '../../lib/engine-client';
import { jobContextLabel, type WaterfallJobView } from '../../lib/waterfall-job-view-model';
import { WaterfallJobStatusLine } from './waterfall-job-status-line';
import { startJobPolling } from '../../lib/waterfall-job-poller';

// The demo canvas waterfall column (see loom-store INITIAL_ROWS_BY_ID).
const DEMO_WATERFALL_COLUMN_ID = '00000000-0000-4000-8000-000000000104';

export function PreFlightBar() {
  const selectedRowIds = useLoomStore((state) => state.selectedRowIds);
  const runWaterfallForSelected = useLoomStore((state) => state.runWaterfallForSelected);
  const toggleSequencer = useLoomStore((state) => state.toggleSequencer);
  const [dispatching, setDispatching] = useState(false);
  // Stable outcome line: the toast fades and can overlap this bar, so the
  // result of a real dispatch attempt also lives here until dismissed or the
  // selection changes. Never implies a job exists.
  const [outcomeNote, setOutcomeNote] = useState<string | null>(null);
  // Live job state: only ever set from a REAL queued:true dispatch answer, and
  // every rendered status line is derived from the engine's own status payload
  // through waterfallJobView. The context snapshot (selection key + row ids at
  // dispatch time) keeps the job bound to the rows it actually runs on: if the
  // user changes the selection afterwards, the status line SAYS it belongs to
  // the earlier selection instead of appearing to cover the new one. Refresh
  // targets, when a real cell refetch path exists, are rowIds, never the live
  // selection. No job id is ever implied while D2 is off.
  const [jobCtx, setJobCtx] = useState<{ jobId: string; selectionKey: string; rowIds: string[] } | null>(null);
  const [jobView, setJobView] = useState<WaterfallJobView | null>(null);
  // Real estimate from the engine's pre-flight route. null = not loaded yet;
  // 'failed' = the engine gave no usable answer and we say so. The engine's
  // hit rates and unit costs are configured assumptions (it marks the answer
  // costBasis: 'configured-assumptions'), so the label says so; no time
  // estimate is shown because the engine no longer invents one.
  const [estimate, setEstimate] = useState<{ costUSD: number } | null | 'failed'>(null);

  const selectedCount = selectedRowIds.size;
  const selectionKey = Array.from(selectedRowIds).sort().join(',');
  const estimateGen = React.useRef(0);

  // Real dispatch. While the engine's durable queue is blocked (D2) it answers
  // queued:false - we surface exactly that, mutate nothing, and keep the user's
  // selection and inputs intact. No job id is ever implied.
  const handleRun = async () => {
    setDispatching(true);
    setOutcomeNote(null);
    try {
      const outcome = await dispatchWaterfall(DEMO_WATERFALL_COLUMN_ID, Array.from(selectedRowIds));
      if (outcome.queued) {
        setOutcomeNote(`Queued: ${outcome.totalQueued} rows (job ${outcome.jobId}).`);
        // Polling starts only on a real returned id; queued:true always
        // carries one, and we never invent one when it does not. The snapshot
        // binds the job to THIS selection, fixed at dispatch time.
        if (outcome.jobId) {
          setJobCtx({ jobId: outcome.jobId, selectionKey, rowIds: Array.from(selectedRowIds) });
        }
        notify.success(`Waterfall queued: ${outcome.totalQueued} rows`, {
          description: `Job ${outcome.jobId}`,
        });
      } else {
        setOutcomeNote(
          `Dispatch not available yet: ${outcome.message ?? 'The engine did not accept the dispatch; nothing was queued.'} Your selection is unchanged.`
        );
      }
    } finally {
      setDispatching(false);
    }
  };

  // Demo simulation stays clearly separate: synthetic cells, labeled sample,
  // never presented as a provider result.
  const handleSimulate = () => {
    runWaterfallForSelected();
    notify.info(`[Sample] Demo simulation for ${selectedCount} rows`, {
      description: `Synthetic results only. No provider call or charge.`,
    });
  };

  // Clear the note when the user changes the selection (new intent).
  useEffect(() => setOutcomeNote(null), [selectionKey]);

  // Fetch the real pre-flight estimate for the live selection. Debounced and
  // generation-guarded: a slower answer for an older selection never
  // overwrites the newer one. Fails closed with a muted 'unavailable' note.
  useEffect(() => {
    if (selectedCount === 0) return;
    const gen = ++estimateGen.current;
    setEstimate(null);
    const debounce = setTimeout(async () => {
      const { data, error } = await estimateWaterfallCost(DEMO_WATERFALL_COLUMN_ID, Array.from(selectedRowIds));
      if (estimateGen.current !== gen) return;
      if (error || !data) {
        setEstimate('failed');
        return;
      }
      setEstimate({ costUSD: data.estimatedCostUSD });
    }, 400);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  // Poll the real job-status route while the engine reports live work. The
  // loop lives in startJobPolling (fixture-tested): terminal states, a gone
  // job, an unavailable route, transport errors and unmount all stop it. The
  // poll never mutates cells: cell state arrives through the grid's own data.
  useEffect(() => {
    if (!jobCtx) return;
    const poller = startJobPolling(jobCtx.jobId, { fetchStatus: getWaterfallJobStatus, onView: setJobView });
    return () => poller.stop();
  }, [jobCtx?.jobId]);

  const contextNote = jobContextLabel(
    jobCtx ? { selectionKey: jobCtx.selectionKey, rowCount: jobCtx.rowIds.length } : null,
    selectionKey
  );

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-6 z-40 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border-muted bg-canvas-surface px-3 py-3 shadow-2xl animate-fade-in select-none">
      {/* Counters & Telemetry */}
      <div className="flex items-center gap-2 md:border-r border-border-subtle pr-4 font-mono text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-text-primary">
          <span className="w-2 h-2 rounded-full bg-brand-loom animate-ping" />
          {selectedCount} Selected
        </span>

        {/* Real numbers only, from the engine's pre-flight route (D3). The
            engine's hit rates/unit costs are configured assumptions, so this
            stays labeled unverified; nothing is invented client-side. */}
        {estimate && estimate !== 'failed' && (
          <span className="text-text-muted" title="Engine pre-flight estimate. Unit costs and hit rates are configured assumptions, not measured. Providers are tried in tier order; a resolved row is not sent to later tiers.">
            Est. charge ${estimate.costUSD.toFixed(4)} (configured assumptions, unverified)
          </span>
        )}
        {estimate === 'failed' && (
          <span className="text-text-muted opacity-75">Estimate unavailable</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={handleRun} disabled={dispatching}>
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{dispatching ? 'Dispatching...' : 'Run Waterfall'}</span>
        </Button>

        <Button size="sm" variant="outline" onClick={handleSimulate}>
          <Play className="w-3.5 h-3.5" />
          <span>Simulate (demo)</span>
        </Button>

        <Button size="sm" variant="outline" onClick={() => toggleSequencer(true)}>
          <Mail className="w-3.5 h-3.5" />
          <span>Push to Sequence</span>
        </Button>
      </div>

      {jobView && <WaterfallJobStatusLine view={jobView} contextNote={contextNote} />}

      {outcomeNote && (
        <div className="w-full max-w-[78vw] md:max-w-md flex items-start justify-between gap-3 border-t border-border-subtle pt-2 text-xs text-text-muted">
          <span className="leading-snug break-words">{outcomeNote}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setOutcomeNote(null)}
            className="shrink-0 text-text-muted hover:text-text-primary"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
