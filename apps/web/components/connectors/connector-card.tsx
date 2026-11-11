'use client';

import React, { useState } from 'react';
import { Button, Badge } from '@leadloom/ui';
import {
  ShieldCheck,
  Zap,
  Lock,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { MaskedBYOKCredential, BYOKProvider } from '@leadloom/contracts';
import { testConnectorPing } from '../../lib/engine-client';
import { notify } from '../../lib/notify';

export interface ConnectorMeta {
  id: BYOKProvider;
  name: string;
  category: 'Enrichment' | 'Verification' | 'AI Intelligence' | 'Search Signals' | 'Local AI';
  description: string;
  unitCostUSD: number;
  hitRateEstimate: number;
  icon: string;
  docsUrl: string;
  isLocal?: boolean;
}

interface ConnectorCardProps {
  meta: ConnectorMeta;
  credential?: MaskedBYOKCredential;
  onConfigure: (meta: ConnectorMeta) => void;
  onToggleStatus?: (provider: BYOKProvider, enabled: boolean) => void;
}

export function ConnectorCard({
  meta,
  credential,
  onConfigure,
}: ConnectorCardProps) {
  const isConnected = !!credential && credential.isValid;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    latencyMs: number;
    success: boolean;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnectorPing(meta.id);
      setTestResult({ latencyMs: res.latencyMs, success: res.success });
      if (res.success) {
        notify.success(`[${meta.name}] Handshake verified (${res.latencyMs}ms)`);
      } else {
        notify.error(`[${meta.name}] Verification did not complete.`);
      }
    } catch (err: unknown) {
      notify.error(err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-canvas-surface border border-border-subtle rounded-xl p-5 hover:border-border-strong transition-all flex flex-col justify-between group shadow-sm">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-canvas-muted border border-border-subtle flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
              {meta.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-text-primary text-sm tracking-tight">
                  {meta.name}
                </h3>
                {meta.isLocal && (
                  <Badge variant="matrix" className="text-[10px] px-1.5 py-0">
                    Runs locally
                  </Badge>
                )}
              </div>
              <span className="text-xs text-text-muted">{meta.category}</span>
            </div>
          </div>

          {isConnected ? (
            <Badge variant="subtle" className="text-signal-verified border-signal-verified/30 text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-signal-verified" />
              Connected
            </Badge>
          ) : (
            <Badge variant="matrix" className="text-[10px] text-text-muted border-border-subtle">
              Not Configured
            </Badge>
          )}
        </div>

        <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mb-4">
          {meta.description}
        </p>

        {/* Masked Key & Security Pill */}
        {isConnected && credential ? (
          <div className="mb-4 bg-canvas-muted/80 rounded-lg p-2.5 border border-border-subtle">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-text-muted font-mono text-[11px] flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-signal-verified" />
                {credential.maskedKey}
              </span>
              <span className="text-[10px] font-mono text-signal-verified">AES-256 Vault</span>
            </div>
            {credential.quotaRemaining !== null && (
              <div className="text-[10px] text-text-muted flex justify-between">
                <span>Remaining Quota:</span>
                <span className="font-mono text-text-primary">
                  {credential.quotaRemaining.toLocaleString()} calls
                </span>
              </div>
            )}
          </div>
        ) : null}

        {/* Cost & Hit Rate Stats */}
        <div className="grid grid-cols-2 gap-2 py-2 border-t border-border-subtle text-xs mb-4">
          <div>
            <span className="text-text-muted block text-[10px] uppercase font-mono">Unit Cost (illustrative)</span>
            <span className="font-mono font-medium text-text-primary">
              {meta.unitCostUSD === 0 ? '$0.00 / call' : `$${meta.unitCostUSD.toFixed(3)} / call`}
            </span>
          </div>
          <div>
            <span className="text-text-muted block text-[10px] uppercase font-mono">Hit Rate (illustrative)</span>
            <span className="font-mono font-medium text-text-primary">
              {Math.round(meta.hitRateEstimate * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
        {isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
              className="text-xs flex-1 gap-1.5 h-8 font-mono"
            >
              <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : testResult ? `${testResult.latencyMs}ms` : 'Test Ping'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfigure(meta)}
              className="text-xs h-8 px-3"
            >
              Rotate Key
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onConfigure(meta)}
            className="w-full text-xs gap-1.5 h-8"
          >
            <Lock className="w-3.5 h-3.5" />
            Save key
          </Button>
        )}
      </div>
    </div>
  );
}
