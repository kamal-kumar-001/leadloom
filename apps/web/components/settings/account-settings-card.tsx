'use client';

import React from 'react';
import { Card, Badge, Button } from '@leadloom/ui';
import { signOut } from 'next-auth/react';
import { User, Building, Shield, LogOut } from 'lucide-react';
import { useShellIdentity, shortWorkspaceId } from '../shell/identity';

export function AccountSettingsCard() {
  const { email, workspaceId, role } = useShellIdentity();

  const formattedRole = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'Member';

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary tracking-tight">
            Account & Workspace
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Identity and permissions verified directly by the core engine.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="self-start sm:self-center text-xs"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          <span>Sign Out</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border-subtle pt-4">
        {/* Email */}
        <div className="p-3.5 rounded-lg bg-canvas-elevated border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <User className="w-3.5 h-3.5" />
            <span>Signed In As</span>
          </div>
          <div className="mt-2 text-xs font-mono text-text-primary truncate font-medium">
            {email || 'Loading…'}
          </div>
        </div>

        {/* Workspace ID */}
        <div className="p-3.5 rounded-lg bg-canvas-elevated border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Building className="w-3.5 h-3.5" />
            <span>Workspace ID</span>
          </div>
          <div className="mt-2 text-xs font-mono text-text-primary truncate font-medium" title={workspaceId || ''}>
            {workspaceId ? `${shortWorkspaceId(workspaceId)}…` : 'Loading…'}
          </div>
        </div>

        {/* Role */}
        <div className="p-3.5 rounded-lg bg-canvas-elevated border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Shield className="w-3.5 h-3.5 text-brand-loom" />
            <span>Workspace Role</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge variant="subtle" className="text-[11px] font-medium">
              {formattedRole}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}
