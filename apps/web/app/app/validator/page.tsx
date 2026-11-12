'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState } from '@leadloom/ui';
import {
  fetchWorkspaceExperiments,
  fetchExperimentScorecard,
  fetchOwnerPage,
  generateExperiment,
  setExperimentPublish,
  type ExperimentScorecard,
  type WorkspaceExperimentRow,
} from '../../../lib/engine-client';
import { ExperimentScorecardPanel } from '../../../components/validator/experiment-scorecard';
import { PagePreviewModal, type OwnerPagePreview } from '../../../components/validator/page-preview-modal';
import {
  FlaskConical,
  ExternalLink,
  RefreshCw,
  Plus,
} from 'lucide-react';

function renderVerdictBadge(verdict: string) {
  const raw = (verdict || 'pending').toLowerCase();
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
  if (raw === 'validated' || raw === 'pass') {
    return (
      <Badge variant="verified" className="text-[10px] font-mono">
        {capitalized}
      </Badge>
    );
  }
  if (raw === 'rejected' || raw === 'fail' || raw === 'failed') {
    return (
      <Badge variant="failed" className="text-[10px] font-mono">
        {capitalized}
      </Badge>
    );
  }
  if (raw === 'pending') {
    return (
      <Badge variant="matrix" className="text-[10px] font-mono">
        {capitalized}
      </Badge>
    );
  }
  return (
    <Badge variant="subtle" className="text-[10px] font-mono">
      {capitalized}
    </Badge>
  );
}

