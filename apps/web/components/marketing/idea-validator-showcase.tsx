'use client';

import React, { useState } from 'react';
import { Button, Badge, SpotlightCard } from '@leadloom/ui';
import { Sparkles, ArrowRight, ExternalLink, Flame } from 'lucide-react';

export function IdeaValidatorShowcase() {
  const [hypothesis, setHypothesis] = useState(
    'Automated Kubernetes cloud cost-cutter for Series A startups'
  );

  return (
    <section className="py-14 sm:py-24 border-t border-border-subtle bg-canvas-surface/20 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="matrix" className="mb-3">
            Pre-Product Smoke-Test Engine
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            Have a startup idea? Validate buyer pull in 30 minutes.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-text-secondary">
            Never write 10,000 lines of code for an idea nobody wants. LeadLoom auto-generates your ICP filter, micro-waitlist site, and founder research sequence from one prompt.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Interactive Input Generator */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 mcard border border-border-muted bg-canvas-surface/80 backdrop-blur-md">
              <label className="block text-xs font-mono text-text-muted mb-2 uppercase tracking-wider">
                1. Enter Raw Product Hypothesis
              </label>
              <textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border-subtle bg-canvas-elevated p-3 text-sm text-text-primary focus:border-brand-loom focus:outline-none focus:ring-1 focus:ring-brand-loom font-sans resize-none"
              />
              <Button size="sm" variant="primary" className="mt-4 w-full">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Generate Smoke-Test Campaign</span>
              </Button>
            </div>

            <div className="p-4 rounded-lg border border-border-subtle bg-canvas-elevated/40 text-xs font-mono text-text-muted space-y-2">
              <div className="flex items-center justify-between text-text-secondary">
                <span>Auto-Derived ICP:</span>
                <span className="text-brand-loom font-medium">VP Eng, Head of DevOps</span>
              </div>
              <div className="flex items-center justify-between text-text-secondary">
                <span>Buying Signal:</span>
                <span className="text-text-primary">Hiring K8s / AWS EKS Staff</span>
              </div>
            </div>
          </div>

          {/* Right: Simulated Scorecard Output */}
          <SpotlightCard className="lg:col-span-7 border-brand-loom/30 bg-canvas-surface/90">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-signal-verified animate-ping" />
                <span className="text-xs font-mono text-text-primary font-medium">
                  Sample Validation Telemetry (simulated /v/k8s-cutter)
                </span>
              </div>
              <Badge variant="verified" className="font-mono">
                <Flame className="w-3 h-3 mr-1 fill-current" /> High Pull: Build Now
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
              <div className="p-3 rounded-lg bg-canvas-elevated/50 border border-border-subtle">
                <div className="text-[11px] font-mono text-text-muted">Page Conversion</div>
                <div className="text-xl font-bold font-mono text-text-primary mt-1">7.5%</div>
                <div className="text-[10px] text-signal-verified font-mono">Target: &gt; 8.0%</div>
              </div>
              <div className="p-3 rounded-lg bg-canvas-elevated/50 border border-border-subtle">
                <div className="text-[11px] font-mono text-text-muted">Reply Rate</div>
                <div className="text-xl font-bold font-mono text-text-primary mt-1">8.2%</div>
                <div className="text-[10px] text-signal-verified font-mono">Benchmark: 5.0%</div>
              </div>
              <div className="p-3 rounded-lg bg-canvas-elevated/50 border border-border-subtle col-span-2 sm:col-span-1">
                <div className="text-[11px] font-mono text-text-muted">Waitlist Leads</div>
                <div className="text-xl font-bold font-mono text-brand-loom mt-1">18 Verified</div>
                <div className="text-[10px] text-text-muted font-mono">2-Question Survey</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-canvas-elevated/30 border border-border-subtle font-mono text-xs text-text-secondary">
              <span className="text-text-muted">Survey Quote: </span>
              <span className="text-text-primary">"Our Datadog and AWS EKS idle bills are burning $12k/mo. Need right-sizing."</span>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
