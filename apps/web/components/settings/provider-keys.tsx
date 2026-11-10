'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, EmptyState } from '@leadloom/ui';
import { Key, Plus, Trash2, RefreshCw, Shield, Lock, Calendar } from 'lucide-react';
import { FormField } from '../feedback/form-field';
import { ConfirmDialog } from '../feedback/confirm-dialog';
import { useShellIdentity } from '../shell/identity';
import { notify } from '../../lib/notify';
import {
  fetchVaultCredentials,
  saveVaultCredential,
  deleteVaultCredential,
} from '../../lib/engine-client';
import type { MaskedBYOKCredential, BYOKProvider } from '@leadloom/contracts';

const PROVIDERS: { id: BYOKProvider; label: string }[] = [
  { id: 'apollo', label: 'Apollo' },
  { id: 'hunter', label: 'Hunter' },
  { id: 'dropcontact', label: 'Dropcontact' },
  { id: 'prospeo', label: 'Prospeo' },
  { id: 'anymail_finder', label: 'Anymail Finder' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'groq', label: 'Groq' },
  { id: 'perplexity', label: 'Perplexity' },
];

export function ProviderKeysCard() {
  const { role } = useShellIdentity();
  const canManage = role === 'admin';

  const [keys, setKeys] = useState<MaskedBYOKCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [provider, setProvider] = useState<BYOKProvider>('apollo');
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ apiKey?: string; label?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<MaskedBYOKCredential | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchVaultCredentials();
      if (res.error) {
        setError(res.error);
      } else {
        setKeys(res.credentials || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch provider keys');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = apiKey.trim();
    const trimmedLabel = label.trim();

    const errors: { apiKey?: string; label?: string } = {};
    if (!trimmedKey) {
      errors.apiKey = 'API key is required';
    } else if (trimmedKey.length < 10) {
      errors.apiKey = 'API key must be at least 10 characters long';
    }

    if (trimmedLabel.length > 100) {
      errors.label = 'Label must be 100 characters or fewer';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await saveVaultCredential({
        provider,
        apiKey: trimmedKey,
        label: trimmedLabel || undefined,
      });

      // Clear the secret immediately from component state
      setApiKey('');
      setLabel('');
      setIsAdding(false);
      notify.success('Provider key saved securely');
      await loadKeys();
    } catch (err: unknown) {
      notify.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteVaultCredential(deleteTarget.id);
      notify.success('Provider key removed');
      setDeleteTarget(null);
      await loadKeys();
    } catch (err: unknown) {
      notify.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getProviderLabel = (id: string) => {
    const found = PROVIDERS.find((p) => p.id === id);
    return found ? found.label : id.charAt(0).toUpperCase() + id.slice(1);
  };

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              Provider Keys
            </h2>
            <div className="flex items-center gap-1 text-[11px] text-text-muted">
              <Lock className="w-3 h-3 text-text-muted" />
              <span>AES-256-GCM Vault</span>
            </div>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Encrypted credentials used for enrichment waterfalls and AI model execution.
          </p>
        </div>

        {canManage && !isAdding && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setIsAdding(true);
              setFieldErrors({});
            }}
            className="self-start sm:self-center text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>Add Key</span>
          </Button>
        )}
      </div>

      {/* Add Key Form */}
      {isAdding && (
        <form
          onSubmit={handleAddKey}
          className="p-4 rounded-xl bg-canvas-elevated border border-border-subtle space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              Add Provider Key
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setApiKey('');
                setLabel('');
                setFieldErrors({});
              }}
              disabled={isSubmitting}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="provider-select"
              label="Provider"
              required
            >
              <select
                id="provider-select"
                value={provider}
                onChange={(e) => setProvider(e.target.value as BYOKProvider)}
                disabled={isSubmitting}
                className="w-full bg-canvas-surface border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-loom focus:border-brand-loom"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              id="key-label"
              label="Key Label (optional)"
              hint="e.g. Production Team Key"
              error={fieldErrors.label}
            >
              <input
                id="key-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Optional identifier"
                disabled={isSubmitting}
                className="w-full bg-canvas-surface border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-loom focus:border-brand-loom"
              />
            </FormField>
          </div>

          <FormField
            id="key-value"
            label="API Key"
            hint="Minimum 10 characters. Stored securely using AES-256-GCM encryption."
            required
            error={fieldErrors.apiKey}
          >
            <input
              id="key-value"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key"
              disabled={isSubmitting}
              autoComplete="new-password"
              className="w-full bg-canvas-surface border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-loom focus:border-brand-loom"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => {
                setIsAdding(false);
                setApiKey('');
                setLabel('');
                setFieldErrors({});
              }}
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
              {isSubmitting ? 'Saving Key…' : 'Save Key'}
            </Button>
          </div>
        </form>
      )}

      {/* Content Area */}
      <div className="border-t border-border-subtle pt-4">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2.5">
            <div className="h-16 rounded-xl bg-canvas-elevated animate-pulse border border-border-subtle" />
            <div className="h-16 rounded-xl bg-canvas-elevated animate-pulse border border-border-subtle" />
          </div>
        )}

        {/* Error State with Retry */}
        {!isLoading && error && (
          <div className="p-4 rounded-xl bg-signal-failed/10 border border-signal-failed/20 text-center space-y-2">
            <p className="text-xs text-signal-failed font-medium">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadKeys}
              className="text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && keys.length === 0 && (
          <EmptyState
            icon={<Key className="w-5 h-5 text-text-muted" />}
            title="No provider keys yet"
            description="Add an API key for enrichment or LLM waterfall providers to run searches directly through your own accounts."
            className="py-6 px-4"
          />
        )}

        {/* Keys List */}
        {!isLoading && !error && keys.length > 0 && (
          <div className="space-y-2.5">
            {keys.map((k) => (
              <div
                key={k.id}
                className="p-3.5 rounded-xl bg-canvas-elevated border border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-canvas-surface border border-border-subtle flex items-center justify-center text-text-secondary shrink-0 mt-0.5 sm:mt-0">
                    <Key className="w-4 h-4 text-brand-loom" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-text-primary">
                        {getProviderLabel(k.provider)}
                      </span>
                      {k.label && (
                        <span className="text-xs text-text-secondary truncate">
                          ({k.label})
                        </span>
                      )}
                      <Badge variant="subtle" className="text-[10px] py-0 px-1.5 font-mono">
                        Saved
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1 flex-wrap">
                      <span className="font-mono text-text-secondary bg-canvas-surface px-1.5 py-0.5 rounded border border-border-subtle">
                        {k.maskedKey}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-text-muted" />
                        <span>Added {formatDate(k.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(k)}
                      aria-label={`Delete ${k.label || getProviderLabel(k.provider)} key`}
                      className="p-1.5 rounded-md text-text-muted hover:text-signal-failed hover:bg-canvas-surface transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read-Only Notice for Members */}
      {!canManage && (
        <div className="text-[11px] text-text-muted flex items-center gap-1 pt-1">
          <Shield className="w-3 h-3 text-text-muted" />
          <span>Only workspace administrators can add or delete provider keys.</span>
        </div>
      )}

      {/* Confirmation Dialog for Deletion */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Provider Key"
        description={`Are you sure you want to remove the ${
          deleteTarget ? (getProviderLabel(deleteTarget.provider) + (deleteTarget.label ? ` (${deleteTarget.label})` : '')) : ''
        } key from the encrypted vault? Any active waterfalls relying on this credential will fail.`}
        confirmLabel="Delete Key"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => !isDeleting && setDeleteTarget(null)}
      />
    </Card>
  );
}
