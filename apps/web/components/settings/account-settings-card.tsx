'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, Badge, Button } from '@leadloom/ui';
import { signOut } from 'next-auth/react';
import { User, Building, Shield, LogOut, CheckCircle2, Lock, ArrowUpRight } from 'lucide-react';
import { useShellIdentity, shortWorkspaceId } from '../shell/identity';
import { notify } from '../../lib/notify';

export function AccountSettingsCard() {
  const { name, email, workspaceId, role, isPlatformAdmin, updateName } = useShellIdentity();
  const [displayName, setDisplayName] = useState(name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const formattedRole = isPlatformAdmin
    ? 'Platform Admin'
    : role === 'admin'
    ? 'Admin'
    : role === 'read_only'
    ? 'Read Only'
    : 'Member';

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      notify.error('Display name cannot be empty');
      return;
    }
    setIsSavingName(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok === true && typeof data.name === 'string') {
        updateName?.(data.name);
        setIsEditingName(false);
        notify.success('Profile display name updated');
      } else {
        notify.error(data?.error || 'Failed to update name');
      }
    } catch {
      notify.error('Network error updating profile name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 10) {
      notify.error('Password must be at least 10 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error('New password and confirmation do not match');
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      if (res.ok) {
        setIsChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        notify.success('Password updated. Please sign in again.');
        await signOut({ callbackUrl: '/login' });
      } else {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || 'Failed to update password');
      }
    } catch {
      notify.error('Network error updating password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary tracking-tight">
            Account & Profile
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Identity and tenant workspace privileges verified by the core engine.
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

      {/* Account Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border-subtle pt-4">
        {/* Email */}
        <div className="p-3.5 rounded-lg bg-canvas-elevated border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Signed In As</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-signal-verified font-mono">
              <CheckCircle2 className="w-3 h-3" />
              <span>Verified</span>
            </div>
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
          <div className="flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-brand-loom" />
              <span>Assigned Privilege</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge variant="subtle" className="text-[11px] font-medium">
              {formattedRole}
            </Badge>
            {isPlatformAdmin && (
              <Link href="/admin">
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-brand-loom gap-1">
                  <span>Operator Console</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Editable Name Section */}
      <div className="border-t border-border-subtle pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-text-primary">Display Name</div>
            <div className="text-[11px] text-text-muted">Used in greetings, team invites, and notifications.</div>
          </div>
          {!isEditingName && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingName(true)}
              className="text-xs h-7"
            >
              Edit Name
            </Button>
          )}
        </div>

        {isEditingName ? (
          <form onSubmit={handleSaveName} className="flex items-center gap-2 max-w-md">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              className="flex-1 rounded-lg border border-border-subtle bg-canvas-elevated px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-loom font-sans"
              autoFocus
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingName}
              className="text-xs h-7"
            >
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDisplayName(name || '');
                setIsEditingName(false);
              }}
              className="text-xs h-7"
            >
              Cancel
            </Button>
          </form>
        ) : (
          <div className="text-xs font-medium text-text-primary">
            {name || (email ? email.split('@')[0] : 'Not specified')}
          </div>
        )}
      </div>

      {/* Password & Security Section */}
      <div className="border-t border-border-subtle pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-text-primary">Account Password</div>
            <div className="text-[11px] text-text-muted">Minimum 10 characters. Required for credentials login.</div>
          </div>
          {!isChangingPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangingPassword(true)}
              className="text-xs h-7"
            >
              Change Password
            </Button>
          )}
        </div>

        {isChangingPassword && (
          <form onSubmit={handleSavePassword} className="space-y-2.5 max-w-md pt-1">
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full rounded-lg border border-border-subtle bg-canvas-elevated px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-loom font-sans"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 10 characters"
                minLength={10}
                className="w-full rounded-lg border border-border-subtle bg-canvas-elevated px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-loom font-sans"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                minLength={10}
                className="w-full rounded-lg border border-border-subtle bg-canvas-elevated px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-loom font-sans"
                required
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSavingPassword}
                className="text-xs h-7"
              >
                Update Password
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setIsChangingPassword(false);
                }}
                className="text-xs h-7"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
