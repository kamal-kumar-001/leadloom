'use client';

import React, { useState } from 'react';
import { Button, Badge } from '@leadloom/ui';
import {
  Lock,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  X,
  Zap,
  Server,
} from 'lucide-react';
import { ConnectorMeta } from './connector-card';
import { saveVaultCredential } from '../../lib/engine-client';
import { MaskedBYOKCredential } from '@leadloom/contracts';
import { toast } from 'sonner';

interface ByokVaultModalProps {
  connector: ConnectorMeta;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (credential: MaskedBYOKCredential) => void;
}

export function ByokVaultModal({
  connector,
  isOpen,
  onClose,
  onSuccess,
}: ByokVaultModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://127.0.0.1:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3:8b');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isOllama = connector.id === ('ollama' as unknown);
    if (!isOllama && apiKey.trim().length < 8) {
      toast.error('API key must be at least 8 characters long');
      return;
    }

    setSaving(true);
    try {
      const payloadKey = isOllama
        ? JSON.stringify({ baseUrl: ollamaUrl, model: ollamaModel })
        : apiKey.trim();

      const { credential, isMock } = await saveVaultCredential({
        provider: connector.id,
        apiKey: payloadKey,
        label: label.trim() || undefined,
      });

      toast.success(
        isMock
          ? `[Demo mode] ${connector.name} key stored in encrypted vault simulation`
          : `[Vault] ${connector.name} key encrypted and saved successfully`
      );
      onSuccess(credential);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save credential';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const isOllama = connector.id === ('ollama' as unknown);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-canvas-surface border border-border-strong rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between bg-canvas-muted/50">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-canvas border border-border-subtle flex items-center justify-center text-xl shadow-sm">
              {connector.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text-primary text-base">
                  Connect {connector.name}
                </h3>
                <Badge variant="matrix" className="text-[10px] font-mono">
                  BYOK
                </Badge>
              </div>
              <p className="text-xs text-text-muted">{connector.category} Provider</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-canvas-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* AES-256 Security Architecture Pill */}
          <div className="bg-brand-loom/10 border border-brand-loom/25 rounded-xl p-3.5 flex items-start gap-3">
            <Lock className="w-4 h-4 text-brand-loom shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-text-primary block mb-0.5">
                Encrypted Key Vault
              </span>
              <p className="text-text-muted leading-relaxed">
                Keys are encrypted via AES-256-GCM with a unique 12-byte IV and 16-byte authentication tag in Gamma&apos;s isolated vault service. Decryption occurs strictly inside execution loops; plaintext keys are never returned to the browser.
              </p>
            </div>
          </div>

          {/* Key Input Field or Ollama Local URL */}
          {isOllama ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1.5 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-brand-loom" />
                  Ollama Base URL (Loopback Fenced)
                </label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://127.0.0.1:11434"
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3.5 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-brand-loom"
                  required
                />
                <span className="text-[11px] text-text-muted mt-1 block">
                  Must resolve strictly to localhost (127.0.0.1) for FinOps security fencing.
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1.5">
                  Local Model Tag
                </label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3:8b"
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3.5 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-brand-loom"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-brand-loom" />
                  Provider Secret API Key
                </label>
                {connector.docsUrl && (
                  <a
                    href={connector.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-brand-loom hover:underline flex items-center gap-1"
                  >
                    <span>Get API key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-••••••••••••••••••••••••"
                  className="w-full bg-canvas border border-border-subtle rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-brand-loom"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Optional Label */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1.5">
              Vault Label <span className="text-text-muted font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Primary Production Tier"
              className="w-full bg-canvas border border-border-subtle rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving}
              className="bg-brand-loom hover:bg-brand-weave text-white gap-1.5 px-4"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {saving ? 'Encrypting...' : 'Save to Vault'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
