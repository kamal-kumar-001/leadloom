'use client';

import { signOut } from 'next-auth/react';
import React, { useState } from 'react';
import { Card, Badge, Button } from '@leadloom/ui';
import { Building2, UserCheck, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { notify } from '../../../lib/notify';
import {
  acceptMyInvitation,
  mapAcceptErrorCode,
  type MyInvitation,
} from '../../../lib/team-api';

export interface InviteeCardProps {
  invitations: MyInvitation[];
  onRefresh: () => void;
}

export function InviteeCard({
  invitations,
  onRefresh,
}: InviteeCardProps) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<{ id: string; message: string } | null>(null);
  const [acceptedSuccess, setAcceptedSuccess] = useState<{
    workspaceName: string;
    role: string;
  } | null>(null);

  if (invitations.length === 0 && !acceptedSuccess) {
    return null;
  }

  const handleAccept = async (inv: MyInvitation) => {
    setAcceptingId(inv.id);
    setErrorNotice(null);

    try {
      const res = await acceptMyInvitation(inv.id);

      if (!res.ok) {
        const msg = mapAcceptErrorCode(res.code);
        setErrorNotice({ id: inv.id, message: msg });
        if (res.code !== 'has_workspace_data') {
          notify.error(msg);
        }
        return;
      }

      setAcceptedSuccess({
        workspaceName: inv.workspaceName,
        role: res.data?.role || inv.role,
      });
      notify.success(`Accepted invitation to join ${inv.workspaceName}.`);
      // The engine just ended this session: tell the parent to hide the old workspace's controls.
      onRefresh();
    } catch {
      notify.error('Failed to accept invitation. Please try again.');
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <Card className="p-5 sm:p-6 space-y-4 border-brand-loom/30 bg-canvas-elevated">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-loom/15 border border-brand-loom/30 flex items-center justify-center text-brand-loom shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary tracking-tight">
            Pending Workspace Invitations for You
          </h3>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            Accepting moves your account into that workspace. This only works for an account with no data of its own.
          </p>
        </div>
      </div>

      {/* Success banner requiring re-authentication */}
      {acceptedSuccess && (
        <div className="p-4 rounded-xl bg-signal-verified/10 border border-signal-verified/30 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-signal-verified">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Invitation Accepted</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            You have successfully joined <strong className="text-text-primary">{acceptedSuccess.workspaceName}</strong> as a{' '}
            <strong className="text-text-primary capitalize">{acceptedSuccess.role.replace('_', ' ')}</strong>. Because your workspace and permissions have changed, you must sign in again to activate your new session.
          </p>
          <div className="pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                signOut({ callbackUrl: '/login' });
              }}
              className="text-xs gap-1.5"
            >
              <span>Sign in again</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* List of pending invites */}
      <div className="space-y-3 pt-1">
        {!acceptedSuccess && invitations.map((inv) => {
          const isProcessing = acceptingId === inv.id;
          const expiresDate = new Date(inv.expiresAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const hasError = errorNotice?.id === inv.id;

          return (
            <div
              key={inv.id}
              className="p-4 rounded-xl bg-canvas-surface border border-border-subtle space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-primary">
                      {inv.workspaceName}
                    </span>
                    <Badge variant="loom" className="text-[10px] py-0 px-1.5 capitalize">
                      {inv.role.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-text-muted flex items-center gap-1.5 flex-wrap">
                    <span>
                      Invited by {inv.inviterName || 'Workspace Administrator'}
                    </span>
                    <span>•</span>
                    <span>Expires {expiresDate}</span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => handleAccept(inv)}
                  className="text-xs shrink-0 gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Accepting…' : 'Accept Invitation'}</span>
                </Button>
              </div>

              {/* Explanatory error (e.g. has_workspace_data) */}
              {hasError && (
                <div className="p-3 rounded-lg bg-signal-failed/10 border border-signal-failed/25 flex items-start gap-2.5 text-signal-failed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{errorNotice.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
