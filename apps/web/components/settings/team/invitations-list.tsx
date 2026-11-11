'use client';

import React, { useState } from 'react';
import { Badge, Button } from '@leadloom/ui';
import { Mail, XCircle, Info, Clock } from 'lucide-react';
import { ConfirmDialog } from '../../feedback/confirm-dialog';
import { notify } from '../../../lib/notify';
import {
  revokeWorkspaceInvitation,
  type TeamInvitation,
} from '../../../lib/team-api';

export interface InvitationsListProps {
  invitations: TeamInvitation[];
  onRefresh: () => void;
}

export function InvitationsList({
  invitations,
  onRefresh,
}: InvitationsListProps) {
  const [inviteToRevoke, setInviteToRevoke] = useState<TeamInvitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleConfirmRevoke = async () => {
    if (!inviteToRevoke) return;
    setIsRevoking(true);
    try {
      const res = await revokeWorkspaceInvitation(inviteToRevoke.id);
      if (!res.ok) {
        notify.error('Unable to revoke invitation.');
        return;
      }
      notify.success('Invitation revoked.');
      setInviteToRevoke(null);
      onRefresh();
    } catch {
      notify.error('Failed to revoke invitation.');
    } finally {
      setIsRevoking(false);
    }
  };

  const getStatusBadge = (status: TeamInvitation['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="loom" className="text-[10px] py-0 px-1.5 font-medium">
            Pending
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="subtle" className="text-[10px] py-0 px-1.5 font-medium">
            Expired
          </Badge>
        );
      case 'accepted':
        return (
          <Badge variant="verified" className="text-[10px] py-0 px-1.5 font-medium">
            Accepted
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="subtle" className="text-[10px] py-0 px-1.5 font-medium">
            Revoked
          </Badge>
        );
    }
  };

  if (invitations.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-canvas-elevated border border-border-subtle text-center space-y-1">
        <p className="text-xs font-medium text-text-secondary">No invitations created yet.</p>
        <p className="text-[11px] text-text-muted">
          Click &quot;Invite Teammate&quot; above to invite a new user to this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Point of action reminder */}
      <div className="p-3 rounded-xl bg-canvas-elevated border border-border-subtle flex items-start gap-2.5 text-text-muted">
        <Info className="w-4 h-4 text-brand-loom shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          No invitation emails are sent. Tell invitees to sign in or sign up with their invited email address, then open Settings to accept.
        </p>
      </div>

      <div className="space-y-2.5">
        {invitations.map((inv) => {
          const isPending = inv.status === 'pending';
          const expiresFormatted = new Date(inv.expiresAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          return (
            <div
              key={inv.id}
              className="p-3.5 rounded-xl bg-canvas-elevated border border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-canvas-surface border border-border-subtle flex items-center justify-center text-text-muted shrink-0">
                  <Mail className="w-4 h-4 text-brand-loom" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-medium text-text-primary truncate">
                      {inv.email}
                    </span>
                    {getStatusBadge(inv.status)}
                    <Badge variant="subtle" className="text-[10px] py-0 px-1.5 capitalize">
                      {inv.role.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-text-muted" />
                    <span>
                      {isPending ? `Expires ${expiresFormatted}` : `Created ${new Date(inv.createdAt).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
              </div>

              {isPending && (
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviteToRevoke(inv)}
                    className="text-xs text-text-muted hover:text-signal-failed gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Revoke</span>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Revoke confirmation */}
      <ConfirmDialog
        isOpen={Boolean(inviteToRevoke)}
        title="Revoke Invitation"
        description={
          inviteToRevoke
            ? `Are you sure you want to revoke the invitation for ${inviteToRevoke.email}? They will no longer be able to accept it.`
            : ''
        }
        confirmLabel="Revoke Invitation"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isRevoking}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setInviteToRevoke(null)}
      />
    </div>
  );
}
