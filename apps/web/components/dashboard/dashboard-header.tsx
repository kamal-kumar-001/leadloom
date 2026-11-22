'use client';

import React from 'react';
import { Badge, Button } from '@leadloom/ui';
import { RefreshCw, User, Building, Shield, Sparkles } from 'lucide-react';

export interface UserWorkspaceInfo {
  userId?: string;
  name?: string | null;
  email: string | null;
  workspaceId: string;
  workspaceName?: string | null;
  role: string;
  isPlatformAdmin?: boolean;
}

interface DashboardHeaderProps {
  info: UserWorkspaceInfo | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader({ info, isLoading, error, onRetry }: DashboardHeaderProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-canvas-elevated animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-4 w-36 rounded bg-canvas-elevated animate-pulse" />
          <div className="h-4 w-28 rounded bg-canvas-elevated animate-pulse" />
          <div className="h-4 w-16 rounded bg-canvas-elevated animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-border-subtle bg-canvas-surface">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Workspace Overview</h1>
          <p className="text-xs text-signal-failed mt-1">Unable to load workspace profile: {error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} className="self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          <span>Retry</span>
        </Button>
      </div>
    );
  }

  const userGreetingName = info?.name || (info?.email ? info.email.split('@')[0] : 'Operator');
  const roleText = info?.isPlatformAdmin
    ? 'Platform Admin'
    : info?.role === 'admin'
    ? 'Admin'
    : info?.role === 'read_only'
    ? 'Read Only'
    : 'Member';

  const workspaceDisplay = info?.workspaceName
    ? info.workspaceName
    : info?.workspaceId
    ? `Workspace (${info.workspaceId.slice(0, 8)})`
    : 'Default Workspace';

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <span>{`${greeting()}, ${userGreetingName}`}</span>
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Signal-driven outbound sequencing and wholesale BYOK enrichment overview.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary pt-1">
        {info?.email && (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="font-mono text-text-primary">{info.email}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>{workspaceDisplay}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-brand-loom shrink-0" />
          <Badge variant="subtle" className="text-[11px] font-medium">
            {roleText}
          </Badge>
        </div>
      </div>
    </div>
  );
}
