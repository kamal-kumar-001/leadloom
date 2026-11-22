'use client';

import React, { useState, useEffect } from 'react';
import { X, Activity, Database, KeyRound, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Badge } from '@leadloom/ui';
import { useShellIdentity, shortWorkspaceId } from './identity';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemDiagnosticsModal({ isOpen, onClose }: SystemDiagnosticsModalProps) {
  const identity = useShellIdentity();
  const [engineHealth, setEngineHealth] = useState<'checking' | 'healthy' | 'unreachable'>('checking');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    fetch('/api/engine/health')
      .then((r) => {
        if (r.ok) setEngineHealth('healthy');
        else setEngineHealth('unreachable');
      })
      .catch(() => setEngineHealth('unreachable'));

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="System Diagnostics & Telemetry"
        className="relative w-full max-w-lg rounded-2xl border border-border-subtle bg-canvas-surface shadow-2xl p-6 space-y-5 font-sans z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-signal-verified/15 border border-signal-verified/30 flex items-center justify-center text-signal-verified">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary tracking-tight">
                System Diagnostics
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Real-time operational telemetry and environment status.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-canvas-elevated transition-colors"
            aria-label="Close diagnostics"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {/* Engine Status */}
          <div className="p-3 rounded-xl border border-border-subtle bg-canvas-elevated flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity className="h-4 w-4 text-brand-loom" />
              <div className="text-xs">
                <div className="font-medium text-text-primary">Core Fastify Engine</div>
                <div className="text-[10px] text-text-muted font-mono">Status check on /health</div>
              </div>
            </div>
            <Badge variant={engineHealth === 'healthy' ? 'matrix' : 'subtle'} className="text-[10px] font-mono">
              {engineHealth === 'healthy' ? 'CONNECTED' : engineHealth === 'checking' ? 'PROBING…' : 'DEGRADED'}
            </Badge>
          </div>

          {/* Database & Tenant Isolation */}
          <div className="p-3 rounded-xl border border-border-subtle bg-canvas-elevated flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="h-4 w-4 text-text-muted" />
              <div className="text-xs">
                <div className="font-medium text-text-primary">Tenant Workspace Partition</div>
                <div className="text-[10px] text-text-muted font-mono" title={identity.workspaceId || ''}>
                  ID: {identity.workspaceId ? `${shortWorkspaceId(identity.workspaceId)}…` : 'Not loaded'}
                </div>
              </div>
            </div>
            <Badge variant="subtle" className="text-[10px] font-mono">
              ISOLATED
            </Badge>
          </div>

          {/* Encryption Vault */}
          <div className="p-3 rounded-xl border border-border-subtle bg-canvas-elevated flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-4 w-4 text-text-muted" />
              <div className="text-xs">
                <div className="font-medium text-text-primary">AES-256-GCM Vault</div>
                <div className="text-[10px] text-text-muted font-mono">Worker loop decryption only</div>
              </div>
            </div>
            <Badge variant="matrix" className="text-[10px] font-mono">
              FENCED
            </Badge>
          </div>

          {/* Role Status */}
          <div className="p-3 rounded-xl border border-border-subtle bg-canvas-elevated flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-text-muted" />
              <div className="text-xs">
                <div className="font-medium text-text-primary">Authenticated Privilege</div>
                <div className="text-[10px] text-text-muted font-mono">{identity.email || 'Anonymous'}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="subtle" className="text-[10px] font-mono">
                {identity.role === 'admin' ? 'WORKSPACE ADMIN' : 'WORKSPACE MEMBER'}
              </Badge>
              {identity.isPlatformAdmin && (
                <Badge variant="matrix" className="text-[10px] font-mono">
                  PLATFORM ADMIN
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
