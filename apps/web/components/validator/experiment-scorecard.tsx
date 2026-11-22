'use client';

import React from 'react';
import { Badge, Button, Card } from '@leadloom/ui';
import { X, Users, Download, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { recordOutreach, fetchExperimentLeads, type ExperimentScorecard, type WaitlistLeadItem } from '../../lib/engine-client';
import { generateLeadsCsv, downloadCsv } from '../../lib/csv-export';
import { ImportLeadsDialog } from './import-leads-dialog';

function pct(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return 'Unavailable';
  return `${Math.round(rate * 100)}%`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-canvas-elevated p-3">
      <div className="text-[10px] uppercase font-mono text-text-muted">{label}</div>
      <div className="text-lg font-bold text-text-primary mt-0.5 font-mono">{value}</div>
    </div>
  );
}

/**
 * Real per-experiment scorecard (GET /validator/experiments/:id/scorecard).
 * Metrics come only from observed inputs: page loads, waitlist signups and
 * owner-recorded outreach numbers. Zero-data states say so plainly; a pending
 * verdict means there is not enough signal, never implied demand.
 */
export function ExperimentScorecardPanel({
  scorecard: initial,
  onClose,
}: {
  scorecard: ExperimentScorecard;
  onClose: () => void;
}) {
  const [scorecard, setScorecard] = React.useState(initial);
  const [sent, setSent] = React.useState(String(initial.metrics.outreachSent || ''));
  const [replies, setReplies] = React.useState(String(initial.metrics.replies || ''));
  const [positive, setPositive] = React.useState(String(initial.metrics.positiveReplies || ''));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [leads, setLeads] = React.useState<WaitlistLeadItem[]>([]);
  const [leadsLoading, setLeadsLoading] = React.useState(true);
  const [leadsError, setLeadsError] = React.useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);

  const leadSequence=React.useRef(0),mounted=React.useRef(true),saveBusy=React.useRef(false);
  React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;leadSequence.current++;};},[]);
  const loadLeads = React.useCallback(async () => {
    const sequence=++leadSequence.current;setLeads([]);setIsImportModalOpen(false);setLeadsLoading(true);
    setLeadsError(null);
    try {
      const res = await fetchExperimentLeads(scorecard.experimentId);
      if(sequence!==leadSequence.current)return;
      if (res.data&&res.data.experimentId===scorecard.experimentId) {
        setLeads(res.data.leads || []);
      } else {
        setLeadsError(res.error || 'Failed to fetch waitlist leads');
      }
    } catch (err: unknown) {
      if(sequence===leadSequence.current)setLeadsError('Captured contacts unavailable. No previous snapshot is available to export or import.');
    } finally {
      if(sequence===leadSequence.current)setLeadsLoading(false);
    }
  }, [scorecard.experimentId]);

  React.useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  function onDownloadCsv() {
    if (leads.length === 0) return;
    const csv = generateLeadsCsv(leads);
    const slug = scorecard.pageUrl.split('/v/')[1] || scorecard.experimentId.slice(0, 8);
    downloadCsv(csv, `leads-${slug}.csv`);
  }

  async function onSaveOutreach(e: React.FormEvent) {
    e.preventDefault();
    if (!sent.trim() || !replies.trim() || !positive.trim()) {
      setSaveError('All three counts are required.');
      return;
    }
    if(saveBusy.current)return;saveBusy.current=true;setSaving(true);
    setSaveError(null);
    try{const res=await recordOutreach(scorecard.experimentId,{outreachSent:Number(sent||0),replies:Number(replies||0),positiveReplies:Number(positive||0)});if(!mounted.current)return;if(!res.data||res.data.experimentId!==scorecard.experimentId){setSaveError(res.error||'Numbers were not confirmed. Reload the current experiment before retrying.');return;}setScorecard(res.data);}catch{if(mounted.current)setSaveError('Numbers were not confirmed. Reload the current experiment before retrying.');}finally{saveBusy.current=false;if(mounted.current)setSaving(false);}
  }

  const m = scorecard.metrics;
  const hasPageData = m.visitors > 0 || m.waitlistCount > 0;
  const hasOutreachData = m.outreachSent > 0;

  return (
    <Card data-testid="experiment-scorecard" className="p-5 sm:p-6 space-y-5 border border-border-subtle shadow-sm">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Experiment scorecard</h2>
            <Badge variant={scorecard.verdict === 'pending' ? 'matrix' : 'subtle'} className="text-[10px] font-mono">
              {scorecard.verdict === 'pending' ? 'Pending - not enough signal yet' : scorecard.verdict}
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1 max-w-2xl">{scorecard.hypothesis}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scorecard"
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-canvas-elevated"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <div className="text-[10px] uppercase font-mono text-text-muted mb-2">Smoke-test page (observed)</div>
        {hasPageData ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Metric label="Page loads" value={String(m.visitors)} />
            <Metric label="Waitlist signups" value={String(m.waitlistCount)} />
            <Metric label="Signups per page load" value={pct(m.pageConversionRate)} />
          </div>
        ) : (
          <p className="text-xs text-text-muted">No page traffic yet. Share the published page to start measuring real interest.</p>
        )}
      </div>

      {m.pageConversionRate === null && <p role="status" className="text-xs text-text-muted">Signup-to-load rate unavailable. Observed page loads are not inferred from signups. No observed loads, or signups exceeding loads, need reconciliation before a conversion verdict.</p>}

      {/* Captured Waitlist Leads (observed from smoke-test page) */}
      <div className="border-t border-border-subtle pt-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-text-muted" />
            <h3 className="text-[10px] uppercase font-mono text-text-muted">
              Captured Waitlist Leads ({leadsLoading?'loading':leadsError?'unavailable':leads.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {leads.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsImportModalOpen(true)}
                  className="text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-brand-loom" />
                  <span>Import captured leads</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDownloadCsv}
                  className="text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={loadLeads}
              disabled={leadsLoading}
              aria-label="Refresh waitlist leads"
              className="text-xs p-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${leadsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {leadsLoading ? (
          <div className="p-4 rounded-lg border border-border-subtle bg-canvas-elevated/40 text-xs text-text-muted font-mono animate-pulse">
            Loading waitlist leads...
          </div>
        ) : leadsError ? (
          <div className="p-4 rounded-lg border border-signal-failed/30 bg-signal-failed/5 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-signal-failed">Could not load leads</p>
              <p className="text-[11px] text-text-muted mt-0.5">{leadsError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={loadLeads} className="text-xs">
              Retry
            </Button>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-4 rounded-lg border border-border-subtle bg-canvas-elevated/30 text-center">
            <p className="text-xs text-text-secondary font-medium">No waitlist signups captured yet</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Leads will appear here once visitors submit early access requests on the published smoke page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-canvas-surface/80 text-text-muted font-mono">
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Company</th>
                  <th className="py-2 px-3 font-medium">Survey Responses</th>
                  <th className="py-2 px-3 font-medium text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-sans">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-canvas-elevated/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-text-primary">{lead.email}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{lead.name || '—'}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{lead.company || '—'}</td>
                    <td className="py-2.5 px-3 text-text-muted font-mono text-[11px]">
                      {Object.keys(lead.surveyResponses || {}).length > 0 ? (
                        <span title={JSON.stringify(lead.surveyResponses)}>
                          {Object.entries(lead.surveyResponses)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-text-muted font-mono text-[11px]">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] font-mono text-text-muted">
          Manual outreach only: Leads are captured for founder review and manual follow-up. No automatic emails or campaigns are dispatched.
        </p>
      </div>

      <div>
        <div className="text-[10px] uppercase font-mono text-text-muted mb-2">Outreach (recorded by you)</div>
        {hasOutreachData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Outreach sent" value={String(m.outreachSent)} />
            <Metric label="Replies" value={String(m.replies)} />
            <Metric label="Reply rate" value={pct(m.replyRate)} />
            <Metric label="Positive replies" value={String(m.positiveReplies)} />
          </div>
        ) : (
          <p className="text-xs text-text-muted">No outreach recorded yet. These numbers are entered by your team, not estimated.</p>
        )}
        <form onSubmit={onSaveOutreach} className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end" noValidate>
          {[
            { label: 'Outreach sent', val: sent, set: setSent },
            { label: 'Replies', val: replies, set: setReplies },
            { label: 'Positive replies', val: positive, set: setPositive },
          ].map((f) => (
            <label key={f.label} className="flex-1">
              <span className="block text-[10px] uppercase font-mono text-text-muted mb-1">{f.label}</span>
              <input
                type="number"
                min={0}
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-md border border-border-muted bg-canvas-elevated px-3 py-1.5 text-sm text-text-primary focus:border-brand-loom focus:outline-none focus:ring-1 focus:ring-brand-loom"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-loom px-4 py-1.5 text-sm font-semibold text-canvas disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save numbers'}
          </button>
        </form>
        {saveError && <p className="text-xs text-signal-failed mt-1">{saveError}</p>}
      </div>

      <p className="text-xs text-text-secondary border-t border-border-subtle pt-3">{scorecard.actionableSummary}</p>
      <p className="text-[10px] font-mono text-text-muted">
        Basis: heuristic score (PRD 5.2 weights) over raw page loads - repeat and bot traffic included - and team-entered outreach numbers. Not statistical validation.
      </p>

      {isImportModalOpen&&<ImportLeadsDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        experimentId={scorecard.experimentId}
        leads={leads}
      />}
    </Card>
  );
}
