'use client';

import React, { useState } from 'react';
import { MOCK_TABLE_METADATA } from '@leadloom/contracts';
import { Button, Badge } from '@leadloom/ui';
import { toast } from 'sonner';
import {
  Send,
  Plus,
  Clock,
  Sparkles,
  Play,
  Pause,
  Users,
  CheckCircle2,
  MailCheck,
  TrendingUp,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';

interface CampaignStep {
  step: number;
  type: 'email';
  subject: string;
  delayDays: number;
  bodySnippet: string;
}

const MOCK_CAMPAIGN_STEPS: CampaignStep[] = [
  {
    step: 1,
    type: 'email',
    subject: 'Quick question about {{company}}\'s Kubernetes infrastructure',
    delayDays: 0,
    bodySnippet: 'Hey {{first_name}}, noticed you are scaling platform engineering at {{company}}...',
  },
  {
    step: 2,
    type: 'email',
    subject: 'Re: Quick question about {{company}}\'s Kubernetes infrastructure',
    delayDays: 3,
    bodySnippet: 'Saw that you recently updated the main cloud cluster. How are you tackling unexpected node over-provisioning?',
  },
  {
    step: 3,
    type: 'email',
    subject: 'Closing the loop on Kubernetes cost optimization',
    delayDays: 4,
    bodySnippet: 'No worries if this isn\'t a priority right now. If your cloud bills spike this quarter, here is our open-core engine...',
  },
];

export default function CampaignsPage() {
  const [isRunning, setIsRunning] = useState(false);

  const toggleCampaign = () => {
    setIsRunning(!isRunning);
    toast.info(
      isRunning
        ? 'Sequence paused (simulated)'
        : 'Sequence scheduled with jittered dispatch (simulated demo mode)'
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Outbound Campaigns & Sequences</h1>
            <Badge variant="matrix" className="font-mono text-xs">
              Demo data
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Choreographed multi-step cold outreach synchronized with table intent signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isRunning ? 'outline' : 'primary'}
            onClick={toggleCampaign}
            className="text-xs"
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Sequence</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Dispatch</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.info('New campaign template created (demo)')}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </Button>
        </div>
      </div>

      {/* Campaign Metadata Card */}
      <div className="p-5 rounded-xl bg-canvas-surface border border-border-subtle shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <span className="text-[10px] font-mono text-text-muted uppercase">Active Target Table</span>
            <div className="text-base font-bold text-text-primary mt-0.5">
              {MOCK_TABLE_METADATA.name}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              Source: GitHub Stars Trigger Signal • 1,420 Enrolled Accounts (Demo data)
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-text-muted font-mono uppercase">Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-signal-verified animate-pulse' : 'bg-signal-catchall'
                  }`}
                />
                <span className="text-xs font-semibold text-text-primary font-mono">
                  {isRunning ? 'DISPATCHING' : 'READY / PAUSED'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs font-mono">
          <div>
            <div className="text-text-muted text-[10px] uppercase">Enrolled Contacts</div>
            <div className="text-lg font-bold text-text-primary mt-1">240</div>
          </div>
          <div>
            <div className="text-text-muted text-[10px] uppercase">Delivered Emails</div>
            <div className="text-lg font-bold text-signal-verified mt-1">120</div>
          </div>
          <div>
            <div className="text-text-muted text-[10px] uppercase">Reply Rate</div>
            <div className="text-lg font-bold text-brand-loom mt-1">8.3% (10 replies)</div>
          </div>
          <div>
            <div className="text-text-muted text-[10px] uppercase">Positive Resonance</div>
            <div className="text-lg font-bold text-signal-verified mt-1">60.0% (6/10)</div>
          </div>
        </div>
      </div>

      {/* Sequence Timeline */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Sequence Step Flow</h2>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border-subtle">
          {MOCK_CAMPAIGN_STEPS.map((step) => (
            <div key={step.step} className="relative group">
              <div className="absolute -left-6 top-3 w-5 h-5 rounded-full bg-canvas-elevated border-2 border-brand-loom flex items-center justify-center text-[10px] font-bold text-brand-loom">
                {step.step}
              </div>

              <div className="p-4 rounded-xl bg-canvas-surface border border-border-subtle hover:border-border-muted transition-all shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary">
                      Step {step.step}: Outbound Email
                    </span>
                    {step.delayDays > 0 ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas-elevated text-brand-weave flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Wait {step.delayDays} business days
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas-elevated text-signal-verified">
                        Instant dispatch
                      </span>
                    )}
                  </div>
                  <Badge variant="subtle" className="text-[10px] font-mono">
                    Demo data
                  </Badge>
                </div>

                <div className="text-xs font-semibold text-text-secondary mb-1.5 font-mono">
                  Subject: <span className="text-text-primary font-sans">{step.subject}</span>
                </div>

                <p className="text-xs text-text-muted italic bg-canvas-elevated/40 p-2.5 rounded-lg border border-border-subtle">
                  &ldquo;{step.bodySnippet}&rdquo;
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
