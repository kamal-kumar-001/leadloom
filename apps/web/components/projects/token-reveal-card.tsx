'use client';

import React, { useState } from 'react';
import { Card, Button, Badge } from '@leadloom/ui';
import { ShieldCheck, Copy, Check, EyeOff } from 'lucide-react';
import { notify } from '../../lib/notify';

export interface TokenRevealCardProps {
  tokenName: string;
  rawToken: string;
  projectName?: string | null;
  envVarName?: 'LEADLOOM_AGENT_TOKEN' | 'LEADLOOM_TOOL_TOKEN' | string;
  onDismiss: () => void;
}

/**
 * High-visibility, one-time reveal card for newly minted agent tokens.
 * Invariant: The raw token string is never stored in browser storage (localStorage/sessionStorage).
 * Once dismissed by the user, it is wiped from React component memory.
 */
export function TokenRevealCard({
  tokenName,
  rawToken,
  projectName,
  envVarName,
  onDismiss,
}: TokenRevealCardProps) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  const resolvedEnv =
    envVarName ||
    (tokenName.toLowerCase().includes('tool') || !projectName
      ? 'LEADLOOM_TOOL_TOKEN'
      : 'LEADLOOM_AGENT_TOKEN');

  const exportLine = `export ${resolvedEnv}="${rawToken}"`;

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(rawToken);
      setCopiedToken(true);
      notify.success('Raw agent token copied to clipboard');
      setTimeout(() => setCopiedToken(false), 2500);
    } catch {
      notify.error('Unable to copy to clipboard. Please copy manually.');
    }
  };

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportLine);
      setCopiedExport(true);
      notify.success(`Copied export ${resolvedEnv} to clipboard`);
      setTimeout(() => setCopiedExport(false), 2500);
    } catch {
      notify.error('Unable to copy to clipboard. Please copy manually.');
    }
  };

  return (
    <Card data-testid="token-reveal-card" className="border-brand-loom/40 bg-brand-loom/5 p-4 sm:p-5 relative overflow-hidden shadow-glow space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-brand-loom shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                Agent Token Issued: {tokenName}
              </h3>
              <Badge
                variant={resolvedEnv === 'LEADLOOM_TOOL_TOKEN' ? 'verified' : 'loom'}
                className="text-[10px] font-mono"
              >
                {resolvedEnv}
              </Badge>
              {projectName ? (
                <Badge variant="muted" className="text-[10px] font-mono">
                  Project: {projectName}
                </Badge>
              ) : (
                <Badge variant="muted" className="text-[10px] font-mono">
                  Workspace-Wide (Unbound)
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Copy this token now. Set this in your local agent&apos;s <code className="font-mono text-text-mono">.env.local</code> as <strong className="text-text-primary font-mono">{resolvedEnv}</strong>. For strict security, this credential is shown only once and is never stored in browser storage or logs.
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onDismiss}
          className="text-xs shrink-0 self-start sm:self-auto gap-1.5"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Dismiss & Hide</span>
        </Button>
      </div>

      {/* Shell export line with copy */}
      <div className="rounded-lg bg-canvas-elevated/80 border border-border-subtle p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
        <div className="font-mono text-text-secondary truncate">
          <span className="text-text-muted select-none">$ </span>
          <span className="text-brand-loom select-all">{exportLine}</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyExport}
          className="text-xs shrink-0 gap-1.5 justify-center h-7 px-2.5"
        >
          {copiedExport ? (
            <>
              <Check className="w-3 h-3 text-status-verified" />
              <span>Copied Export</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy Export</span>
            </>
          )}
        </Button>
      </div>

      {/* Raw token string (strictly matching e2e test selector) */}
      <div className="pt-2 border-t border-border-subtle flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div data-testid="revealed-raw-token" className="flex-1 min-w-0 bg-canvas-elevated border border-border-subtle rounded-lg px-3 py-2 font-mono text-xs text-text-primary truncate select-all">
          {rawToken}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCopyToken}
          className="text-xs shrink-0 gap-1.5 justify-center"
        >
          {copiedToken ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Token</span>
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
