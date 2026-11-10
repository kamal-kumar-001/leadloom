'use client';

import React from 'react';
import Link from 'next/link';
import { Button, Badge } from '@leadloom/ui';
import { LoomVirtualGrid } from '../../components/grid/loom-virtual-grid';
import { PreFlightBar } from '../../components/grid/pre-flight-bar';
import { ThreadInspector } from '../../components/grid/drawers/thread-inspector';
import { LoomViewDrawer } from '../../components/sequencer/loom-view-drawer';
import { useLoomStore } from '../../store/loom-store';
import {
  Filter,
  ArrowUpDown,
  Plus,
  Play,
  Mail,
  Key,
  Database,
  ArrowLeft,
  SlidersHorizontal,
} from 'lucide-react';

export default function WorkspacePage() {
  const table = useLoomStore((state) => state.table);
  const toggleSequencer = useLoomStore((state) => state.toggleSequencer);
  const isSequencerOpen = useLoomStore((state) => state.isSequencerOpen);
  const runWaterfallForSelected = useLoomStore((state) => state.runWaterfallForSelected);

  return (
    <div className="flex flex-col h-screen bg-canvas overflow-hidden font-sans">
      {/* Top Application Bar */}
      <header className="h-14 border-b border-border-subtle bg-canvas-surface/90 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-canvas-elevated transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-xs text-brand-loom font-bold">
              🧵
            </span>
            <span className="font-bold text-sm text-text-primary tracking-tight">LeadLoom</span>
            <span className="text-text-muted text-xs">/</span>
            <span className="text-xs font-medium text-text-secondary">{table.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="matrix" className="hidden sm:inline-flex">
            <Key className="w-3 h-3 mr-1" /> BYOK: 4 Active Keys
          </Badge>

          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleSequencer()}
            className="text-xs"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{isSequencerOpen ? 'Hide Sequencer' : 'Loom View'}</span>
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => runWaterfallForSelected()}
            className="text-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run All Active</span>
          </Button>
        </div>
      </header>

      {/* Grid Filter / Action Toolbar */}
      <div className="h-11 border-b border-border-subtle bg-canvas-elevated/30 px-4 flex items-center justify-between text-xs font-mono shrink-0 select-none">
        <div className="flex items-center gap-2 text-text-muted">
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-canvas-elevated text-text-secondary transition-colors">
            <Filter className="w-3.5 h-3.5" /> Filter ({table.rowCount} Rows)
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-canvas-elevated text-text-secondary transition-colors">
            <ArrowUpDown className="w-3.5 h-3.5" /> Sort
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-canvas-elevated text-text-secondary transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Group by Stack
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-2.5 py-1 rounded bg-canvas-elevated border border-border-subtle text-brand-loom hover:bg-canvas-subtle transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Intent Signal
          </button>
          <button className="flex items-center gap-1 px-2.5 py-1 rounded bg-canvas-elevated border border-border-subtle text-brand-weave hover:bg-canvas-subtle transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Waterfall Tier
          </button>
        </div>
      </div>

      {/* Main Table Canvas Area */}
      <main className="flex-1 flex overflow-hidden p-3 relative">
        <LoomVirtualGrid />
        <PreFlightBar />
        <ThreadInspector />
        <LoomViewDrawer />
      </main>
    </div>
  );
}
