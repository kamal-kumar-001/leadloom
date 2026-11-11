'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge } from '@leadloom/ui';
import { notify } from '@/lib/notify';
import {
  MailboxPreset,
  connectMailbox,
  MailboxConnectionResult,
} from '../../lib/engine-client';
import {
  Mail,
  X,
  ExternalLink,
  Info,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Server,
} from 'lucide-react';

interface ConnectMailboxDialogProps {
  isOpen: boolean;
  presets: MailboxPreset[];
  onClose: () => void;
  onSuccess: () => void;
}

function mapErrorCodeToMessage(code?: string): string {
  switch (code) {
    case 'auth_failed':
      return 'The provider rejected this login. Check the address and the app password.';
    case 'tls_error':
      return "The server's security certificate could not be verified.";
    case 'timeout':
    case 'unreachable':
      return 'Could not reach the mail server.';
    case 'private_host':
      return 'That server address is not allowed.';
    case 'already_connected':
      return 'This address is already connected.';
    case 'invalid_port':
      return 'The specified port is not supported for mail delivery.';
    case 'invalid_email':
      return 'Please enter a valid email address.';
    case 'invalid_password':
      return 'Please enter the password or app password.';
    case 'invalid_host':
      return 'Please enter a valid mail server hostname.';
    case 'invalid_request':
      return 'Invalid mailbox request parameters.';
    default:
      return 'Connection failed. Please check your credentials and server settings.';
  }
}

