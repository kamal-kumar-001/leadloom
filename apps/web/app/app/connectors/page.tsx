'use client';

import React, { useState } from 'react';
import { Button, Badge } from '@leadloom/ui';
import { toast } from 'sonner';
import {
  Plug,
  Key,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ExternalLink,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  X,
  Zap,
} from 'lucide-react';

interface Connector {
  id: string;
  name: string;
  category: 'Enrichment' | 'Verification' | 'AI Intelligence' | 'Headless Scraper';
  description: string;
  unitCostUSD: number;
  status: 'connected' | 'not_configured';
  maskedKey?: string;
  hitRateEstimate: number;
  icon: string;
}

const INITIAL_CONNECTORS: Connector[] = [
  {
    id: 'apollo',
    name: 'Apollo Enrichment',
    category: 'Enrichment',
    description: 'B2B contact directory and verified work email waterfall tier.',
    unitCostUSD: 0.001,
    status: 'connected',
    maskedKey: 'sk-••••••••••••4a91',
    hitRateEstimate: 0.58,
    icon: '⚡',
  },
  {
    id: 'hunter',
    name: 'Hunter Verification',
    category: 'Verification',
    description: 'Domain email verification and secondary waterfall fallback tier.',
    unitCostUSD: 0.003,
    status: 'connected',
    maskedKey: 'sk-••••••••••••b82f',
    hitRateEstimate: 0.28,
    icon: '🎯',
  },
  {
    id: 'dropcontact',
    name: 'Dropcontact Waterfall',
    category: 'Enrichment',
    description: 'European GDPR-compliant corporate email resolution and phone finder.',
    unitCostUSD: 0.02,
    status: 'not_configured',
    hitRateEstimate: 0.10,
    icon: '💧',
  },
  {
    id: 'ai-researcher',
    name: 'Perplexity / AI Researcher',
    category: 'AI Intelligence',
    description: 'Real-time corporate signals, hiring sprees, and tech stack detection.',
    unitCostUSD: 0.005,
    status: 'connected',
    maskedKey: 'sk-••••••••••••10c4',
    hitRateEstimate: 0.92,
    icon: '🧠',
  },
  {
    id: 'headless-scraper',
    name: 'Headless Signal Scraper',
    category: 'Headless Scraper',
    description: 'Local Chromium runner with resource blocking for website trigger extraction.',
    unitCostUSD: 0.0,
    status: 'connected',
    maskedKey: 'built-in worker',
    hitRateEstimate: 0.85,
    icon: '🕷️',
  },
  {
    id: 'github-signals',
    name: 'GitHub Intent Harvester',
    category: 'Headless Scraper',
    description: 'Extract stargazer intent, package usage, and engineering team commits.',
    unitCostUSD: 0.0,
    status: 'not_configured',
    hitRateEstimate: 0.70,
    icon: '🐙',
  },
];

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>(INITIAL_CONNECTORS);
  const [activeModalConnector, setActiveModalConnector] = useState<Connector | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalConnector) return;

    setSubmitting(true);
    // Simulate POST to /connectors vault
    await new Promise((resolve) => setTimeout(resolve, 600));

    const masked = 'sk-••••••••••••' + (apiKeyInput.slice(-4) || '99ef');
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === activeModalConnector.id
          ? { ...c, status: 'connected', maskedKey: masked }
          : c
      )
    );

    toast.success(`${activeModalConnector.name} credentials encrypted and stored in vault`);
    setSubmitting(false);
    setActiveModalConnector(null);
    setApiKeyInput('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">BYOK Enrichment Connectors</h1>
            <Badge variant="matrix" className="font-mono text-xs">
              Demo data
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Connect your own API credentials at wholesale cost. LeadLoom adds zero markup.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="subtle" className="font-mono text-xs py-1 px-2.5">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-signal-verified" />
            AES-256-GCM Vault Active
          </Badge>
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectors.map((c) => {
          const isConnected = c.status === 'connected';

          return (
            <div
              key={c.id}
              className="p-5 rounded-xl bg-canvas-surface border border-border-subtle hover:border-border-muted transition-all flex flex-col justify-between shadow-sm relative group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg bg-canvas-elevated border border-border-subtle flex items-center justify-center text-lg shadow-sm">
                      {c.icon}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary leading-snug">{c.name}</h3>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                        {c.category}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                      isConnected
                        ? 'bg-signal-verified/15 text-signal-verified'
                        : 'bg-canvas-elevated text-text-muted'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isConnected ? 'bg-signal-verified' : 'bg-text-muted'
                      }`}
                    />
                    {isConnected ? 'Active' : 'Unconfigured'}
                  </span>
                </div>

                <p className="text-xs text-text-secondary line-clamp-2 mb-4 leading-relaxed">
                  {c.description}
                </p>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-canvas-elevated/50 border border-border-subtle mb-4 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Vendor Cost</div>
                    <div className="text-text-primary font-medium mt-0.5">
                      {c.unitCostUSD === 0 ? 'Free (Local)' : `$${c.unitCostUSD.toFixed(3)}/call`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Est. Hit Rate</div>
                    <div className="text-brand-loom font-medium mt-0.5">
                      {Math.round(c.hitRateEstimate * 100)}%
                    </div>
                  </div>
                </div>

                {isConnected && c.maskedKey && (
                  <div className="mb-4 flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-canvas-elevated border border-border-subtle font-mono text-text-muted">
                    <span className="text-[11px] truncate">{c.maskedKey}</span>
                    <Lock className="w-3 h-3 text-signal-verified shrink-0 ml-2" />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Simulated Provider</span>
                <Button
                  size="sm"
                  variant={isConnected ? 'outline' : 'primary'}
                  onClick={() => {
                    setActiveModalConnector(c);
                    setApiKeyInput('');
                  }}
                  className="text-xs py-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{isConnected ? 'Rotate Key' : 'Configure Key'}</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Key Entry Modal Drawer */}
      {activeModalConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-canvas-surface border border-border-subtle rounded-xl max-w-md w-full p-6 shadow-xl relative animate-fade-in">
            <button
              onClick={() => setActiveModalConnector(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-canvas-elevated transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-2xl">{activeModalConnector.icon}</span>
              <div>
                <h2 className="text-base font-bold text-text-primary">
                  Configure {activeModalConnector.name}
                </h2>
                <span className="text-xs text-text-muted font-mono">
                  AES-256 Vault Encryption
                </span>
              </div>
            </div>

            <p className="text-xs text-text-secondary mb-4 leading-relaxed">
              Your API key will be encrypted at the server boundary using authenticated KEK/DEK envelope encryption. Raw plaintext keys are never stored.
            </p>

            <form onSubmit={handleSaveKey} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Provider API Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    required
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-••••••••••••••••"
                    className="w-full pr-10 pl-3 py-2 rounded-lg bg-canvas-elevated border border-border-subtle text-text-primary text-xs font-mono placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-canvas-elevated/50 border border-border-subtle text-xs text-text-muted flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-loom shrink-0 mt-0.5" />
                <span>
                  Demo data mode: this form triggers the simulated vault persistence handler without dispatching real vendor calls.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveModalConnector(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? 'Encrypting & Storing...' : 'Save to Vault'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
