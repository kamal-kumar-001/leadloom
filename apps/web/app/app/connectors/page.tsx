'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Badge } from '@leadloom/ui';
import {
  Plug,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { ConnectorCard, ConnectorMeta } from '../../../components/connectors/connector-card';
import { OutreachChannelStatus } from '../../../components/connectors/outreach-channel-status';
import { ByokVaultModal } from '../../../components/connectors/byok-vault-modal';
import { fetchVaultCredentials, fetchWaterfallConnectors } from '../../../lib/engine-client';
import { MaskedBYOKCredential, BYOKProvider } from '@leadloom/contracts';
import { notify } from '@/lib/notify';
import { currentProviderKeyRecords } from '../../../lib/provider-key-records';

// Display-only metadata per engine registry connector id. No costs or hit rates:
// those were invented and are gone for good; real pricing lives with the provider.
const DISPLAY: Record<string, { category: ConnectorMeta['category']; description: string; icon: string; docsUrl: string; isLocal?: boolean }> = {
  apollo: { category: 'Enrichment', description: 'B2B contact directory for verified work emails.', icon: '\u26a1', docsUrl: 'https://knowledge.apollo.io/hc/en-us/articles/4415734564877-API-Overview' },
  hunter: { category: 'Verification', description: 'Domain email verification and finder.', icon: '\ud83c\udfaf', docsUrl: 'https://hunter.io/api-documentation/v2' },
  dropcontact: { category: 'Enrichment', description: 'Corporate email resolution, phone numbers, and company legal info.', icon: '\ud83c\udf0d', docsUrl: 'https://developer.dropcontact.com/' },
  pdl: { category: 'Enrichment', description: 'B2B profile identity resolution and company data.', icon: '\ud83d\udcdb', docsUrl: 'https://docs.peopledatalabs.com/' },
  zerobounce: { category: 'Verification', description: 'Deliverability and catch-all validation.', icon: '\ud83d\udee1\ufe0f', docsUrl: 'https://www.zerobounce.net/docs/' },
  neverbounce: { category: 'Verification', description: 'Real-time email hygiene checks.', icon: '\ud83d\udcec', docsUrl: 'https://developers.neverbounce.com/' },
  serper: { category: 'Search Signals', description: 'Google search signals for trigger monitoring.', icon: '\ud83d\udd0e', docsUrl: 'https://serper.dev/documentation' },
  openai: { category: 'AI Intelligence', description: 'Account intelligence synthesis and copy drafting.', icon: '\ud83e\udd16', docsUrl: 'https://platform.openai.com/docs/api-reference' },
  anthropic: { category: 'AI Intelligence', description: 'Company research and intent reasoning.', icon: '\ud83e\udde0', docsUrl: 'https://docs.anthropic.com/en/api/getting-started' },
  ollama: { category: 'Local AI', description: 'Self-hosted LLM endpoint you configure; requests go to the base URL you provide.', icon: '\ud83e\udd99', docsUrl: 'https://ollama.com', isLocal: true },
};

// Providers the vault save path accepts today (BYOKProviderEnum in contracts).
const VAULT_PROVIDERS = new Set(['apollo', 'hunter', 'anymail_finder', 'dropcontact', 'prospeo', 'openai', 'anthropic', 'deepseek', 'groq', 'perplexity', 'pdl', 'zerobounce', 'neverbounce', 'serper', 'ollama']);

export default function ConnectorsPage() {
  const [credentials, setCredentials] = useState<Record<string, MaskedBYOKCredential> | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalConnector, setActiveModalConnector] = useState<ConnectorMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [connectors, setConnectors] = useState<ConnectorMeta[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [vaultError, setVaultError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    if (!mounted.current) return;
    const request = ++generation.current;
    setIsLoading(true);
    setCredentials(null);
    setLoadError(null);
    setVaultError(null);
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const [registryRes, credsRes] = await Promise.race([
        Promise.all([fetchWaterfallConnectors(), fetchVaultCredentials()]),
        new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Metadata read timed out')), 15000); }),
      ]);
      if (!mounted.current || request !== generation.current) return;
      if (registryRes.error || !registryRes.data || !Array.isArray(registryRes.data.connectors)) {
        setConnectors([]);
        setLoadError('Connector registry unavailable');
      } else {
        const metas: ConnectorMeta[] = registryRes.data.connectors.map((row) => {
          const d = DISPLAY[row.id] ?? { category: 'Enrichment' as const, description: '', icon: '\ud83d\udd0c', docsUrl: '' };
          return { id: row.id, name: row.name, category: d.category, description: d.description,
            icon: d.icon, docsUrl: d.docsUrl, isLocal: d.isLocal,
            testable: row.testable === true, keyStorageAvailable: VAULT_PROVIDERS.has(row.id) };
        });
        setConnectors(metas);
      }
      const mapped = !credsRes.error && !credsRes.isMock ? currentProviderKeyRecords(credsRes.credentials) : null;
      setCredentials(mapped);
      if (mapped === null) setVaultError('Saved key metadata unavailable. Reload before changing keys.');
    } catch {
      if (mounted.current && request === generation.current) {
        setConnectors([]);
        setCredentials(null);
        setLoadError('Connector registry unavailable');
        setVaultError('Saved key metadata unavailable. Reload before changing keys.');
      }
    } finally {
      clearTimeout(deadline);
      if (mounted.current && request === generation.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; generation.current++; };
  }, [load]);

  // A successful save is a stored row, not proof that it is the selected key.
  const handleCredentialSaved = (_cred: MaskedBYOKCredential) => { void load(); };

  const categories = ['All', 'Enrichment', 'Verification', 'AI Intelligence', 'Search Signals', 'Local AI'];

  const filteredConnectors = connectors.filter((c) => {
    const matchesCategory = activeCategory === 'All' || c.category === activeCategory;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const connectedCount = credentials === null ? null : Object.keys(credentials).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              BYOK Connector Hub & Vault
            </h1>
          </div>
          <p className="text-xs text-text-muted">
            Connect your own API keys. All credentials encrypted via AES-256-GCM envelope vault.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-canvas-surface border border-border-subtle rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-signal-verified animate-pulse" />
            <span className="text-text-muted">Providers with saved keys:</span>
            <span className="font-mono font-semibold text-text-primary">
              {connectedCount === null ? (isLoading ? 'Loading' : 'Unavailable') : connectedCount}
            </span>
          </div>
        </div>
      </div>

      <OutreachChannelStatus />

      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-text-primary">Enrichment key vault</h2>
        <span className="text-[11px] text-text-muted">Connector list comes from the engine registry. Keys you save are stored encrypted. This page does not call providers. The current key is the newest-created saved row, with native id order breaking exact ties. Stored test results are not a live connection check.</span>
        {loadError && <Badge variant="matrix" className="text-xs font-mono">{loadError}</Badge>}
        {vaultError && <Badge variant="matrix" className="text-xs font-mono">{vaultError}</Badge>}
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>Reload metadata</Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-brand-loom text-text-onAccent'
                  : 'bg-canvas-surface text-text-muted hover:text-text-primary border border-border-subtle'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connectors..."
            className="w-full bg-canvas-surface border border-border-subtle rounded-lg pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-loom"
          />
        </div>
      </div>

      {/* Connector Grid */}
      {isLoading && <p className="text-xs text-text-muted font-mono">Loading connector registry...</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConnectors.map((connector) => (
          <ConnectorCard
            key={connector.id}
            meta={connector}
            credential={credentials?.[connector.id]}
            credentialState={isLoading ? 'loading' : credentials === null ? 'unavailable' : 'confirmed'}
            onConfigure={(meta) => {
              if (credentials === null || isLoading) return;
              if (meta.keyStorageAvailable === false) {
                notify.info(`Key storage is not available for ${meta.name} yet (provider id not accepted by the vault).`);
                return;
              }
              setActiveModalConnector(meta);
            }}
          />
        ))}
      </div>

      {/* Zero State if Filter empty */}
      {!isLoading && !loadError && filteredConnectors.length === 0 && (
        <div className="text-center py-16 bg-canvas-surface border border-border-subtle rounded-xl p-8">
          <Plug className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
          <h3 className="font-semibold text-sm text-text-primary mb-1">No connectors found</h3>
          <p className="text-xs text-text-muted">
            Try adjusting your search query or switching categories.
          </p>
        </div>
      )}

      {/* BYOK Vault Modal */}
      {activeModalConnector && (
        <ByokVaultModal
          connector={activeModalConnector}
          isOpen={!!activeModalConnector}
          onClose={() => setActiveModalConnector(null)}
          onSuccess={handleCredentialSaved}
        />
      )}
    </div>
  );
}
