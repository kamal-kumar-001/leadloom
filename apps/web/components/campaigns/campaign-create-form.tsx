'use client';

import React, { useState } from 'react';
import { Button, Card } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import { X } from 'lucide-react';
import { createWorkspaceCampaign, type WorkspaceCampaignRow, type WorkspaceCampaignStep } from '../../lib/engine-client';
import { CampaignStepsEditor } from './campaign-steps-editor';

interface CampaignCreateFormProps {
  onCreated: (campaign: WorkspaceCampaignRow) => void;
  onCancel: () => void;
}

const inputClass =
  'w-full rounded-md border border-border-subtle bg-canvas px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-loom';

/**
 * Creates a draft campaign. Nothing sends at creation: sending needs recipients,
 * enqueue, review approval, and the separate gated release. Mailboxes can be
 * pooled later; a campaign without a pool simply has no senders yet.
 */
export function CampaignCreateForm({ onCreated, onCancel }: CampaignCreateFormProps) {
  const [name, setName] = useState('');
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Calcutta');
  const [dailyLimitTotal, setDailyLimitTotal] = useState(50);
  const [steps, setSteps] = useState<WorkspaceCampaignStep[]>([
    { stepNumber: 1, delayHours: 0, subject: '', bodyTemplate: '' },
  ]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<number, { subject?: string; bodyTemplate?: string }>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    let ok = true;
    setNameError(null);
    const errors: Record<number, { subject?: string; bodyTemplate?: string }> = {};
    if (!name.trim()) {
      setNameError('Name the campaign');
      ok = false;
    }
    steps.forEach((s, i) => {
      const e: { subject?: string; bodyTemplate?: string } = {};
      if (!s.subject.trim()) e.subject = 'Subject is required';
      if (!s.bodyTemplate.trim()) e.bodyTemplate = 'Body is required';
      if (e.subject || e.bodyTemplate) {
        errors[i] = e;
        ok = false;
      }
    });
    setFieldErrors(errors);
    return ok;
  };

  const submit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createWorkspaceCampaign({
        name: name.trim(),
        steps: steps.map((s, i) => ({ ...s, stepNumber: i + 1, subject: s.subject.trim(), bodyTemplate: s.bodyTemplate.trim() })),
        dailyLimitTotal,
        scheduleTimezone: scheduleTimezone.trim() || 'UTC',
      });
      if (res.data) {
        notify.success('Campaign created as draft - nothing sends until recipients are added, messages are approved, and the gated release runs');
        onCreated(res.data);
      } else {
        setSubmitError(res.error || 'Campaign could not be created');
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Engine connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-5 space-y-4 border-brand-loom/30">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">New campaign</h2>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isSubmitting} className="text-xs px-2 py-1" title="Close">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-[10px] font-mono text-text-muted mb-1" htmlFor="campaign-name">Name</label>
          <input
            id="campaign-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Q4 founders outreach"
            maxLength={255}
            className={inputClass}
          />
          {nameError && <p className="text-[10px] text-signal-failed mt-1">{nameError}</p>}
        </div>
        <div>
          <label className="block text-[10px] font-mono text-text-muted mb-1" htmlFor="campaign-tz">Schedule timezone</label>
          <input
            id="campaign-tz"
            type="text"
            value={scheduleTimezone}
            onChange={(e) => setScheduleTimezone(e.target.value)}
            disabled={isSubmitting}
            maxLength={64}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-text-muted mb-1" htmlFor="campaign-limit">Daily limit (emails/day)</label>
          <input
            id="campaign-limit"
            type="number"
            min={1}
            max={10000}
            value={dailyLimitTotal}
            onChange={(e) => setDailyLimitTotal(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
            disabled={isSubmitting}
            className={inputClass}
          />
        </div>
      </div>

      <CampaignStepsEditor steps={steps} onChange={setSteps} disabled={isSubmitting} fieldErrors={fieldErrors} />

      {submitError && <p className="text-xs text-signal-failed">{submitError}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isSubmitting} className="text-xs">
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={isSubmitting} className="text-xs">
          {isSubmitting ? 'Creating...' : 'Create draft campaign'}
        </Button>
      </div>
    </Card>
  );
}
