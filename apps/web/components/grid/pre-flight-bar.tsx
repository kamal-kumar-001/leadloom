'use client';

import React from 'react';
import { Button } from '@leadloom/ui';
import { Play, Mail, ShieldCheck, Clock, DollarSign } from 'lucide-react';
import { useLoomStore } from '../../store/loom-store';
import { toast } from 'sonner';

export function PreFlightBar() {
  const selectedRowIds = useLoomStore((state) => state.selectedRowIds);
  const runWaterfallForSelected = useLoomStore((state) => state.runWaterfallForSelected);
  const toggleSequencer = useLoomStore((state) => state.toggleSequencer);

  const selectedCount = selectedRowIds.size;

  if (selectedCount === 0) return null;

  // Wholesale cost estimation: ~$0.003/row average
  const estimatedCost = (selectedCount * 0.003).toFixed(2);
  const estimatedSeconds = Math.max(2, Math.round(selectedCount * 0.25));

  const handleRun = () => {
    runWaterfallForSelected();
    toast.success(`Dispatched waterfall for ${selectedCount} rows`, {
      description: `Estimated wholesale cost: $${estimatedCost} via BYOK keys.`,
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-full border border-border-muted bg-canvas-surface/90 px-6 py-3 shadow-2xl backdrop-blur-xl animate-fade-in select-none">
      {/* Counters & Telemetry */}
      <div className="flex items-center gap-4 border-r border-border-subtle pr-4 font-mono text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-text-primary">
          <span className="w-2 h-2 rounded-full bg-brand-loom animate-ping" />
          {selectedCount} Selected
        </span>

        <span className="flex items-center gap-1 text-signal-verified font-medium">
          <DollarSign className="w-3.5 h-3.5" />
          Est. Cost: ${estimatedCost}
        </span>

        <span className="hidden sm:flex items-center gap-1 text-text-muted">
          <Clock className="w-3.5 h-3.5" />
          ~{estimatedSeconds}s
        </span>

        <span className="hidden md:flex items-center gap-1 text-text-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-signal-verified" />
          Early-Exit Guaranteed
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={handleRun}>
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Run Waterfall</span>
        </Button>

        <Button size="sm" variant="outline" onClick={() => toggleSequencer(true)}>
          <Mail className="w-3.5 h-3.5" />
          <span>Push to Sequence</span>
        </Button>
      </div>
    </div>
  );
}
