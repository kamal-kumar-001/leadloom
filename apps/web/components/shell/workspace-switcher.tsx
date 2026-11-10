'use client';

import React from 'react';
import { Building } from 'lucide-react';
import { shortWorkspaceId, useShellIdentity } from './identity';

/** Shows the signed-in workspace from the engine. Multi-workspace switching is not built yet, so there is no menu. */
export function WorkspaceSwitcher() {
  const { workspaceId, role } = useShellIdentity();
  return (
    <div className="w-full flex items-center p-2 rounded-lg bg-canvas-elevated border border-border-subtle text-left">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-md bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center shrink-0">
          <Building className="w-3.5 h-3.5 text-brand-loom" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-text-primary truncate">
            {workspaceId ? `Workspace ${shortWorkspaceId(workspaceId)}` : 'Workspace'}
          </div>
          <div className="text-[10px] text-text-muted font-mono truncate">{role || ''}</div>
        </div>
      </div>
    </div>
  );
}
