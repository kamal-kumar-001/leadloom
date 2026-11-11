'use client';

import React, { useState } from 'react';
import { Badge, Button, Card } from '@leadloom/ui';
import { Globe, Search, AlertTriangle, Save, Check } from 'lucide-react';
import Link from 'next/link';
import {
  analyzeWebsiteSignals,
  saveWebsiteAnalysis,
  fetchResearchLeads,
  type WebsiteSignalsResult,
  type SavedResearchRow,
} from '../../../lib/engine-client';
import { IntentFixturePanel } from '../../../components/research/intent-fixture-panel';

export default function ResearchPage() {
  const [url, setUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [pageText, setPageText] = useState('');
  const [result, setResult] = useState<WebsiteSignalsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedRows, setSavedRows] = useState<SavedResearchRow[]>([]);
  const [lastPageText, setLastPageText] = useState('');

  React.useEffect(() => {
    fetchResearchLeads().then((res) => {
      if (res.data?.items) setSavedRows(res.data.items);
    });
  }, []);

  async function save(domain: string, pageText: string) {
    setBusy(true);
    const res = await saveWebsiteAnalysis({ domain, pageText });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(res.data?.rowId ?? null);
    const list = await fetchResearchLeads();
    if (list.data?.items) setSavedRows(list.data.items);
  }

  async function analyze(mode: 'url' | 'text') {
    setBusy(true);
    setError(null);
    setResult(null);
    setSaved(null);
    if (mode === 'text') setLastPageText(pageText);
    const input = mode === 'url' ? { url: url.trim() } : { domain: domain.trim(), pageText };
    const res = await analyzeWebsiteSignals(input as { url: string });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data && res.data.status !== 'OK') {
      setError(res.data.message ?? 'Analysis unavailable.');
      return;
    }
    setResult(res.data);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" /> Website research
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Buyer discovery from a website. Keyword heuristics over page text only - no AI summary, no
          confidence score. Every reason below cites the actual words found.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-mono text-[var(--text-secondary)]">FETCH A URL</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button disabled={busy || !url.trim()} onClick={() => analyze('url')}>
              <Search className="h-4 w-4 mr-1" /> Fetch & analyze
            </Button>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Fetching is disabled on this environment unless the operator enables it; the engine
            reports it honestly when off.
          </p>
        </div>
        <div className="space-y-2 border-t border-[var(--border)] pt-3">
          <label className="text-xs font-mono text-[var(--text-secondary)]">OR PASTE PAGE TEXT</label>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Domain, e.g. example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <textarea
            className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm h-32"
            placeholder="Paste the visible text of the homepage or a landing page..."
            value={pageText}
            onChange={(e) => setPageText(e.target.value)}
          />
          <Button disabled={busy || !domain.trim() || !pageText.trim()} onClick={() => analyze('text')}>
            <Search className="h-4 w-4 mr-1" /> Analyze pasted text
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-[var(--warning)]">
          <p className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        </Card>
      )}

      {result && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{result.signals.companyDomain}</h2>
            <div className="flex gap-2">
              <Badge variant="subtle" className="text-[10px] font-mono">
                {result.signals.source === 'heuristic_keywords' ? 'keyword match' : result.signals.source}
              </Badge>
              <Badge variant="subtle" className="text-[10px] font-mono">
                {result.input === 'fetched_url' ? 'fetched' : 'pasted text'}
                {result.truncated ? ' (truncated)' : ''}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-mono text-[var(--text-secondary)] mb-1">
              TECH KEYWORDS FOUND ({result.signals.techKeywords.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {result.signals.techKeywords.length === 0 && (
                <span className="text-sm text-[var(--text-secondary)]">None</span>
              )}
              {result.signals.techKeywords.map((k) => (
                <Badge key={k} variant="matrix" className="text-[10px] font-mono">
                  {k}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <span>Hiring language: {result.signals.mentionsHiring ? 'yes' : 'no'}</span>
            <span>Pricing language: {result.signals.mentionsPricing ? 'yes' : 'no'}</span>
            <span>Scaling language: {result.signals.mentionsScaling ? 'yes' : 'no'}</span>
            <span>Words analyzed: {result.signals.wordCount}</span>
          </div>

          {result.icpHints.length > 0 && (
            <div>
              <p className="text-xs font-mono text-[var(--text-secondary)] mb-1">ICP KEYWORD MATCHES</p>
              <div className="flex flex-wrap gap-1">
                {result.icpHints.map((h) => (
                  <Badge key={h.category} variant="subtle" className="text-[10px] font-mono">
                    {h.category}: {h.matchedKeywords.join(', ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-mono text-[var(--text-secondary)] mb-1">RELEVANT BECAUSE</p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {result.relevanceReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              No AI summary and no confidence score exist at this stage - these are keyword
              observations only.
            </p>
          </div>

          <div className="border-t border-[var(--border)] pt-3 flex items-center gap-3">
            {saved ? (
              <Badge variant="verified" className="text-[10px] font-mono">
                <Check className="h-3 w-3 mr-1" /> Saved to lead table
              </Badge>
            ) : (
              <Button disabled={busy} onClick={() => save(result.signals.companyDomain, lastPageText)}>
                <Save className="h-4 w-4 mr-1" /> Save to lead table
              </Button>
            )}
            <span className="text-xs text-[var(--text-secondary)]">
              Saves the engine-computed analysis above as a row in the{' '}
              <Link href="/app/tables" className="underline">
                Website research leads
              </Link>{' '}
              table, labeled {result.signals.source}.
            </span>
          </div>
        </Card>
      )}

      {savedRows.length > 0 && (
        <Card className="p-4 space-y-2">
          <h2 className="font-semibold text-sm">Saved analyses ({savedRows.length})</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Rows in the Website research leads table. Source: keyword heuristics.
          </p>
          <div className="space-y-2">
            {savedRows.map((r) => (
              <div key={r.rowId} className="flex items-center justify-between border border-[var(--border)] rounded-md px-3 py-2 text-sm">
                <span className="font-mono">{String(r.values['Domain'] ?? '')}</span>
                <span className="text-[var(--text-secondary)] text-xs truncate max-w-[60%]">
                  {String(r.values['Tech keywords'] ?? '') || 'no tech keywords'}
                </span>
                <span className="text-[var(--text-secondary)] text-xs">
                  {String(r.values['Researched at'] ?? '').slice(0, 19).replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="border-t border-[var(--border)] pt-6">
        <IntentFixturePanel />
      </div>
    </div>
  );
}
