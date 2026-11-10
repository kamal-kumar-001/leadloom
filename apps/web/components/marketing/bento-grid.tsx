'use client';

import React from 'react';
import { SpotlightCard, Badge } from '@leadloom/ui';
import { Radio, GitBranch, Mail, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export function BentoGridSection() {
  return (
    <section className="py-14 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <Badge variant="loom" className="mb-3">
          Architecture & Capabilities
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
          Weave signals into revenue without breaking context
        </h2>
        <p className="mt-3 text-sm sm:text-base text-text-secondary">
          No CSV exports. No broken Zapier syncs. Everything happens in one continuous, reactive canvas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card 1: Autonomous Signal Listeners (7 Cols) */}
        <SpotlightCard className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-brand-loom/10 border border-brand-loom/30 flex items-center justify-center text-brand-loom mb-4">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-text-primary">
              Live Buying Signal Ingestion
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Never prospect from stale databases again. Trigger outbound rows automatically when target accounts make moves in the wild.
            </p>

            {/* Micro visual simulated feed */}
            <div className="mt-6 space-y-2 font-mono text-xs">
              <div className="p-2.5 rounded-lg border border-border-subtle bg-canvas-elevated/40 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-verified" />
                  <span className="text-text-primary">github.com/astral-sh/uv</span>
                </span>
                <span className="text-brand-loom">+380 stars/wk (VP Eng engaged)</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border-subtle bg-canvas-elevated/40 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-catchall" />
                  <span className="text-text-primary">modal.com/careers</span>
                </span>
                <span className="text-signal-catchall">Hiring +2 ML Platform Staff</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border-subtle flex items-center text-xs font-mono text-text-muted gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-signal-verified" />
            <span>Connects directly to GitHub, LinkedIn Scrapers, and RSS</span>
          </div>
        </SpotlightCard>

        {/* Card 2: DAG Adaptive Waterfall Engine (5 Cols) */}
        <SpotlightCard className="lg:col-span-5 flex flex-col justify-between" spotlightColor="rgba(168, 85, 247, 0.18)">
          <div>
            <div className="w-10 h-10 rounded-lg bg-brand-weave/10 border border-brand-weave/30 flex items-center justify-center text-brand-weave mb-4">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-text-primary">
              DAG Waterfall Short-Circuiting
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Query multiple vendors in cascade. As soon as a low-cost provider verifies the email, expensive downstream API calls are aborted automatically.
            </p>

            {/* Cascade Flow Indicator */}
            <div className="mt-6 p-4 rounded-lg border border-border-subtle bg-canvas-elevated/40 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-text-muted">
                <span>1. Apollo ($0.001)</span>
                <span className="text-signal-failed">404 Miss</span>
              </div>
              <div className="flex items-center justify-between text-signal-verified font-medium">
                <span>2. Hunter ($0.003)</span>
                <span>200 Deliverable ✓</span>
              </div>
              <div className="flex items-center justify-between text-text-muted line-through opacity-60">
                <span>3. Dropcontact ($0.02)</span>
                <span>Aborted (Preserved)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border-subtle text-xs font-mono text-signal-verified flex items-center gap-1.5">
            <span>Guaranteed Zero Unnecessary API Calls</span>
          </div>
        </SpotlightCard>

        {/* Card 3: Integrated Multi-Inbox Sequencer (Full Width - 12 Cols) */}
        <SpotlightCard className="lg:col-span-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="w-10 h-10 rounded-lg bg-brand-loom/10 border border-brand-loom/30 flex items-center justify-center text-brand-loom mb-4">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-bold text-text-primary">
              Integrated Multi-Inbox Sequencer with Health Scoring
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Go from raw domain to warmed, rotated cold outreach in the same tab. LeadLoom rotates dispatches across 20+ secondary inboxes, checks SPF/DKIM/DMARC in real-time, and applies randomized human jitter.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-mono">
              <Badge variant="verified">✓ 12/12 Inboxes Healthy</Badge>
              <Badge variant="matrix">Jitter: 45s–180s Random Delay</Badge>
              <Badge variant="loom">Unified IMAP AI Triage</Badge>
            </div>
          </div>

          {/* Visual Mini Composer Mock */}
          <div className="w-full md:w-96 p-4 rounded-xl border border-border-subtle bg-canvas-surface/90 font-mono text-xs shadow-xl">
            <div className="text-text-muted pb-2 border-b border-border-subtle mb-3 flex justify-between">
              <span>Sequence Step 1</span>
              <span className="text-signal-verified">Rotated Pool</span>
            </div>
            <div className="text-text-muted">To: <span className="text-text-primary">alex@vercel.com</span></div>
            <div className="text-text-muted mb-2">Subject: <span className="text-text-primary">Quick note on v0 release</span></div>
            <div className="p-2.5 rounded bg-canvas-elevated/60 text-text-secondary leading-relaxed text-[11px]">
              "Hey Alex, saw Vercel crossed +140 stars on GitHub this week. Noticed you are scaling edge infra..."
            </div>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
