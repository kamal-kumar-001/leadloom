'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@leadloom/ui';
import { UserPlus, Info } from 'lucide-react';
import { FormField } from '../../feedback/form-field';
import { notify } from '../../../lib/notify';
import {
  createWorkspaceInvitation,
  mapInviteErrorCode,
  type TeamRole,
} from '../../../lib/team-api';

export interface InviteMemberDialogProps {
  isOpen: boolean;
  isOwner: boolean;
  onClose: () => void;
  onInviteSuccess: () => void;
}

const ROLES: { id: TeamRole; label: string; description: string }[] = [
  { id: 'member', label: 'Member', description: 'Can view and edit workspace data.' },
  { id: 'read_only', label: 'Read-only', description: 'Can view data but cannot create or modify items.' },
  { id: 'admin', label: 'Admin', description: 'Full access to manage workspace settings and members.' },
];

export function InviteMemberDialog({
  isOpen,
  isOwner,
  onClose,
  onInviteSuccess,
}: InviteMemberDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; role?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Available roles: only the workspace owner can invite an Admin
  const availableRoles = isOwner ? ROLES : ROLES.filter((r) => r.id !== 'admin');

  useEffect(() => {
    if (isOpen) {
      setSuccessNotice(null);
      setEmail('');
      setRole('member');
      setFieldErrors({});
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard navigation: Escape to close, Tab to trap focus
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    const errors: { email?: string; role?: string } = {};
    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!isOwner && role === 'admin') {
      errors.role = 'Only the workspace owner may invite an admin.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await createWorkspaceInvitation(trimmedEmail, role);

      if (!res.ok) {
        const message = mapInviteErrorCode(res.code);
        if (res.code === 'account_exists') {
          setFieldErrors({ email: message });
        } else if (res.code === 'invalid_email' || res.code === 'already_invited') {
          setFieldErrors({ email: message });
        } else if (res.code === 'owner_only') {
          setFieldErrors({ role: message });
        } else {
          notify.error(message);
        }
        return;
      }

      // Success: Per rule, inform that no email was sent
      setSuccessNotice(
        'No email was sent. Tell them to sign in (or sign up) with this address, then open Settings and accept the invitation.'
      );
      notify.success('Invitation created.');
      onInviteSuccess();
    } catch {
      notify.error('Failed to create invitation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-xs font-sans motion-reduce:transition-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-dialog-title"
        aria-describedby="invite-dialog-description"
        className="bg-canvas-surface border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl relative motion-reduce:animate-none motion-reduce:transition-none"
      >
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-brand-loom/15 border border-brand-loom/30 flex items-center justify-center text-brand-loom shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="invite-dialog-title"
              className="text-base font-semibold text-text-primary tracking-tight"
            >
              Invite Teammate
            </h2>
            <p
              id="invite-dialog-description"
              className="mt-1 text-xs text-text-muted leading-relaxed"
            >
              Invite someone to join this workspace. They accept from Settings after signing in.
            </p>
          </div>
        </div>

        {successNotice ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-canvas-elevated border border-border-subtle space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <Info className="w-4 h-4 text-brand-loom shrink-0" />
                <span>Invitation Ready</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {successNotice}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              id="invite-email"
              label="Email Address"
              hint="Must not already have an account. No email will be sent automatically."
              required
              error={fieldErrors.email}
            >
              <input
                ref={emailInputRef}
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                disabled={isSubmitting}
                autoComplete="off"
                className="w-full bg-canvas-surface border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom focus:border-brand-loom motion-reduce:transition-none"
              />
            </FormField>

            <FormField
              id="invite-role"
              label="Role"
              hint="Select the permissions level for this teammate."
              required
              error={fieldErrors.role}
            >
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as TeamRole)}
                disabled={isSubmitting}
                className="w-full bg-canvas-surface border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom focus:border-brand-loom motion-reduce:transition-none"
              >
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} — {r.description}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Point of action notice */}
            <div className="p-3 rounded-xl bg-canvas-elevated border border-border-subtle flex items-start gap-2.5 text-text-muted">
              <Info className="w-4 h-4 text-brand-loom shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                No invitation email is sent. Ask them to sign up with this address, then open Settings and accept the invitation.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
                className="text-xs"
              >
                {isSubmitting ? 'Creating Invitation…' : 'Create Invitation'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
