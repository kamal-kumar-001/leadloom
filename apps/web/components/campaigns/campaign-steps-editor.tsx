'use client';

import React from 'react';
import { Button } from '@leadloom/ui';
import { Plus, Trash2 } from 'lucide-react';
import type { WorkspaceCampaignStep } from '../../lib/engine-client';

interface CampaignStepsEditorProps {
  steps: WorkspaceCampaignStep[];
  onChange: (steps: WorkspaceCampaignStep[]) => void;
  disabled?: boolean;
  /** step index -> field -> message; rendered under each input */
  fieldErrors?: Record<number, { subject?: string; bodyTemplate?: string }>;
}

const inputClass =
  'w-full rounded-md border border-border-subtle bg-canvas px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-loom';

/**
 * Editor for a campaign's ordered email steps. Step numbers are assigned from
 * position (1..N) by the parent before submit; delayHours is relative to the
 * previous step. Template variables resolve per recipient at enqueue time.
 */
export function CampaignStepsEditor({ steps, onChange, disabled, fieldErrors }: CampaignStepsEditorProps) {
  const update = (index: number, patch: Partial<WorkspaceCampaignStep>) => {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const remove = (index: number) => {
    onChange(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };
  const add = () => {
    onChange([...steps, { stepNumber: steps.length + 1, delayHours: steps.length === 0 ? 0 : 24, subject: '', bodyTemplate: '' }]);
  };

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="rounded-lg border border-border-subtle bg-canvas-elevated p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary">Step {i + 1}</span>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono text-text-muted flex items-center gap-1">
                Delay (hours)
                <input
                  type="number"
                  min={0}
                  value={step.delayHours}
                  disabled={disabled || i === 0}
                  onChange={(e) => update(i, { delayHours: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
                  className="w-16 rounded border border-border-subtle bg-canvas px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-loom disabled:opacity-50"
                  title={i === 0 ? 'The first step sends immediately after release' : 'Hours after the previous step'}
                />
              </label>
              {steps.length > 1 && (
                <Button size="sm" variant="outline" onClick={() => remove(i)} disabled={disabled} className="text-xs px-2 py-1" title="Remove this step">
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <input
              type="text"
              value={step.subject}
              disabled={disabled}
              onChange={(e) => update(i, { subject: e.target.value })}
              placeholder="Subject line"
              maxLength={500}
              className={inputClass}
            />
            {fieldErrors?.[i]?.subject && <p className="text-[10px] text-signal-failed mt-1">{fieldErrors[i].subject}</p>}
          </div>
          <div>
            <textarea
              value={step.bodyTemplate}
              disabled={disabled}
              onChange={(e) => update(i, { bodyTemplate: e.target.value })}
              placeholder="Email body. Variables: {{name}}, {{company}}"
              rows={3}
              maxLength={20000}
              className={inputClass + ' resize-y font-mono'}
            />
            {fieldErrors?.[i]?.bodyTemplate && <p className="text-[10px] text-signal-failed mt-1">{fieldErrors[i].bodyTemplate}</p>}
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add} disabled={disabled || steps.length >= 20} className="text-xs gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        <span>Add step</span>
      </Button>
    </div>
  );
}
