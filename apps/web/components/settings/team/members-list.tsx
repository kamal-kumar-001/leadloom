'use client';

import React, { useState } from 'react';
import { Badge, Button } from '@leadloom/ui';
import { Shield, Trash2, CheckCircle2 } from 'lucide-react';
import { ConfirmDialog } from '../../feedback/confirm-dialog';
import { notify } from '../../../lib/notify';
import {
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  mapMemberErrorCode,
  type TeamMember,
  type TeamRole,
} from '../../../lib/team-api';

export interface MembersListProps {
  members: TeamMember[];
  currentUserId?: string | null;
  currentUserEmail?: string | null;
  isOwner: boolean;
  ownerId?: string | null;
  onRefresh: () => void;
}

export function MembersList({
  members,
  currentUserId,
  currentUserEmail,
  isOwner,
  ownerId,
  onRefresh,
}: MembersListProps) {
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // The owner is the member explicitly marked as owner, or the earliest created admin (first item)
  const resolvedOwnerId = ownerId || (members.length > 0 ? members[0].id : null);

  const handleRoleChange = async (member: TeamMember, newRole: TeamRole) => {
    if (member.role === newRole) return;
    setUpdatingMemberId(member.id);
    try {
      const res = await updateWorkspaceMemberRole(member.id, newRole);
      if (!res.ok) {
        notify.error(mapMemberErrorCode(res.code));
        return;
      }
      notify.success('Member role updated.');
      onRefresh();
    } catch {
      notify.error('Failed to update member role. Please try again.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    try {
      const res = await removeWorkspaceMember(memberToRemove.id);
      if (!res.ok) {
        notify.error(mapMemberErrorCode(res.code));
        return;
      }
      notify.success('Member access suspended.');
      setMemberToRemove(null);
      onRefresh();
    } catch {
      notify.error('Failed to remove member. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {members.map((member) => {
        const isThisMemberOwner = member.id === resolvedOwnerId;
        const isSelf =
          (currentUserId && member.id === currentUserId) ||
          (currentUserEmail && member.email.toLowerCase() === currentUserEmail.toLowerCase());

        const initial = (member.name || member.email || 'U').charAt(0).toUpperCase();

        return (
          <div
            key={member.id}
            className="p-3.5 rounded-xl bg-canvas-elevated border border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            {/* Identity and Badges */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center font-bold text-xs text-brand-loom shrink-0">
                {initial}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-medium text-text-primary truncate">
                    {member.email}
                  </span>

                  {isSelf && (
                    <Badge variant="subtle" className="text-[10px] py-0 px-1.5 font-mono">
                      You
                    </Badge>
                  )}

                  {isThisMemberOwner && (
                    <Badge variant="loom" className="text-[10px] py-0 px-1.5 font-semibold">
                      Owner
                    </Badge>
                  )}

                  {!member.verified && (
                    <Badge variant="subtle" className="text-[10px] py-0 px-1.5">
                      Not verified
                    </Badge>
                  )}

                  {!member.active && (
                    <Badge variant="subtle" className="text-[10px] py-0 px-1.5">
                      Suspended
                    </Badge>
                  )}
                </div>

                <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
                  {member.name && (
                    <>
                      <span>{member.name}</span>
                      <span>•</span>
                    </>
                  )}
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-text-muted" />
                    <span className="capitalize">{member.role.replace('_', ' ')}</span>
                  </div>
                  {member.verified && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-signal-verified">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: Owner row has NO role picker and NO remove controls */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {isThisMemberOwner ? (
                <div className="px-2.5 py-1 text-xs text-text-muted font-medium select-none">
                  Workspace Owner
                </div>
              ) : (
                <>
                  {/* Role picker */}
                  <div className="relative">
                    <select
                      aria-label={`Role for ${member.email}`}
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value as TeamRole)}
                      disabled={
                        updatingMemberId === member.id ||
                        isSelf ||
                        (!isOwner && member.role === 'admin')
                      }
                      className="bg-canvas-surface border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom disabled:opacity-50 motion-reduce:transition-none"
                    >
                      <option value="read_only">Read-only</option>
                      <option value="member">Member</option>
                      {/* Only the owner sees "Admin" in role pickers */}
                      {isOwner && <option value="admin">Admin</option>}
                    </select>
                  </div>

                  {/* Remove control */}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${member.email}`}
                    title="Remove access"
                    onClick={() => setMemberToRemove(member)}
                    disabled={
                      isSelf ||
                      (!isOwner && member.role === 'admin')
                    }
                    className="h-7 w-7 p-0 text-text-muted hover:text-signal-failed focus-visible:ring-2 focus-visible:ring-brand-loom"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Confirmation Dialog for Suspension / Removal */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        title="Suspend Member Access"
        description={
          memberToRemove
            ? `Are you sure you want to remove ${memberToRemove.email}? Their access will be suspended immediately and their existing workspace data will be kept.`
            : ''
        }
        confirmLabel="Suspend Access"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isRemoving}
        onConfirm={handleConfirmRemove}
        onCancel={() => setMemberToRemove(null)}
      />
    </div>
  );
}
