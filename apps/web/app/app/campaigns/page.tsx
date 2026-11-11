'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Badge, Card, EmptyState } from '@leadloom/ui';
import { fetchWorkspaceCampaigns, type WorkspaceCampaignRow } from '../../../lib/engine-client';
import { notify } from '@/lib/notify';
import { ApprovalQueue } from '../../../components/campaigns/approval-queue';
import {
  Send,
  Plus,
  Clock,
  Play,
  Pause,
  RefreshCw,
  FolderOpen,
  Calendar,
  Globe,
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
    subject: "Quick question about {{company}}'s Kubernetes infrastructure",
    delayDays: 0,
    bodySnippet: 'Hey {{first_name}}, noticed you are scaling platform engineering at {{company}}...',
  },
  {
    step: 2,
    type: 'email',
    subject: "Re: Quick question about {{company}}'s Kubernetes infrastructure",
    delayDays: 3,
    bodySnippet: 'Saw that you recently updated the main cloud cluster. How are you tackling unexpected node over-provisioning?',
  },
  {
    step: 3,
    type: 'email',
    subject: "Closing the loop on Kubernetes cost optimization",
    delayDays: 4,
    bodySnippet: "No worries if this isn't a priority right now. If your cloud bills spike this quarter, here is our data engine...",
  },
];

function renderStatusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return <Badge variant="verified" className="text-[10px] font-mono">ACTIVE</Badge>;
  if (s === 'PAUSED') return <Badge variant="subtle" className="text-[10px] font-mono">PAUSED</Badge>;
  if (s === 'SCHEDULED') return <Badge variant="matrix" className="text-[10px] font-mono">SCHEDULED</Badge>;
  if (s === 'COMPLETED') return <Badge variant="muted" className="text-[10px] font-mono">COMPLETED</Badge>;
  return <Badge variant="muted" className="text-[10px] font-mono">{s}</Badge>;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<WorkspaceCampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWorkspaceCampaigns();
      if (res.data) {
        setCampaigns(res.data);
      } else {
        setError(res.error || 'Failed to fetch workspace campaigns');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Engine connection error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const toggleSimulation = () => {
    setIsSimulating(!isSimulating);
    notify.info(
      isSimulating
        ? 'Sample simulation paused'
        : 'Sample sequence simulated with jittered dispatch'
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Outbound Campaigns & Sequences
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Choreographed multi-step cold outreach synchronized with table intent signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadCampaigns}
            disabled={isLoading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => notify.info('Campaign builder opens once mailboxes and tables are connected')}
            className="text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </Button>
        </div>
      </div>

      {/* 1. G9: Approval-Before-Send Queue */}
      <ApprovalQueue onStatusChange={loadCampaigns} />

      {/* 2. Real Workspace Campaigns List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Workspace Sequences</h2>
          {!isLoading && !error && (
            <span className="text-xs text-text-muted font-mono">
              {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="p-5 animate-pulse space-y-3">
                <div className="h-5 w-48 bg-canvas-elevated rounded" />
                <div className="h-4 w-32 bg-canvas-elevated rounded" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 border-signal-failed/30 bg-signal-failed/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-signal-failed">Failed to load workspace campaigns</p>
              <p className="text-xs text-text-muted mt-0.5">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={loadCampaigns} className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry</span>
            </Button>
          </Card>
        ) : campaigns.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<Send className="w-6 h-6 text-text-muted" />}
              title="No campaigns yet"
              description="Create a campaign to sequence outreach across your mailboxes."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((camp) => (
              <Card
                key={camp.id}
                className="p-5 flex flex-col justify-between hover:border-border-muted transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Send className="w-4 h-4 text-brand-matrix shrink-0" />
                      <span className="text-sm font-bold text-text-primary truncate">{camp.name}</span>
                    </div>
                    {renderStatusBadge(camp.status)}
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-text-muted font-mono">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Daily limit: {camp.dailyLimitTotal.toLocaleString()} emails/day</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>TZ: {camp.scheduleTimezone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Created: {new Date(camp.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-end">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>View Campaign</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 2. Sample Preview: Sequence Step Flow */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Sequence Step Flow</h2>
            <Badge variant="subtle" className="text-[10px] font-mono">
              Sample preview
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-text-muted hidden sm:block">
              Demonstration flow illustrating multi-touch cadence with jittered delivery.
            </p>
            <Button
              size="sm"
              variant={isSimulating ? 'outline' : 'primary'}
              onClick={toggleSimulation}
              className="text-xs py-1"
            >
              {isSimulating ? (
                <>
                  <Pause className="w-3 h-3 mr-1" />
                  <span>Pause Preview</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current mr-1" />
                  <span>Simulate Dispatch</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border-subtle">
          {MOCK_CAMPAIGN_STEPS.map((step) => (
            <div key={step.step} className="relative group">
              <div className="absolute -left-6 top-3 w-5 h-5 rounded-full bg-canvas-elevated border-2 border-brand-loom flex items-center justify-center text-[10px] font-bold text-brand-loom">
                {step.step}
              </div>

              <Card className="p-4 hover:border-border-muted transition-all shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary">
                      Step {step.step}: Outbound Email
                    </span>
                    {step.delayDays > 0 ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas-elevated text-brand-weave flex items-center gap-1 border border-border-subtle">
                        <Clock className="w-3 h-3" /> Wait {step.delayDays} business days
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-signal-verified/15 text-signal-verified border border-signal-verified/30">
                        Instant dispatch
                      </span>
                    )}
                  </div>
                  <Badge variant="subtle" className="text-[10px] font-mono">
                    Sample preview
                  </Badge>
                </div>

                <div className="text-xs font-semibold text-text-secondary mb-1.5 font-mono">
                  Subject: <span className="text-text-primary font-sans">{step.subject}</span>
                </div>

                <p className="text-xs text-text-muted italic bg-canvas-elevated/40 p-2.5 rounded-lg border border-border-subtle">
                  &ldquo;{step.bodySnippet}&rdquo;
                </p>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
