'use client';

import React, { useState } from 'react';
import { Button, Badge } from '@leadloom/ui';
import {
  FlaskConical,
  Sparkles,
  ArrowRight,
  X,
  Target,
  DollarSign,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

interface NewExperimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (experiment: {
    title: string;
    slug: string;
    hypothesis: string;
    targetIcp: string;
    priceAnchorUSD: number;
  }) => void;
}

export function NewExperimentModal({
  isOpen,
  onClose,
  onCreate,
}: NewExperimentModalProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [targetIcp, setTargetIcp] = useState('DevOps Leads & Platform Engineers');
  const [priceAnchorUSD, setPriceAnchorUSD] = useState(299);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !hypothesis) {
      toast.error('Title and core hypothesis are required');
      return;
    }
    onCreate({
      title,
      slug: slug || 'new-experiment',
      hypothesis,
      targetIcp,
      priceAnchorUSD,
    });
    toast.success(`Experiment "${title}" created at /v/${slug || 'new-experiment'}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-canvas-surface border border-border-strong rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-canvas-muted/40">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand-loom/15 text-brand-loom border border-brand-loom/30 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-text-primary text-sm">
                Deploy Smoke-Test Experiment
              </h3>
              <p className="text-[11px] text-text-muted">
                Validate willingness-to-pay before writing product code
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Project / Product Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Postgres Query Cost Optimizer"
              className="w-full bg-canvas border border-border-subtle rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom font-medium"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Live URL Path
            </label>
            <div className="flex items-center bg-canvas border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-mono text-text-muted">
              <span>https://leadloom.dev/v/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="postgres-cost-cutter"
                className="bg-transparent text-text-primary focus:outline-none flex-1 ml-0.5"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Core Value Hypothesis
            </label>
            <textarea
              rows={3}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="e.g. Mid-market engineering leads will pay $299/mo to automatically identify unindexed queries and cut RDS instances by 35%..."
              className="w-full bg-canvas border border-border-subtle rounded-lg p-3 text-xs text-text-primary focus:outline-none focus:border-brand-loom"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Target ICP
              </label>
              <input
                type="text"
                value={targetIcp}
                onChange={(e) => setTargetIcp(e.target.value)}
                className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Price Anchor ($/mo)
              </label>
              <input
                type="number"
                value={priceAnchorUSD}
                onChange={(e) => setPriceAnchorUSD(Number(e.target.value))}
                className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom font-mono"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className=" gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Create Smoke Page
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
