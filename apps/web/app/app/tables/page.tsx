'use client';

import React from 'react';
import { Button, Badge } from '@leadloom/ui';
import { LoomVirtualGrid } from '../../../components/grid/loom-virtual-grid';
import { PreFlightBar } from '../../../components/grid/pre-flight-bar';
import { ThreadInspector } from '../../../components/grid/drawers/thread-inspector';
import { LoomViewDrawer } from '../../../components/sequencer/loom-view-drawer';
import { useLoomStore } from '../../../store/loom-store';
import {
  Filter,
  ArrowUpDown,
  Plus,
  Play,
  Mail,
  Key,
  SlidersHorizontal,
  Download,
  Upload,
} from 'lucide-react';

export default function TablesPage() {
  const table = useLoomStore((state) => state.table);
  const toggleSequencer = useLoomStore((state) => state.toggleSequencer);
  const isSequencerOpen = useLoomStore((state) => state.isSequencerOpen);
  const runWaterfallForSelected = useLoomStore((state) => state.runWaterfallForSelected);

  return (
    <div className="flex flex-col h-full bg-canvas overflow-hidden">
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
          <button
            onClick={() => toggleSequencer()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-canvas-elevated text-text-secondary hover:text-text-primary transition-all active:scale-[0.97]"
          >
            <Mail className="w-3.5 h-3.5 text-brand-weave" />
            <span>{isSequencerOpen ? 'Hide Sequencer' : 'Outbound Loom'}</span>
          </button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => runWaterfallForSelected()}
            className="text-xs py-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Waterfall</span>
          </Button>
        </div>
      </div>

      {/* Main Table Canvas Area */}
      <div className="flex-1 flex overflow-hidden p-3 relative">
        <LoomVirtualGrid />
        <PreFlightBar />
        <ThreadInspector />
        <LoomViewDrawer />
      </div>
    </div>
  );
}
