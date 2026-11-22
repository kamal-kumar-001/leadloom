'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge } from '@leadloom/ui';
import {
  Activity,
  Database,
  Globe,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Send,
  FileSearch,
} from 'lucide-react';
import { fetchSetupHealth } from '../../lib/engine-client';
import type { SetupHealthResponse } from '@leadloom/contracts';
import { notify } from '../../lib/notify';

export interface SetupHealthCardProps {
  initialHealth?: SetupHealthResponse | null;
  onRefresh?: () => void;
}

export function SetupHealthCard({ initialHealth }: SetupHealthCardProps) {
  const [health, setHealth] = useState<SetupHealthResponse | null>(initialHealth || null);
  const [isLoading, setIsLoading] = useState(!initialHealth);
  const [error, setError] = useState<string | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchSetupHealth();
      if (res.error && !res.health) {
        setError(res.error);
      } else if (res.health) {
        setHealth(res.health);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to query setup health');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialHealth) {
      loadHealth();
    }
  }, [initialHealth, loadHealth]);

  const getStatusBadge = () => {
    if (isLoading && !health) {
      return (
        <Badge variant="muted" className="text-xs">
          Checking...
        </Badge>
      );
    }
    if (error && !health) {
      return (
        <Badge variant="failed" className="text-xs">
          Unavailable
        </Badge>
      );
    }
    if (health?.status === 'ok') {
      return (
        <Badge variant="verified" className="text-xs">
          <CheckCircle2 className="w-3 h-3 text-signal-verified" />
          <span>Operational</span>
        </Badge>
      );
    }
    if (health?.status === 'degraded') {
      return (
        <Badge variant="catchall" className="text-xs">
          <AlertTriangle className="w-3 h-3 text-signal-catchall" />
          <span>Degraded</span>
        </Badge>
      );
    }
    return (
      <Badge variant="failed" className="text-xs">
        <XCircle className="w-3 h-3 text-signal-failed" />
        <span>Action Required</span>
      </Badge>
    );
  };

  const getDatabaseVerdictBadge = (verdict?: string) => {
    switch (verdict) {
      case 'READY':
        return (
          <Badge variant="verified" className="text-xs">
            Ready
          </Badge>
        );
      case 'DEGRADED':
        return (
          <Badge variant="catchall" className="text-xs">
            Degraded Columns
          </Badge>
        );
      case 'MISSING_TABLES':
        return (
          <Badge variant="failed" className="text-xs">
            Missing Tables
          </Badge>
        );
      case 'UNCONFIGURED':
        return (
          <Badge variant="muted" className="text-xs">
            Unconfigured
          </Badge>
        );
      default:
        return (
          <Badge variant="failed" className="text-xs">
            {verdict || 'Unreachable'}
          </Badge>
        );
    }
  };

  return (
    <Card className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-loom/10 border border-brand-loom/30 flex items-center justify-center text-brand-loom shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-semibold text-text-primary">
                System & Setup Health
              </h2>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Read-only preflight of database schema, environment variables, and provider gates.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadHealth();
            notify.info('Auditing setup dependencies...');
          }}
          disabled={isLoading}
          className="text-xs gap-1.5 self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Re-check</span>
        </Button>
      </div>

      {/* Error state */}
      {error && !health && (
        <div className="p-3.5 rounded-lg bg-signal-failed/10 border border-signal-failed/30 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 text-signal-failed shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-signal-failed">Health check query failed</p>
            <p className="text-xs text-text-secondary mt-0.5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadHealth} className="text-xs shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Dependency Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Database & Schema */}
        <div className="p-3.5 rounded-lg bg-canvas-elevated border border-border-subtle flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <Database className="w-3.5 h-3.5 text-brand-loom" />
                <span>Database Schema</span>
              </div>
              {getDatabaseVerdictBadge(health?.database?.verdict)}
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Strictly read-only inspection of required project, context, and validation tables.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border-subtle/60 text-xs">
            <div className="flex items-center justify-between text-text-muted">
              <span>Inspection:</span>
              <span className="text-text-secondary">
                Column-presence only
              </span>
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>Core Tables:</span>
              <span className="text-text-secondary">
                {health?.database?.verdict === 'READY'
                  ? 'All 6 present (types unverified)'
                  : health?.database?.missingTables?.length
                    ? `${health.database.missingTables.length} missing`
                    : health?.database?.status || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Public API & Agent Ingress */}
        <div className="p-3.5 rounded-lg bg-canvas-elevated border border-border-subtle flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <Globe className="w-3.5 h-3.5 text-brand-loom" />
                <span>Public Agent Gateway</span>
              </div>
              {health?.config?.publicApiConfigured ? (
                <Badge variant="verified" className="text-xs">
                  Configured
                </Badge>
              ) : (
                <Badge variant="catchall" className="text-xs">
                  Default Fallback
                </Badge>
              )}
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Customer bearer gateway destination mounted at <code className="font-mono text-text-primary">/api/agent</code>.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border-subtle/60 text-xs">
            <div className="flex items-center justify-between text-text-muted">
              <span>Origin Base:</span>
              <span className="font-mono text-text-secondary truncate max-w-[180px]">
                {health?.config?.publicApiUrl || 'https://leadloom.dmpilot.org/api/agent'}
              </span>
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>Auth Session Bridge:</span>
              <span className="text-text-secondary">
                {health?.config?.authSecretConfigured ? 'Secured' : 'Missing Auth Key'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Providers & Dispatch Fences */}
        <div className="p-3.5 rounded-lg bg-canvas-elevated border border-border-subtle flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <Radio className="w-3.5 h-3.5 text-brand-loom" />
                <span>Providers & Fences</span>
              </div>
              {health?.providers?.outboundDispatch === 'live' ? (
                <Badge variant="catchall" className="text-xs">
                  Live Dispatch
                </Badge>
              ) : (
                <Badge variant="verified" className="text-xs">
                  Dry-Run Safe
                </Badge>
              )}
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Outbound dispatch guardrails, heuristic research fetcher, and AES vault encryption.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border-subtle/60 text-xs">
            <div className="flex items-center justify-between text-text-muted">
              <span>Website Research:</span>
              <span className="text-text-secondary">
                {health?.providers?.websiteFetcher === 'active'
                  ? 'Headless Fetch'
                  : health?.providers?.websiteFetcher === 'pasted-text-only'
                    ? 'Pasted Text Only'
                    : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>Vault Encryption:</span>
              <span className="text-text-secondary">
                {health?.providers?.vaultEncryption === 'active-aes-256-gcm'
                  ? 'AES-256-GCM Active'
                  : 'Unconfigured'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Diagnostic Banner if Degraded or Error */}
      {health?.database?.verdict !== 'READY' && health?.database?.diagnostic && (
        <div className="p-3.5 rounded-lg bg-signal-catchall/10 border border-signal-catchall/30 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-signal-catchall shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-signal-catchall">Schema Recommendation</p>
            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
              {health.database.diagnostic}
            </p>
          </div>
        </div>
      )}

      {/* Expandable Core Tables Checklist */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setIsDetailsExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-border-focus rounded"
        >
          {isDetailsExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          <span>{isDetailsExpanded ? 'Hide' : 'Inspect'} required core schema tables</span>
        </button>

        {isDetailsExpanded && (
          <div className="mt-3 p-3 rounded-lg bg-canvas-elevated border border-border-subtle grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              { name: 'projects', label: 'Projects Registry' },
              { name: 'agent_tokens', label: 'Agent API Tokens' },
              { name: 'project_contexts', label: 'Project Contexts' },
              { name: 'validation_experiments', label: 'Validation Experiments' },
              { name: 'smoke_test_pages', label: 'Smoke Test Pages' },
              { name: 'waitlist_leads', label: 'Waitlist Leads' },
            ].map((tbl) => {
              const isMissing = health?.database?.missingTables?.includes(tbl.name);
              const isReady = health?.database?.verdict === 'READY';
              return (
                <div
                  key={tbl.name}
                  className="flex items-center justify-between p-2 rounded bg-canvas-surface border border-border-subtle/50"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-text-primary truncate">{tbl.name}</span>
                  </div>
                  {isReady || !isMissing ? (
                    <Badge variant="verified" className="text-[10px] px-1.5 py-0">
                      Present
                    </Badge>
                  ) : (
                    <Badge variant="failed" className="text-[10px] px-1.5 py-0">
                      Missing
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
