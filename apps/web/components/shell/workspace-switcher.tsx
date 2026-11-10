'use client';

import React, { useState } from 'react';
import { Building, ChevronDown, Check, Plus, Layers } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  plan: string;
}

const MOCK_WORKSPACES: Workspace[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Acme Growth Labs', plan: 'Growth Tier' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'DevOps Engine Core', plan: 'Scale Tier' },
];

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(MOCK_WORKSPACES[0].id);

  const active = MOCK_WORKSPACES.find((w) => w.id === selectedId) || MOCK_WORKSPACES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-2 rounded-lg bg-canvas-elevated hover:bg-canvas-subtle border border-border-subtle text-left transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center shrink-0">
            <Building className="w-3.5 h-3.5 text-brand-loom" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-text-primary truncate">{active.name}</div>
            <div className="text-[10px] text-text-muted font-mono truncate">{active.plan}</div>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0 ml-1" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1.5 z-30 p-1.5 rounded-lg bg-canvas-surface border border-border-subtle shadow-lg">
            <div className="px-2 py-1 text-[10px] uppercase font-mono text-text-muted">Workspaces</div>
            {MOCK_WORKSPACES.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setSelectedId(w.id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-xs hover:bg-canvas-elevated text-text-primary transition-colors"
              >
                <div className="truncate">
                  <span className="font-medium">{w.name}</span>
                  <span className="text-[10px] text-text-muted ml-1.5">({w.plan})</span>
                </div>
                {w.id === selectedId && <Check className="w-3.5 h-3.5 text-brand-loom shrink-0" />}
              </button>
            ))}
            <div className="border-t border-border-subtle my-1" />
            <button
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs text-brand-loom hover:bg-canvas-elevated transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create new workspace</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
