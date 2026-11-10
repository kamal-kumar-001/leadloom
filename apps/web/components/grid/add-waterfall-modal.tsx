'use client';

import React, { useState } from 'react';
import { Button, Badge } from '@leadloom/ui';
import {
  Layers,
  ArrowRight,
  X,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { BYOKProvider } from '@leadloom/contracts';
import { toast } from 'sonner';

interface AddWaterfallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddColumn: (name: string, tiers: string[], exitPredicate: string) => void;
}

interface TierOption {
  id: string;
  name: string;
  unitCostUSD: number;
  hitRateEstimate: number;
}

const AVAILABLE_PROVIDERS: TierOption[] = [
  { id: 'apollo', name: 'Apollo Enrichment', unitCostUSD: 0.001, hitRateEstimate: 0.58 },
  { id: 'hunter', name: 'Hunter Verification', unitCostUSD: 0.003, hitRateEstimate: 0.28 },
  { id: 'dropcontact', name: 'Dropcontact European', unitCostUSD: 0.012, hitRateEstimate: 0.32 },
  { id: 'prospeo', name: 'Prospeo B2B', unitCostUSD: 0.008, hitRateEstimate: 0.42 },
];

export function AddWaterfallModal({
  isOpen,
  onClose,
  onAddColumn,
}: AddWaterfallModalProps) {
  const [columnName, setColumnName] = useState('Work Email Waterfall');
  const [selectedTiers, setSelectedTiers] = useState<string[]>(['apollo', 'hunter', 'dropcontact']);
  const [exitPredicate, setExitPredicate] = useState('deliverable');

  if (!isOpen) return null;

  const moveTier = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedTiers.length) return;
    const next = [...selectedTiers];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setSelectedTiers(next);
  };

  const removeTier = (id: string) => {
    if (selectedTiers.length <= 1) {
      toast.error('A waterfall must contain at least one tier.');
      return;
    }
    setSelectedTiers(selectedTiers.filter((t) => t !== id));
  };

  const addTier = (id: string) => {
    if (selectedTiers.includes(id)) return;
    setSelectedTiers([...selectedTiers, id]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnName.trim()) {
      toast.error('Column name is required');
      return;
    }
    if (selectedTiers.length === 0) {
      toast.error('Select at least one enrichment tier');
      return;
    }
    onAddColumn(columnName.trim(), selectedTiers, exitPredicate);
    toast.success(`Waterfall column "${columnName}" added to grid.`);
    onClose();
  };

  // Calculate estimated blended cost per row
  const totalCostEstimate = selectedTiers.reduce((acc, tierId) => {
    const prov = AVAILABLE_PROVIDERS.find((p) => p.id === tierId);
    return acc + (prov?.unitCostUSD || 0.002);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-canvas-surface border border-border-strong rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-canvas-muted/40">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand-loom/10 border border-brand-loom/20 flex items-center justify-center text-brand-loom">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-text-primary text-sm">
                Add Waterfall Enrichment Column
              </h3>
              <p className="text-[11px] text-text-muted">
                Configure early-exit DAG cascade across your BYOK providers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-canvas-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Column Name */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Column Title
            </label>
            <input
              type="text"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              placeholder="e.g. Verified Work Email"
              className="w-full bg-canvas border border-border-subtle rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom font-medium"
              required
            />
          </div>

          {/* Tier Order Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-primary">
                Waterfall Tier Sequence (Executed Top $\to$ Bottom)
              </label>
              <span className="text-[10px] text-text-muted font-mono">
                {selectedTiers.length} Active Tiers
              </span>
            </div>

            <div className="space-y-2 mb-3">
              {selectedTiers.map((tierId, index) => {
                const prov = AVAILABLE_PROVIDERS.find((p) => p.id === tierId);
                return (
                  <div
                    key={tierId}
                    className="flex items-center justify-between bg-canvas border border-border-subtle rounded-lg p-2.5 text-xs group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded bg-brand-loom/15 text-brand-loom text-[10px] font-mono font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-text-primary">
                          {prov?.name || tierId}
                        </span>
                        <span className="text-[10px] text-text-muted ml-2 font-mono">
                          ${prov?.unitCostUSD.toFixed(3)} / call
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveTier(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTier(index, 'down')}
                        disabled={index === selectedTiers.length - 1}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTier(tierId)}
                        className="p-1 text-text-muted hover:text-signal-catchall ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add missing provider buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-text-muted mr-1">Add Tier:</span>
              {AVAILABLE_PROVIDERS.filter((p) => !selectedTiers.includes(p.id)).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addTier(p.id)}
                  className="bg-canvas-muted hover:bg-canvas-surface border border-border-subtle rounded-md px-2 py-1 text-[11px] text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 text-brand-loom" />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Early-Exit Predicate */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Early-Exit Predicate
            </label>
            <select
              value={exitPredicate}
              onChange={(e) => setExitPredicate(e.target.value)}
              className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom"
            >
              <option value="deliverable">
                Deliverable Only (99% confidence, zero bounce risk)
              </option>
              <option value="valid_or_catchall">
                Deliverable or Catch-All (High volume B2B outreach)
              </option>
            </select>
          </div>

          {/* Cost Estimate Callout */}
          <div className="bg-canvas-muted/60 border border-border-subtle rounded-xl p-3 flex items-center justify-between text-xs font-mono">
            <span className="text-text-muted">Worst-case Cost per Row:</span>
            <span className="font-semibold text-text-primary">
              ${totalCostEstimate.toFixed(3)} USD
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className=" gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Add Column
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