export default function ValidatorPage() {
  const [experiments, setExperiments] = useState<WorkspaceExperimentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hypothesis, setHypothesis] = useState('');
  const [preferredSlug, setPreferredSlug] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<ExperimentScorecard | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [preview, setPreview] = useState<OwnerPagePreview | null>(null);

  const loadExperiments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWorkspaceExperiments();
      if (res.data) {
        setExperiments(res.data);
      } else {
        setError(res.error || 'Failed to fetch workspace experiments');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Engine connection error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!hypothesis.trim()) {
      setGenerateError('Describe the hypothesis before generating a page.');
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    setCreatedUrl(null);
    const res = await generateExperiment({
      rawHypothesis: hypothesis.trim(),
      ...(preferredSlug.trim() ? { preferredSlug: preferredSlug.trim() } : {}),
    });
    setGenerating(false);
    if (res.error || !res.data) {
      setGenerateError(res.error || 'The experiment could not be created.');
      return;
    }
    setCreatedUrl(res.data.pageUrl);
    setHypothesis('');
    setPreferredSlug('');
    await loadExperiments();
  }

  async function onViewScorecard(exp: WorkspaceExperimentRow) {
    setScorecardLoading(true);
    const res = await fetchExperimentScorecard(exp.id);
    setScorecardLoading(false);
    if (res.error || !res.data) {
      setGenerateError(res.error || 'The scorecard could not be loaded.');
      return;
    }
    setScorecard(res.data);
  }

  async function onPreview(exp: WorkspaceExperimentRow) {
    const res = await fetchOwnerPage(exp.id);
    if (res.error || !res.data) {
      setGenerateError(res.error || 'The preview could not be loaded.');
      return;
    }
    setPreview(res.data);
  }

  async function onTogglePublish(exp: WorkspaceExperimentRow) {
    const publish = exp.pageStatus !== 'published';
    setPublishingId(exp.id);
    const res = await setExperimentPublish(exp.id, publish);
    setPublishingId(null);
    if (res.error) {
      setGenerateError(res.error);
      return;
    }
    await loadExperiments();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Idea Validation & Smoke-Test Workbench
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Capture real buyer intent and validate B2B positioning before writing product code.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadExperiments}
            disabled={isLoading}
            className="text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* New experiment: generates a real public smoke-test page with neutral,
          non-quantified copy derived from the hypothesis (no invented numbers). */}
      <Card className="p-5 sm:p-6 space-y-4 border border-border-subtle shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">New experiment</h2>
          <Plus className="w-4 h-4 text-text-muted" />
        </div>
        <form onSubmit={onGenerate} className="space-y-3" noValidate>
          <div>
            <label className="block text-xs font-mono text-text-muted mb-1.5">HYPOTHESIS</label>
            <textarea
              rows={2}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="e.g. Automated Kubernetes cost-cutter for Series A startups"
              className="w-full rounded-md border border-border-muted bg-canvas-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-loom focus:outline-none focus:ring-1 focus:ring-brand-loom"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-mono text-text-muted mb-1.5">PAGE SLUG (OPTIONAL)</label>
              <input
                type="text"
                value={preferredSlug}
                onChange={(e) => setPreferredSlug(e.target.value)}
                placeholder="my-idea-slug"
                className="w-full rounded-md border border-border-muted bg-canvas-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-loom focus:outline-none focus:ring-1 focus:ring-brand-loom"
              />
            </div>
            <Button size="md" variant="primary" type="submit" disabled={generating || !hypothesis.trim()}>
              {generating ? 'Generating...' : 'Generate smoke-test page'}
            </Button>
          </div>
        </form>
        {generateError && <p className="text-sm text-signal-failed">{generateError}</p>}
        {createdUrl && (
          <p className="text-sm text-signal-verified">
            Page created as a draft. Review it below, then publish it before sharing - the public link only works once published.
          </p>
        )}
      </Card>

      {scorecardLoading && <p className="text-xs text-text-muted font-mono">Loading scorecard...</p>}
      {scorecard && <ExperimentScorecardPanel scorecard={scorecard} onClose={() => setScorecard(null)} />}

      {/* Workspace experiments (real, persisted) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Workspace Experiments</h2>
            <FlaskConical className="w-4 h-4 text-text-muted" />
          </div>
          {!isLoading && !error && (
            <span className="text-xs text-text-muted font-mono">
              {experiments.length} {experiments.length === 1 ? 'experiment' : 'experiments'}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="p-5 animate-pulse space-y-3">
                <div className="h-4 w-48 bg-canvas-elevated rounded" />
                <div className="h-4 w-32 bg-canvas-elevated rounded" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 border-signal-failed/30 bg-signal-failed/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-signal-failed">Failed to load workspace experiments</p>
              <p className="text-xs text-text-muted mt-0.5">{error}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadExperiments}
              className="text-xs focus-visible:ring-2 focus-visible:ring-brand-loom"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry</span>
            </Button>
          </Card>
        ) : experiments.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<FlaskConical className="w-6 h-6 text-text-muted" />}
              title="No experiments yet"
              description="Generate a smoke-test page above to start collecting waitlist signups."
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0 border border-border-subtle shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-canvas-surface/80 text-text-muted font-mono">
                    <th className="py-2.5 px-4 font-medium">Hypothesis</th>
                    <th className="py-2.5 px-4 font-medium">Verdict</th>
                    <th className="py-2.5 px-4 font-medium">Score</th>
                    <th className="py-2.5 px-4 font-medium">Page loads</th>
                    <th className="py-2.5 px-4 font-medium">Waitlist</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Public page</th>
                    <th className="py-2.5 px-4 font-medium text-right">Created date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-sans">
                  {experiments.map((exp) => (
                    <tr key={exp.id} className="hover:bg-canvas-elevated/40 transition-colors">
                      <td className="py-3 px-4 text-text-primary max-w-md font-medium">
                        <button type="button" onClick={() => onViewScorecard(exp)} className="text-left hover:text-brand-loom hover:underline">
                          {exp.hypothesis}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {renderVerdictBadge(exp.verdict)}
                      </td>
                      <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">
                        {exp.verdictScore != null ? (
                          <span className="px-2 py-0.5 rounded bg-canvas-elevated border border-border-subtle text-text-secondary font-mono">
                            {exp.verdictScore}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">{exp.visitors}</td>
                      <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">{exp.waitlistCount}</td>
                      <td className="py-3 px-4">
                        {exp.pageStatus === 'published' ? (
                          <Badge variant="verified" className="text-[10px] font-mono">Published</Badge>
                        ) : (
                          <Badge variant="subtle" className="text-[10px] font-mono">Draft</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onPreview(exp)}
                          className="text-[11px] font-mono text-text-secondary hover:text-text-primary underline mr-2"
                        >
                          Preview
                        </button>
                        {exp.pageStatus === 'published' && exp.slug ? (
                          <span className="inline-flex items-center gap-2">
                            <Link
                              href={`/v/${exp.slug}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-brand-loom hover:underline font-mono text-[11px]"
                            >
                              /v/{exp.slug}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => onTogglePublish(exp)}
                              disabled={publishingId === exp.id}
                              className="text-[11px] font-mono text-text-muted hover:text-text-primary underline disabled:opacity-50"
                            >
                              Unpublish
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onTogglePublish(exp)}
                            disabled={publishingId === exp.id}
                            className="text-[11px] font-mono text-brand-loom hover:underline disabled:opacity-50"
                          >
                            {publishingId === exp.id ? 'Publishing...' : 'Publish'}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-text-muted font-mono text-[11px]">
                        {new Date(exp.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked View (no horizontal scroll at 390px) */}
            <div className="sm:hidden divide-y divide-border-subtle">
              {experiments.map((exp) => (
                <div key={exp.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] uppercase font-mono text-text-muted shrink-0">Verdict</span>
                    {renderVerdictBadge(exp.verdict)}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-text-muted block mb-0.5">Hypothesis</span>
                    <p className="text-text-primary font-medium">{exp.hypothesis}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Page loads / Waitlist</span>
                    <span className="font-mono text-[11px] text-text-secondary">{exp.visitors} / {exp.waitlistCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Status</span>
                    <span className="inline-flex items-center gap-2">
                      {exp.pageStatus === 'published' ? (
                        <Badge variant="verified" className="text-[10px] font-mono">Published</Badge>
                      ) : (
                        <Badge variant="subtle" className="text-[10px] font-mono">Draft</Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => onTogglePublish(exp)}
                        disabled={publishingId === exp.id}
                        className="text-[11px] font-mono text-brand-loom underline disabled:opacity-50"
                      >
                        {exp.pageStatus === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                    </span>
                  </div>
                  {exp.pageStatus === 'published' && exp.slug && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono text-text-muted">Public page</span>
                      <Link href={`/v/${exp.slug}`} target="_blank" className="inline-flex items-center gap-1 text-brand-loom font-mono text-[11px]">
                        /v/{exp.slug}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Created date</span>
                    <span className="text-text-muted font-mono text-[11px]">
                      {new Date(exp.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      {preview && <PagePreviewModal page={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
