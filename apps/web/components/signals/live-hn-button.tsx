'use client';

import React, { useState } from 'react';
import { Button, Card, Badge } from '@leadloom/ui';
import { Radio, ExternalLink } from 'lucide-react';

interface LiveMatch {
  displayName: string;
  score: number;
  matchedTerms: string[];
  explanation: string;
}
interface LiveRow {
  key: string;
  title: string;
  excerpt: string;
  url: string;
  author: string;
  postedAt: string;
  match: LiveMatch | null;
}

export function LiveHnButton() {
  const [query, setQuery] = useState('payment gateway');
  const [rows, setRows] = useState<LiveRow[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/signals/live-hn?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`);
        setRows(null);
      } else {
        setRows(body.rows);
        setFetchedAt(body.fetchedAt);
      }
    } catch {
      setError('Network error while fetching.');
      setRows(null);
    }
    setBusy(false);
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Radio className="h-4 w-4 text-signal-verified" />
        <span className="text-sm font-medium text-text-primary">Live HN check</span>
        <span className="text-[11px] text-text-muted">one request per click, results are not stored</span>
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-md bg-canvas-elevated border border-border-subtle px-3 py-1.5 text-xs text-text-primary"
          placeholder="search comments"
        />
        <Button onClick={run} disabled={busy || !query.trim()}>
          {busy ? 'Fetching...' : 'Fetch live now'}
        </Button>
      </div>
      {error && <div className="text-xs text-signal-failed">{error}</div>}
      {rows && (
        <div className="space-y-2">
          <div className="text-[11px] text-text-muted font-mono">
            live HN Algolia - fetched {fetchedAt} - {rows.length} comments
          </div>
          {rows.map((row) => (
            <div key={row.key} className="rounded-lg border border-signal-verified/25 bg-signal-verified/5 p-3 space-y-1">
              <div className="text-xs font-medium text-text-primary">{row.title || '(no title)'}</div>
              <p className="text-[11px] text-text-secondary leading-relaxed">{row.excerpt}</p>
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-brand-loom hover:underline break-all"
              >
                {row.url} <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              {row.match && (
                <div className="flex items-center gap-2 text-[11px] text-brand-loom">
                  <Badge>{row.match.score.toFixed(2)}</Badge>
                  <span className="font-mono text-text-secondary">{row.match.explanation}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
