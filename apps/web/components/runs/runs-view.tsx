import React from 'react';
import { Card } from '@leadloom/ui';
import { Activity, CheckCircle2, XCircle, ShieldAlert, FileWarning, FlaskConical } from 'lucide-react';
import type { RunsViewData } from '../../lib/runs-view-model';

const STATUS_STYLE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  SUCCESS: { label: 'success', className: 'bg-signal-verified/15 text-signal-verified border border-signal-verified/30', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  FAILED: { label: 'failed', className: 'bg-red-500/15 text-red-400 border border-red-500/30', icon: <XCircle className="h-3.5 w-3.5" /> },
  REFUSED: { label: 'refused by policy', className: 'bg-accent-loom/15 text-accent-loom border border-accent-loom/30', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
};

/** Explicit timezone: the registry stores ISO instants; the owner reads them in IST. */
function formatFinishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d) + ' IST'
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
      {note && <div className="text-[10px] text-text-muted mt-0.5">{note}</div>}
    </Card>
  );
}

export function RunsView({ data }: { data: RunsViewData }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-brand-loom" />
        <h1 className="text-xl font-semibold text-text-primary">Pipeline Run Status</h1>
      </div>
      <p className="text-sm text-text-secondary">
        Every local pipeline step Leadloom has attempted - successes, failures and policy refusals alike. Local registry only; nothing here is published or deployed.
      </p>

      {data.hasSampleData && (
        <Card className="p-4 border border-accent-loom/40 bg-accent-loom/5">
          <div className="flex items-start gap-2 text-sm text-accent-loom">
            <FlaskConical className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">SAMPLE DATA - mock connector.</span>{' '}
              Rows tagged "mock" were produced by the simulated dev connector: no real coding agent
              executed them and no real tokens were spent. They exist to preview this view until the
              first real CLI connector is enabled.
            </div>
          </div>
        </Card>
      )}

      {data.state === 'corrupt' && (
        <Card className="p-4 border border-red-500/40">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <FileWarning className="h-4 w-4" />
            Run registry could not be read ({data.errorDetail}). History is preserved on disk and was NOT reset.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard label="Total runs" value={data.summary.total} />
        <SummaryCard label="Succeeded" value={data.summary.succeeded} />
        <SummaryCard label="Failed" value={data.summary.failed} />
        <SummaryCard label="Refused by policy" value={data.summary.refused} />
        <SummaryCard
          label="Tokens recorded"
          value={data.summary.tokensKnown.toLocaleString()}
          note={data.summary.usageUnknown > 0 ? `usage unknown for ${data.summary.usageUnknown} run${data.summary.usageUnknown > 1 ? 's' : ''}` : undefined}
        />
      </div>

      {data.state === 'empty' ? (
        <Card className="p-6 text-sm text-text-muted">
          No runs recorded yet. Research reports, landing drafts and agent runs will appear here once the pipeline is used.
        </Card>
      ) : (
        <Card className="divide-y divide-border-subtle">
          {data.rows.map((row) => {
            const style = STATUS_STYLE[row.status];
            return (
              <div key={row.id} className="p-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-text-muted">{row.kind}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.className}`}>
                      {style.icon}
                      {style.label}
                    </span>
                    {row.provenance === 'mock-connector' && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent-loom/15 text-accent-loom border border-accent-loom/30">
                        <FlaskConical className="h-3 w-3" />
                        mock
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary break-words">{row.label}</p>
                  {row.error && <p className="text-xs text-red-400 break-words">{row.error}</p>}
                  <div className="text-xs text-text-muted sm:hidden">
                    {formatFinishedAt(row.finishedAt)}
                    {' · '}
                    {row.tokensUsed !== null ? `${row.tokensUsed.toLocaleString()} tokens` : 'usage unknown'}
                    {row.artifactCount > 0 ? ` · ${row.artifactCount} artifact${row.artifactCount > 1 ? 's' : ''}` : ''}
                  </div>
                </div>
                <div className="hidden sm:block shrink-0 text-right text-xs text-text-muted space-y-1">
                  <div>{formatFinishedAt(row.finishedAt)}</div>
                  <div>
                    {row.tokensUsed !== null ? `${row.tokensUsed.toLocaleString()} tokens` : 'usage unknown'}
                    {row.artifactCount > 0 ? ` · ${row.artifactCount} artifact${row.artifactCount > 1 ? 's' : ''}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
