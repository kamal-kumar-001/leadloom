'use client';

import React from 'react';
import { Button, Badge } from '@leadloom/ui';
import { X, Send, Sparkles, CheckCircle, ShieldCheck } from 'lucide-react';
import { useLoomStore } from '../../store/loom-store';
import { toast } from 'sonner';

export function LoomViewDrawer() {
  const isSequencerOpen = useLoomStore((state) => state.isSequencerOpen);
  const toggleSequencer = useLoomStore((state) => state.toggleSequencer);
  const activeCell = useLoomStore((state) => state.activeCell);
  const rowsById = useLoomStore((state) => state.rowsById);
  const selectedRowIds = useLoomStore((state) => state.selectedRowIds);

  if (!isSequencerOpen) return null;

  const currentRow = activeCell ? rowsById[activeCell.rowId] : null;
  const company = currentRow ? String(currentRow.cells['00000000-0000-4000-8000-000000000101'] || 'Acme Inc') : 'Target Account';
  const domain = currentRow ? String(currentRow.cells['00000000-0000-4000-8000-000000000102'] || 'acme.com') : 'acme.com';
  const signal = currentRow ? String(currentRow.cells['00000000-0000-4000-8000-000000000103'] || 'Hiring Engineers') : 'Signal Trigger';
  
  const waterfallCell = currentRow?.cells['00000000-0000-4000-8000-000000000104'] as any;
  const targetEmail = waterfallCell?.value || 'prospect@target.com';

  const handleDispatch = () => {
    toast.success(`Queued ${selectedRowIds.size} personalized emails into Outbound Pool`, {
      description: 'Human jitter delay active (45s–180s between dispatches).',
    });
    toggleSequencer(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-border-muted bg-canvas-surface/95 backdrop-blur-2xl shadow-2xl flex flex-col font-sans animate-fade-in">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-border-subtle p-4 bg-canvas-elevated/40">
        <div className="flex items-center gap-2">
          <span className="text-lg">✉️</span>
          <div>
            <h3 className="font-bold text-text-primary text-sm">Loom View: Live Sequence Weave</h3>
            <p className="text-[11px] font-mono text-text-muted">Dynamic variable preview for active row</p>
          </div>
        </div>
        <button
          onClick={() => toggleSequencer(false)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-canvas-elevated transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recipient & Mailbox Bar */}
      <div className="p-4 border-b border-border-subtle bg-canvas-elevated/20 space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">To Recipient:</span>
          <span className="text-text-primary font-medium">{targetEmail}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">From Mailbox:</span>
          <span className="text-signal-verified font-medium">rotated-outreach@loom.dev (Score: 98)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Trigger Signal:</span>
          <Badge variant="loom">{signal}</Badge>
        </div>
      </div>

      {/* Email Editor / Live Preview */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 font-mono text-xs">
        <div>
          <label className="block text-[11px] text-text-muted mb-1 uppercase tracking-wider">
            Subject Line
          </label>
          <div className="p-2.5 rounded border border-border-subtle bg-canvas-elevated text-text-primary">
            Quick note on {company}&apos;s infra scaling
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-text-muted mb-1 uppercase tracking-wider flex items-center justify-between">
            <span>Body Content (Live Dynamic Weave)</span>
            <span className="text-brand-loom flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI Variables Bound
            </span>
          </label>
          <div className="p-3.5 rounded border border-border-subtle bg-canvas-elevated text-text-secondary leading-relaxed space-y-3">
            <p>Hey team,</p>
            <p>
              Saw that <span className="text-text-primary font-bold">{company}</span> had{' '}
              <span className="text-brand-loom font-medium">{signal}</span> this week.
            </p>
            <p>
              We built a data engine that cuts out 500% SaaS markups on enrichment. Since you are expanding the platform team, thought this might save your engineers hours of manual prospecting.
            </p>
            <p>Would love your candid take if you have 3 minutes.</p>
            <p className="text-text-muted pt-2 border-t border-border-subtle">Best,<br/>Alex @ LeadLoom</p>
          </div>
        </div>

        {/* Deliverability Pre-Flight Health Checklist */}
        <div className="p-3 rounded-lg border border-border-subtle bg-canvas-surface/60 space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-signal-verified">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>SPF / DKIM 2048-bit / DMARC Verified</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-loom" />
            <span>Daily Send Throttle: 18 / 35 on this inbox today</span>
          </div>
        </div>
      </div>

      {/* Drawer Action Footer */}
      <div className="border-t border-border-subtle p-4 bg-canvas-elevated/40 flex items-center justify-between">
        <span className="font-mono text-xs text-text-muted">
          {selectedRowIds.size} Leads Selected
        </span>
        <Button variant="primary" size="md" onClick={handleDispatch}>
          <Send className="w-3.5 h-3.5" />
          <span>Queue & Dispatch ({selectedRowIds.size})</span>
        </Button>
      </div>
    </div>
  );
}
