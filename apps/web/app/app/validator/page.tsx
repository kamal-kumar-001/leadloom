'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MOCK_VALIDATION_SCORECARD } from '@leadloom/contracts';
import { ValidationRadarCard } from '../../../components/validation/validation-radar-card';
import { NewExperimentModal } from '../../../components/validation/new-experiment-modal';
import { Badge, Button } from '@leadloom/ui';
import {
  FlaskConical,
  Sparkles,
  ExternalLink,
  Plus,
  Compass,
  TrendingUp,
  FileCheck2,
} from 'lucide-react';

export default function ValidatorPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeExperiment, setActiveExperiment] = useState({
    title: 'Kubernetes Pod Cost Cutter',
    slug: 'k8s-cutter',
    hypothesis: MOCK_VALIDATION_SCORECARD.hypothesis,
    targetIcp: 'Seed & Series A VP Engineering / DevOps Lead',
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Idea Validation & Smoke-Test Workbench
            </h1>
            <Badge variant="matrix" className="font-mono text-xs">
              Demo data
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Capture real buyer intent and validate B2B positioning before writing product code.
          </p>
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

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Hypothesis</span>
          </Button>
        </div>
      </div>

      {/* Active Hypothesis Card */}
      <div className="p-5 rounded-xl bg-canvas-surface border border-border-subtle shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono text-text-muted uppercase">Active Experiment</span>
          <h2 className="text-base font-bold text-text-primary mt-0.5">
            {activeExperiment.hypothesis}
          </h2>
          <div className="text-xs text-text-muted font-mono mt-1">
            Target Audience: {activeExperiment.targetIcp} • Slug:{' '}
            <span className="text-brand-loom">/v/{activeExperiment.slug}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="loom" className="font-mono text-xs py-1">
            Status: {MOCK_VALIDATION_SCORECARD.verdict.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Analytics Radar Card */}
      <ValidationRadarCard scorecard={MOCK_VALIDATION_SCORECARD} />

      {/* New Experiment Modal */}
      <NewExperimentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={(exp) => {
          setActiveExperiment({
            title: exp.title,
            slug: exp.slug,
            hypothesis: exp.hypothesis,
            targetIcp: exp.targetIcp,
          });
        }}
      />
    </div>
  );
}
