'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, EmptyState } from '@leadloom/ui';
import { Users, UserPlus, Shield, RefreshCw } from 'lucide-react';
import { useShellIdentity } from '../shell/identity';
import {
  fetchWorkspaceMembers,
  fetchWorkspaceInvitations,
  fetchMyInvitations,
  fetchAuthMe,
  type TeamMember,
  type TeamInvitation,
  type MyInvitation,
} from '../../lib/team-api';
import {
  InviteMemberDialog,
  MembersList,
  InvitationsList,
  InviteeCard,
} from './team';

export function TeamSettingsCard() {
  const { email: shellEmail, role: shellRole } = useShellIdentity();
  const isAdmin = shellRole === 'admin';

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<MyInvitation[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  // Owner comes only from the server (workspaces.owner_user_id). If none is marked, nobody is treated as owner.
  const ownerMember = members.find((m) => m.isOwner === true) ?? null;
  const isOwner = Boolean(
    (currentUserId && ownerMember?.id === currentUserId) ||
    (shellEmail && ownerMember?.email.toLowerCase() === shellEmail.toLowerCase())
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsUnavailable(false);

    try {
      // 1. Fetch authenticated user id
      const meRes = await fetchAuthMe();
      if (meRes.data?.userId) {
        setCurrentUserId(meRes.data.userId);
      }

      // 2. Fetch my pending invitations (available to all roles)
      const myInvRes = await fetchMyInvitations();
      if (myInvRes.ok && myInvRes.data) {
        setMyInvitations(myInvRes.data);
      }

      // 3. If admin, fetch workspace members and invitations
      if (isAdmin) {
        const [membersRes, invitesRes] = await Promise.all([
          fetchWorkspaceMembers(),
          fetchWorkspaceInvitations(),
        ]);

        if (membersRes.unavailable || invitesRes.unavailable) {
          setIsUnavailable(true);
          return;
        }

        if (!membersRes.ok) {
          setError(membersRes.error || 'Failed to load team members.');
        } else {
          setMembers(membersRes.data || []);
        }

        if (invitesRes.ok && invitesRes.data) {
          setInvitations(invitesRes.data);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load team data.');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const initial = shellEmail ? shellEmail.charAt(0).toUpperCase() : 'U';
  const formattedRole = shellRole
    ? shellRole.charAt(0).toUpperCase() + shellRole.slice(1).replace('_', ' ')
    : 'Member';

  // Feature flag OFF on host: honest not available state, NO error toast and NO fake data
  if (isUnavailable) {
    return (
      <Card className="p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text-primary tracking-tight">
            Team & Members
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
                    {shellEmail || 'Loading…'}
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

        <EmptyState
          icon={<Users className="w-5 h-5 text-text-muted" />}
          title="Team management is not available yet"
          description="Workspace member invites, role management, and team settings are currently disabled on this instance."
          className="py-6 px-4"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invitee Card for any signed-in user who has open invitations */}
      <InviteeCard
        invitations={myInvitations}
        onRefresh={loadData}
      />

      <Card className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              Team Members
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Manage members, roles, and invitations for this workspace.
            </p>
          </div>

          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsInviteDialogOpen(true)}
              className="text-xs gap-1.5 self-start sm:self-auto"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Teammate</span>
            </Button>
          )}
        </div>

        {/* Non-Admin Informational View */}
        {!isAdmin && (
          <div className="space-y-4 border-t border-border-subtle pt-4">
            <div className="p-3.5 rounded-xl bg-canvas-elevated border border-border-subtle flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center font-bold text-xs text-brand-loom shrink-0">
                  {initial}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-text-primary truncate">
                      {shellEmail || 'Loading…'}
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

            <div className="p-3.5 rounded-xl bg-canvas-surface border border-border-subtle text-xs text-text-muted leading-relaxed">
              You are signed in as a Member. Only workspace administrators can view all team members or send invitations.
            </div>
          </div>
        )}

        {/* Admin View with Tabs */}
        {isAdmin && (
          <div className="border-t border-border-subtle pt-4 space-y-4">
            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom ${
                  activeTab === 'members'
                    ? 'bg-canvas-elevated text-text-primary border border-border-subtle shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Members ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('invitations')}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom ${
                  activeTab === 'invitations'
                    ? 'bg-canvas-elevated text-text-primary border border-border-subtle shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Invitations ({invitations.length})
              </button>
            </div>

            {/* Loading Skeleton */}
            {isLoading && (
              <div className="space-y-2.5">
                <div className="h-14 rounded-xl bg-canvas-elevated animate-pulse border border-border-subtle" />
                <div className="h-14 rounded-xl bg-canvas-elevated animate-pulse border border-border-subtle" />
              </div>
            )}

            {/* Error State with Retry */}
            {!isLoading && error && (
              <div className="p-4 rounded-xl bg-signal-failed/10 border border-signal-failed/20 text-center space-y-2">
                <p className="text-xs text-signal-failed font-medium">{error}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadData}
                  className="text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  <span>Retry</span>
                </Button>
              </div>
            )}

            {/* Active Tab Content */}
            {!isLoading && !error && activeTab === 'members' && (
              <MembersList
                members={members}
                currentUserId={currentUserId}
                currentUserEmail={shellEmail}
                isOwner={isOwner}
                ownerId={ownerMember?.id}
                onRefresh={loadData}
              />
            )}

            {!isLoading && !error && activeTab === 'invitations' && (
              <InvitationsList
                invitations={invitations}
                onRefresh={loadData}
              />
            )}
          </div>
        )}
      </Card>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        isOpen={isInviteDialogOpen}
        isOwner={isOwner}
        onClose={() => setIsInviteDialogOpen(false)}
        onInviteSuccess={loadData}
      />
    </div>
  );
}
