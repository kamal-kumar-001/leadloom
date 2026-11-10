'use client';

import React, { useState, useEffect } from 'react';
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
import { ByokVaultModal } from '../../../components/connectors/byok-vault-modal';
import { fetchVaultCredentials } from '../../../lib/engine-client';
import { MaskedBYOKCredential, BYOKProvider } from '@leadloom/contracts';
import { toast } from 'sonner';

const ALL_CONNECTORS: ConnectorMeta[] = [
  {
    id: 'apollo',
    name: 'Apollo Enrichment',
    category: 'Enrichment',
    description: 'B2B contact directory and primary waterfall tier for verified work emails.',
    unitCostUSD: 0.001,
    hitRateEstimate: 0.58,
    icon: '⚡',
    docsUrl: 'https://knowledge.apollo.io/hc/en-us/articles/4415734564877-API-Overview',
  },
  {
    id: 'hunter',
    name: 'Hunter Verification',
    category: 'Verification',
    description: 'Domain email verification and secondary waterfall fallback tier.',
    unitCostUSD: 0.003,
    hitRateEstimate: 0.28,
    icon: '🎯',
    docsUrl: 'https://hunter.io/api-documentation/v2',
  },
  {
    id: 'dropcontact',
    name: 'Dropcontact Waterfall',
    category: 'Enrichment',
    description: 'European corporate email resolution, phone numbers, and company legal info.',
    unitCostUSD: 0.012,
    hitRateEstimate: 0.32,
    icon: '🇫🇷',
    docsUrl: 'https://developer.dropcontact.com/',
  },
  {
    id: 'prospeo',
    name: 'Prospeo B2B',
    category: 'Enrichment',
    description: 'Mobile phone finder and secondary corporate email waterfall resolver.',
    unitCostUSD: 0.008,
    hitRateEstimate: 0.42,
    icon: '🔍',
    docsUrl: 'https://prospeo.io/api',
  },
  {
    id: 'anymail_finder',
    name: 'People Data Labs',
    category: 'Enrichment',
    description: 'B2B profile identity resolution, tech stack data, and company headcount intel.',
    unitCostUSD: 0.015,
    hitRateEstimate: 0.45,
    icon: '🌐',
    docsUrl: 'https://docs.peopledatalabs.com/',
  },
  {
    id: 'deepseek',
    name: 'ZeroBounce Verification',
    category: 'Verification',
    description: 'Deliverability and catch-all validation; protects mailbox sender reputation.',
    unitCostUSD: 0.002,
    hitRateEstimate: 0.99,
    icon: '🛡️',
    docsUrl: 'https://www.zerobounce.net/docs/',
  },
  {
    id: 'groq',
    name: 'NeverBounce Single-Check',
    category: 'Verification',
    description: 'Real-time 20-point email hygiene and spam-trap suppression inspection.',
    unitCostUSD: 0.003,
    hitRateEstimate: 0.98,
    icon: '📬',
    docsUrl: 'https://developers.neverbounce.com/',
  },
  {
    id: 'perplexity',
    name: 'Serper Search Signals',
    category: 'Search Signals',
    description: 'Google search signals, hiring announcements, and press release trigger monitoring.',
    unitCostUSD: 0.001,
    hitRateEstimate: 0.85,
    icon: '🔎',
    docsUrl: 'https://serper.dev/documentation',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4o',
    category: 'AI Intelligence',
    description: 'Account intelligence synthesis, custom icebreakers, and intent score classification.',
    unitCostUSD: 0.005,
    hitRateEstimate: 0.96,
    icon: '🤖',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude 3.5',
    category: 'AI Intelligence',
    description: 'High-altitude company research, deep intent reasoning, and multi-step copy drafts.',
    unitCostUSD: 0.006,
    hitRateEstimate: 0.98,
    icon: '🧠',
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
  },
  {
    id: ('ollama' as unknown as BYOKProvider),
    name: 'Ollama Local Model',
    category: 'Local AI',
    description: 'LLM inference running on your own machine, so prompts stay local.',
    unitCostUSD: 0.0,
    hitRateEstimate: 0.91,
    icon: '🦙',
    docsUrl: 'https://ollama.com',
    isLocal: true,
  },
];

export default function ConnectorsPage() {
  const [credentials, setCredentials] = useState<Record<string, MaskedBYOKCredential>>({});
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalConnector, setActiveModalConnector] = useState<ConnectorMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { credentials: list } = await fetchVaultCredentials();
        if (mounted) {
          const mapped: Record<string, MaskedBYOKCredential> = {};
          for (const c of list) {
            mapped[c.provider] = c;
          }
          setCredentials(mapped);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCredentialSaved = (cred: MaskedBYOKCredential) => {
    setCredentials((prev) => ({
      ...prev,
      [cred.provider]: cred,
    }));
  };

  const categories = ['All', 'Enrichment', 'Verification', 'AI Intelligence', 'Search Signals', 'Local AI'];

  const filteredConnectors = ALL_CONNECTORS.filter((c) => {
    const matchesCategory = activeCategory === 'All' || c.category === activeCategory;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const connectedCount = Object.keys(credentials).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              BYOK Connector Hub & Vault
            </h1>
            <Badge variant="matrix" className="text-xs font-mono">
              Demo data
            </Badge>
          </div>
          <p className="text-xs text-text-muted">
            Connect your own API keys. All credentials encrypted via AES-256-GCM envelope vault.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-canvas-surface border border-border-subtle rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-signal-verified animate-pulse" />
            <span className="text-text-muted">Active Connectors:</span>
            <span className="font-mono font-semibold text-text-primary">
              {connectedCount} / {ALL_CONNECTORS.length}
            </span>
          </div>
        </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConnectors.map((connector) => (
          <ConnectorCard
            key={connector.id}
            meta={connector}
            credential={credentials[connector.id]}
            onConfigure={(meta) => setActiveModalConnector(meta)}
          />
        ))}
      </div>

      {/* Zero State if Filter empty */}
      {filteredConnectors.length === 0 && (
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
