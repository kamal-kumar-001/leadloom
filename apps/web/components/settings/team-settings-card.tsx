'use client';

import React from 'react';
import { Card, Badge, EmptyState } from '@leadloom/ui';
import { User, Users, Shield } from 'lucide-react';
import { useShellIdentity } from '../shell/identity';

export function TeamSettingsCard() {
  const { email, role } = useShellIdentity();

  const formattedRole = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'Member';

  const initial = email ? email.charAt(0).toUpperCase() : 'U';

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-text-primary tracking-tight">
          Team Members
        </h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Verified users with authorized access to this workspace.
        </p>
      </div>

      {/* Current User Row */}
      <div className="border-t border-border-subtle pt-4">
        <div className="p-3.5 rounded-xl bg-canvas-elevated border border-border-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center font-bold text-xs text-brand-loom shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-text-primary truncate">
                  {email || 'Loading…'}
                </span>
                <Badge variant="loom" className="text-[10px] py-0 px-1.5 font-mono">
                  You
                </Badge>
              </div>
              <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                <Shield className="w-3 h-3 text-text-muted" />
                <span>{formattedRole}</span>
              </div>
            </div>
          </div>

          <Badge variant="subtle" className="text-[11px] shrink-0 font-medium">
            Active
          </Badge>
        </div>
      </div>

      {/* Honest Empty State for Teammates */}
      <EmptyState
        icon={<Users className="w-5 h-5 text-text-muted" />}
        title="Inviting teammates is not available yet"
        description="Workspace member invites and role assignment are currently under development. Additional seats will be configurable once multi-tenant team management is mounted."
        className="py-6 px-4"
      />
    </Card>
  );
}
