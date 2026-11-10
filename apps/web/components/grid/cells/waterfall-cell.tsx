'use client';

import React, { useState } from 'react';
import { WaterfallCellPayload } from '@leadloom/contracts';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

export interface WaterfallCellProps {
  payload: WaterfallCellPayload | null;
  onInspect?: () => void;
}

export function WaterfallCell({ payload, onInspect }: WaterfallCellProps) {
  const [showPopover, setShowPopover] = useState(false);

  if (!payload || payload.status === 'idle') {
    return <span className="text-text-muted font-mono text-xs">—</span>;
  }

  if (payload.status === 'running' || payload.status === 'queued') {
    return (
      <div className="flex items-center gap-1.5 font-mono text-xs text-brand-loom animate-pulse">
        <Clock className="w-3.5 h-3.5 animate-spin" />
        <span>Cascading...</span>
      </div>
    );
  }

  const badgeLetters: Record<string, string> = {
    hunter: 'HU',
    apollo: 'AP',
    dropcontact: 'DC',
    anymail_finder: 'AF',
  };

  const providerKey = payload.telemetry?.provider_attributed || 'hunter';
  const badgeCode = badgeLetters[providerKey] || 'WF';

  return (
    <div
      className="relative group inline-flex items-center gap-2 cursor-pointer"
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
      onClick={onInspect}
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-signal-verified shrink-0" />
      <span className="font-mono text-xs text-text-primary font-medium truncate max-w-[140px]">
        {payload.value}
      </span>
      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-canvas-elevated border border-border-subtle text-text-muted shrink-0">
        [{badgeCode}]
      </span>

      {/* Hover Micro-Trace Popover */}
      {showPopover && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-72 p-3 rounded-xl border border-border-muted bg-canvas-surface/95 backdrop-blur-xl shadow-2xl text-xs font-mono animate-fade-in pointer-events-none">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-text-muted mb-2 text-[11px]">
            <span>Waterfall Execution Trace</span>
            <span className="text-signal-verified font-medium">Early Exit ✓</span>
          </div>

          <div className="space-y-1.5">
            {payload.trace.map((step) => (
              <div key={step.step} className="flex items-center justify-between">
                <span className="text-text-secondary">
                  {step.step}. {step.provider.toUpperCase()}
                </span>
                <span
                  className={
                    step.status === 'hit'
                      ? 'text-signal-verified'
                      : 'text-signal-failed opacity-75'
                  }
                >
                  {step.status === 'hit' ? `${step.latency_ms}ms (200)` : '404 Miss'}
                </span>
              </div>
            ))}
          </div>

          {payload.telemetry && (
            <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
              <span>Total Wholesale Cost</span>
              <span className="text-text-primary font-semibold">
                ${(payload.telemetry.cost_microcents / 100000).toFixed(4)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
