'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WaterfallCellPayload } from '@leadloom/contracts';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { waterfallCellView, waterfallCostLabel } from '@/lib/waterfall-cell-view-model';

export interface WaterfallCellProps {
  payload: WaterfallCellPayload | null;
  onInspect?: () => void;
  /** Dev/preview aid: keep the trace popover open without hover. */
  forcePopover?: boolean;
}

const BADGE_LETTERS: Record<string, string> = {
  hunter: 'HU',
  apollo: 'AP',
  dropcontact: 'DC',
  anymail_finder: 'AF',
};

export function WaterfallCell({ payload, onInspect, forcePopover }: WaterfallCellProps) {
  const [hoverPopover, setHoverPopover] = useState(false);
  const [tappedOpen, setTappedOpen] = useState(false);
  // Fixed-viewport coordinates for the portaled desktop popover. null on
  // mobile, where the CSS bottom sheet owns placement.
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPopover = forcePopover || hoverPopover || tappedOpen;
  // The popover is portaled to document.body because every real container
  // (persisted table Card, virtual grid) clips absolutely-positioned children
  // with overflow:auto. Placement: below the cell when there is not enough
  // room above, else above; clamped inside the viewport horizontally.
  const openPopover = () => {
    cancelHide();
    const r = rootRef.current?.getBoundingClientRect();
    if (r && window.innerWidth >= 640) {
      const roomAbove = r.top;
      const flip = roomAbove < 340;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - 300));
      setPos(
        flip
          ? { left, top: r.bottom + 8 }
          : { left, bottom: window.innerHeight - r.top + 8 }
      );
    } else {
      setPos(null);
    }
    setHoverPopover(true);
  };
  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setHoverPopover(false), 120);
  };
  const cancelHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };
  useEffect(() => () => cancelHide(), []);
  const view = waterfallCellView(payload);
  const cost = waterfallCostLabel(payload);

  if (view.kind === 'empty') {
    return <span className="text-text-muted font-mono text-xs">—</span>;
  }

  if (view.kind === 'in_progress') {
    return (
      <div className="flex items-center gap-1.5 font-mono text-xs text-brand-loom animate-pulse">
        <Clock className="w-3.5 h-3.5 animate-spin" />
        <span>{view.label}</span>
      </div>
    );
  }

  const isFailure = view.kind === 'failed';
  // Simulated (demo-canvas) results get a SIM badge instead of a provider
  // badge: no provider produced this value.
  const badgeCode =
    view.kind === 'success'
      ? view.simulated
        ? 'SIM'
        : view.provider
          ? BADGE_LETTERS[view.provider] || 'WF'
          : null
      : null;

  return (
    <div
      className="relative group inline-flex items-center gap-2 cursor-pointer"
      ref={rootRef}
      onMouseEnter={openPopover}
      onMouseLeave={scheduleHide}
      onClick={() => {
        // Touch has no hover: tap toggles the trace sheet (tap again or the
        // close control dismisses). The inspect drawer hook is preserved.
        openPopover();
        setTappedOpen((v) => !v);
        onInspect?.();
      }}
    >
      {isFailure ? (
        <XCircle className="w-3.5 h-3.5 text-signal-failed shrink-0" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 text-signal-verified shrink-0" />
      )}
      {view.kind === 'success' && (
        <span className="font-mono text-xs text-text-primary font-medium truncate max-w-[140px]">
          {view.value}
        </span>
      )}
      {isFailure && (
        <span className="font-mono text-xs text-signal-failed/90 truncate max-w-[180px]">
          {view.label}{view.retryable ? ' (retryable)' : ''}
        </span>
      )}
      {badgeCode && (
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-canvas-elevated border border-border-subtle text-text-muted shrink-0">
          [{badgeCode}]{view.kind === 'success' && view.fallback ? ' fallback' : ''}
        </span>
      )}

      {/* Trace popover, portaled so no overflow container can clip it. */}
      {showPopover && payload && createPortal(
        <div
          className="fixed left-3 right-3 bottom-4 z-50 sm:left-auto sm:right-auto sm:bottom-auto sm:w-72 sm:max-w-[calc(100vw-1.5rem)] p-3 rounded-xl border border-border-muted bg-canvas-surface shadow-2xl text-xs font-mono animate-fade-in pointer-events-auto"
          style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom } : undefined}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-text-muted mb-2 text-[11px]">
            <span>Waterfall Execution Trace</span>
            <span className="flex items-center gap-2">
              <span className={isFailure ? 'text-signal-failed font-medium' : 'text-signal-verified font-medium'}>
                {view.kind === 'success' ? view.traceHeader : view.kind === 'failed' ? view.traceHeader : ''}
              </span>
              <button
                type="button"
                aria-label="Close trace"
                className="pointer-events-auto px-1 text-text-muted hover:text-text-primary"
                onClick={(e) => { e.stopPropagation(); setTappedOpen(false); setHoverPopover(false); }}
              >
                Close
              </button>
            </span>
          </div>

          <div className="space-y-1.5">
            {payload.trace.map((step) => (
              <div key={step.step} className="flex items-center justify-between gap-2">
                <span className="text-text-secondary">
                  {step.step}. {step.provider.toUpperCase()}
                </span>
                <span
                  className={
                    step.status === 'hit'
                      ? 'text-signal-verified'
                      : 'text-signal-failed opacity-75'
                  }
                  title={step.reason}
                >
                  {step.status === 'hit' ? `${step.latency_ms}ms` : (step.reason ?? step.status)}
                </span>
              </div>
            ))}
          </div>

          {cost.kind === 'sample' && (
            <div className="mt-2.5 pt-2 border-t border-border-subtle text-[11px] text-text-muted">
              <span>{cost.note}</span>
            </div>
          )}
          {(cost.kind === 'measured' || cost.kind === 'estimated') && (
            <div className="mt-2.5 pt-2 border-t border-border-subtle text-[11px] text-text-muted">
              <div className="flex items-center justify-between">
                <span>{cost.kind === 'estimated' ? 'Estimated charge (unverified)' : 'Total Wholesale Cost'}</span>
                <span className="text-text-primary font-semibold">{cost.amount}</span>
              </div>
              {cost.kind === 'estimated' && (
                <div className="mt-1 flex items-start gap-1 text-signal-warning">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{cost.note}</span>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
