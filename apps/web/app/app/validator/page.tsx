'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MOCK_VALIDATION_SCORECARD } from '@leadloom/contracts';
import { ValidationRadarCard } from '../../../components/validation/validation-radar-card';
import { Badge, Button, Card, EmptyState } from '@leadloom/ui';
import {
  fetchWorkspaceExperiments,
  type WorkspaceExperimentRow,
} from '../../../lib/engine-client';
import {
  FlaskConical,
  ExternalLink,
  RefreshCw,
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

  const activeExperiment = {
    title: 'Kubernetes Pod Cost Cutter',
    slug: 'k8s-cutter',
    hypothesis: MOCK_VALIDATION_SCORECARD.hypothesis,
    targetIcp: 'Seed & Series A VP Engineering / DevOps Lead',
  };

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

      {/* 1. Real Workspace Experiments List */}
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
              description="Create an experiment to smoke-test new ICP or value proposition hypotheses."
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
                    <th className="py-2.5 px-4 font-medium text-right">Created date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-sans">
                  {experiments.map((exp) => (
                    <tr key={exp.id} className="hover:bg-canvas-elevated/40 transition-colors">
                      <td className="py-3 px-4 text-text-primary max-w-md font-medium">
                        {exp.hypothesis}
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
                  {exp.verdictScore != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono text-text-muted">Score</span>
                      <span className="font-mono bg-canvas-elevated border border-border-subtle px-1.5 py-0.5 rounded text-[11px] text-text-secondary">
                        {exp.verdictScore}
                      </span>
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

      {/* 2. Sample Preview: Interactive Smoke-Test Workbench */}
      <div className="space-y-4">
        <Card className="p-5 sm:p-6 space-y-6 border border-border-subtle shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                Interactive Smoke-Test Workbench
              </h2>
              <Badge variant="subtle" className="text-[10px] font-mono">
                Sample preview
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/v/${activeExperiment.slug}`}
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-canvas-elevated text-xs font-medium text-text-primary hover:bg-canvas-subtle transition-colors"
              >
                <span>View Public Smoke Page</span>
                <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
              </Link>
            </div>
          </div>

          {/* Active Hypothesis Card */}
          <div className="p-4 sm:p-5 rounded-xl border border-border-subtle bg-canvas-subtle/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono text-text-muted uppercase">Active Experiment</span>
              <h3 className="text-base font-bold text-text-primary mt-0.5">
                {activeExperiment.hypothesis}
              </h3>
              <div className="text-xs text-text-muted font-mono mt-1">
                Target Audience: {activeExperiment.targetIcp} • Slug:{' '}
                <span className="text-brand-loom">/v/{activeExperiment.slug}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="loom" className="font-mono text-xs py-1">
                Status: {MOCK_VALIDATION_SCORECARD.verdict.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Analytics Radar Card */}
          <ValidationRadarCard scorecard={MOCK_VALIDATION_SCORECARD} />
        </Card>
      </div>
    </div>
  );
}
