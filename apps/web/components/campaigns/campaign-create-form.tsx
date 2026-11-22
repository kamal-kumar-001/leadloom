'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button, Card } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import { X } from 'lucide-react';
import { createWorkspaceCampaign, fetchWorkspaceProjects, type WorkspaceCampaignRow, type WorkspaceCampaignStep } from '../../lib/engine-client';
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
  const pending=useRef<{signature:string;requestId:string}|null>(null);
  const [projectId,setProjectId]=useState('');
  const [projects,setProjects]=useState<import('@leadloom/contracts').ProjectResponse[]>([]);
  const [projectError,setProjectError]=useState<string|null>(null);
  useEffect(()=>{let active=true;fetchWorkspaceProjects().then(r=>{if(!active)return;if(r.error)setProjectError('Projects could not be loaded. Leave unassigned or reload before creating.');else setProjects(r.projects);}).catch(()=>{if(active)setProjectError('Projects could not be loaded.');});return()=>{active=false;};},[]);
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
      const input = {
        name: name.trim(),
        ...(projectId?{projectId}:{}),
        steps: steps.map((s, i) => ({ ...s, stepNumber: i + 1, subject: s.subject.trim(), bodyTemplate: s.bodyTemplate.trim() })),
        dailyLimitTotal,
        scheduleTimezone: scheduleTimezone.trim() || 'UTC',
      };
      const signature=JSON.stringify(input);if(pending.current?.signature!==signature)pending.current={signature,requestId:crypto.randomUUID()};
      const res=await createWorkspaceCampaign({...input,requestId:pending.current.requestId});
      if (res.data) {
        notify.success(res.data.replayed?'Original campaign save recovered. Its current state is shown; nothing was reset or sent.':'Campaign created as draft - nothing sends until recipients are added, messages are approved, and the gated release runs');
        pending.current=null;
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

      <div>
        <label htmlFor="campaign-project" className="block text-xs text-text-muted mb-1">Project, fixed at creation</label>
        <select id="campaign-project" aria-label="New campaign project" value={projectId} onChange={e=>setProjectId(e.target.value)} disabled={isSubmitting} className={inputClass}>
          <option value="">Unassigned workspace campaign</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {projectError&&<p role="alert" className="text-xs text-signal-failed mt-1">{projectError}</p>}
        <p className="text-xs text-text-muted mt-1">Ownership organizes project observation. Workspace members and workspace tool scopes retain access. Nothing sends at creation.</p>
      </div>
      <CampaignStepsEditor steps={steps} onChange={setSteps} disabled={isSubmitting} fieldErrors={fieldErrors} />

      <p className="text-xs text-text-muted">An unconfirmed save can be retried with unchanged fields without creating another campaign. Changing fields starts a new request. Closing or reloading loses this request ID; inspect saved campaigns before starting again.</p>
      {submitError && <p role="alert" className="text-xs text-signal-failed">{submitError}</p>}

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