export function ConnectMailboxDialog({
  isOpen,
  presets,
  onClose,
  onSuccess,
}: ConnectMailboxDialogProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    presets[0]?.id || 'gmail'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState<number>(993);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionDetails, setConnectionDetails] = useState<MailboxConnectionResult | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const activePreset =
    presets.find((p) => p.id === selectedPresetId) || presets[0];

  // Update preset defaults when preset changes
  useEffect(() => {
    if (activePreset) {
      if (activePreset.id !== 'custom') {
        setSmtpHost(activePreset.smtpHost);
        setSmtpPort(activePreset.smtpPort);
        setImapHost(activePreset.imapHost);
        setImapPort(activePreset.imapPort);
      }
      setErrorMessage(null);
      setConnectionDetails(null);
    }
  }, [activePreset]);

  // Trap focus and handle escape
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      if (typeof triggerRef.current.focus === 'function' && document.contains(triggerRef.current)) {
        triggerRef.current.focus();
      }
      triggerRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

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
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    const trimmedEmail = email.trim().toLowerCase();
    const currentPassword = password;

    if (!trimmedEmail || !currentPassword) {
      setErrorMessage('Please provide both the email address and password.');
      return;
    }

    const effectiveSmtpHost = (activePreset?.id === 'custom' ? smtpHost : activePreset?.smtpHost || smtpHost).trim();
    const effectiveSmtpPort = Number(activePreset?.id === 'custom' ? smtpPort : activePreset?.smtpPort || smtpPort);
    const effectiveImapHost = (activePreset?.id === 'custom' ? imapHost : activePreset?.imapHost || imapHost).trim();
    const effectiveImapPort = Number(activePreset?.id === 'custom' ? imapPort : activePreset?.imapPort || imapPort);

    if (!effectiveSmtpHost || !effectiveImapHost) {
      setErrorMessage('SMTP and IMAP host names are required.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setConnectionDetails(null);

    try {
      const res = await connectMailbox({
        email: trimmedEmail,
        password: currentPassword,
        smtpHost: effectiveSmtpHost,
        smtpPort: effectiveSmtpPort,
        imapHost: effectiveImapHost,
        imapPort: effectiveImapPort,
      });

      // Always clear the password immediately after the request completes
      setPassword('');

      if (res.data) {
        notify.success('Mailbox connected! Login verified. No email was sent.');
        onSuccess();
        onClose();
      } else {
        const msg = mapErrorCodeToMessage(res.code);
        setErrorMessage(msg);
        if (res.result) {
          setConnectionDetails(res.result);
        }
      }
    } catch {
      setPassword('');
      setErrorMessage('Connection failed. Please check your credentials and server settings.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-xs font-sans motion-reduce:transition-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-mailbox-title"
        className="bg-canvas-surface border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative motion-reduce:animate-none space-y-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-loom/20 border border-brand-loom/30 flex items-center justify-center text-brand-loom shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="connect-mailbox-title"
                className="text-base font-semibold text-text-primary tracking-tight"
              >
                Connect a Mailbox
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Connect an IMAP/SMTP sender via app password. We verify the login; no email is sent.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-text-muted hover:text-text-primary p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Provider Picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-primary block">
            Select Mail Provider
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  disabled={isLoading}
                  className={`p-3 rounded-xl border text-left transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom ${
                    isSelected
                      ? 'bg-canvas-elevated border-brand-loom/60 text-text-primary shadow-xs'
                      : 'bg-canvas-surface border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-muted'
                  }`}
                >
                  <div className="text-xs font-medium truncate">{preset.label}</div>
                  <div className="text-[10px] text-text-muted mt-1 font-mono">
                    {preset.id === 'custom' ? 'Custom hosts' : `${preset.smtpPort}/${preset.imapPort}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Preset Instructions & Caveats */}
        {activePreset && (
          <div className="p-4 rounded-xl bg-canvas-elevated/70 border border-border-subtle space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-primary">
                What you need for {activePreset.label}
              </span>
              {activePreset.sourceUrl && (
                <a
                  href={activePreset.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-brand-loom hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-loom rounded"
                >
                  <span>Official guide</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <ol className="list-decimal list-inside space-y-1 text-xs text-text-secondary leading-relaxed">
              {activePreset.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>

            {activePreset.caveat && (
              <div className="flex items-start gap-2 pt-2 border-t border-border-subtle/60 text-xs text-text-muted">
                <Info className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                <span className="leading-relaxed">{activePreset.caveat}</span>
              </div>
            )}
          </div>
        )}

        {/* 3. Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="mailbox-email"
              className="text-xs font-semibold text-text-primary block"
            >
              Email Address <span className="text-signal-failed">*</span>
            </label>
            <input
              id="mailbox-email"
              ref={emailInputRef}
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="sender@company.com"
              className="w-full text-xs px-3.5 py-2.5 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="mailbox-password"
              className="text-xs font-semibold text-text-primary block"
            >
              {activePreset?.secretLabel || 'Password or app password'}{' '}
              <span className="text-signal-failed">*</span>
            </label>
            <input
              id="mailbox-password"
              type="password"
              required
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="••••••••••••••••"
              className="w-full text-xs px-3.5 py-2.5 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-loom font-mono"
            />
            <p className="text-[11px] text-text-muted flex items-center gap-1.5 mt-1">
              <Lock className="w-3 h-3 text-text-muted shrink-0" />
              <span>
                Stored encrypted in Leadloom. We only check that the login works; no email is sent.
              </span>
            </p>
          </div>

          {/* Custom Host & Port Inputs if Custom Provider */}
          {activePreset?.id === 'custom' && (
            <div className="p-3.5 rounded-xl bg-canvas-elevated/40 border border-border-subtle space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <Server className="w-3.5 h-3.5 text-text-muted" />
                <span>Custom Mail Server Endpoints</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="smtp-host" className="text-[11px] font-medium text-text-secondary block">
                    SMTP Host
                  </label>
                  <input
                    id="smtp-host"
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    disabled={isLoading}
                    placeholder="mail.example.com"
                    className="w-full text-xs px-3 py-2 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="smtp-port" className="text-[11px] font-medium text-text-secondary block">
                    SMTP Port
                  </label>
                  <select
                    id="smtp-port"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    disabled={isLoading}
                    className="w-full text-xs px-2.5 py-2 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary font-mono"
                  >
                    <option value={587}>587 (STARTTLS)</option>
                    <option value={465}>465 (SSL/TLS)</option>
                    <option value={25}>25 (Standard)</option>
                    <option value={2525}>2525 (Alt)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="imap-host" className="text-[11px] font-medium text-text-secondary block">
                    IMAP Host
                  </label>
                  <input
                    id="imap-host"
                    type="text"
                    required
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    disabled={isLoading}
                    placeholder="imap.example.com"
                    className="w-full text-xs px-3 py-2 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="imap-port" className="text-[11px] font-medium text-text-secondary block">
                    IMAP Port
                  </label>
                  <select
                    id="imap-port"
                    value={imapPort}
                    onChange={(e) => setImapPort(Number(e.target.value))}
                    disabled={isLoading}
                    className="w-full text-xs px-2.5 py-2 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary font-mono"
                  >
                    <option value={993}>993 (SSL/TLS)</option>
                    <option value={143}>143 (STARTTLS)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-signal-failed/10 border border-signal-failed/20 text-xs text-signal-failed space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
              {connectionDetails && (
                <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-text-muted">
                  <span>Diagnostics:</span>
                  <span className="px-1.5 py-0.5 rounded bg-canvas-elevated border border-border-subtle">
                    SMTP: {connectionDetails.smtp}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-canvas-elevated border border-border-subtle">
                    IMAP: {connectionDetails.imap}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isLoading}
              className="text-xs"
            >
              {isLoading ? 'Verifying login...' : 'Connect Mailbox'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
