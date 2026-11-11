'use client';

import React, { useState } from 'react';
import { Badge, Button, Card } from '@leadloom/ui';
import { Briefcase, AlertTriangle, Save, Check, FileJson } from 'lucide-react';
import Link from 'next/link';
import {
  analyzeIntentFixture,
  saveIntentFixture,
  fetchIntentSignals,
  type IntentFixtureAnalysis,
  type SavedResearchRow,
} from '../../lib/engine-client';

/**
 * G5 intent signals, fixture-first. The user pastes hiring-board-shaped JSON
 * ({ company, jobs: [...] }) or loads the bundled sample; the engine
 * normalizes it with zero network egress. Every surface here says "fixture"
 * so nobody mistakes sample rows for live prospect data.
 */

const SAMPLE_FIXTURE = {
  company: 'Acme Robotics (sample)',
  jobs: [
    { title: 'Growth Marketing Lead', location: 'Remote - US', absolute_url: 'https://boards.example.invalid/acme/1', updated_at: '2026-11-01T09:00:00Z' },
    { title: 'Outbound Sales Manager', location: 'New York, NY', absolute_url: 'https://boards.example.invalid/acme/2', updated_at: '2026-11-05T10:30:00Z' },
    { title: 'Backend Engineer', location: 'Berlin, DE', absolute_url: 'https://boards.example.invalid/acme/3', updated_at: '2026-10-28T14:00:00Z' },
    { title: 'Sales Development Representative', location: 'Remote - US', absolute_url: 'https://boards.example.invalid/acme/4', updated_at: '2026-11-06T08:15:00Z' },
  ],
};

export function IntentFixturePanel() {
  const [raw, setRaw] = useState('');
  const [analysis, setAnalysis] = useState<IntentFixtureAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [rows, setRows] = useState<SavedResearchRow[]>([]);
  const [fixture, setFixture] = useState<unknown | null>(null);

  React.useEffect(() => {
    fetchIntentSignals().then((res) => {
      if (res.data?.items) setRows(res.data.items);
    });
  }, []);

  async function analyze() {
    setBusy(true);
    setError(null);
    setAnalysis(null);
    setSaved(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setBusy(false);
      setError('That is not valid JSON. Paste the fixture JSON or load the sample.');
      return;
    }
    setFixture(parsed);
    const res = await analyzeIntentFixture(parsed);
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? 'Analysis unavailable.');
      return;
    }
    if (res.data.status !== 'OK' || !res.data.analysis) {
      setError(res.data.message ?? 'The fixture did not match the expected hiring-board shape.');
      return;
    }
    setAnalysis(res.data.analysis);
  }

  async function save() {
    if (fixture === null) return;
    setBusy(true);
    const res = await saveIntentFixture(fixture);
    setBusy(false);
    if (res.error || !res.data || res.data.status !== 'SAVED') {
      setError(res.data?.message ?? res.error ?? 'Could not save.');
      return;
    }
    setSaved(res.data.rowId ?? null);
    const list = await fetchIntentSignals();
    if (list.data?.items) setRows(list.data.items);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5" /> Intent signals <Badge variant="subtle" className="text-[10px] font-mono">fixture only</Badge>
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Normalizes hiring-board-shaped JSON into intent-signal rows. Nothing is fetched - the data
          is whatever you paste or load below, and every row is labeled as a fixture. Live hiring-board
          ingestion is a separate step that starts only after its access rules are verified.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-[var(--text-secondary)]">PASTE HIRING-BOARD JSON</label>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => { setRaw(JSON.stringify(SAMPLE_FIXTURE, null, 2)); setError(null); }}
            >
              <FileJson className="h-4 w-4 mr-1" /> Load sample fixture
            </Button>
          </div>
          <textarea
            className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm h-40 font-mono"
            placeholder='{"company": "Example Co", "jobs": [{"title": "Growth Lead", "location": "Remote", "updated_at": "2026-11-01T09:00:00Z"}]}'
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <Button disabled={busy || !raw.trim()} onClick={analyze}>
            Normalize fixture
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

      {analysis && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{analysis.company}</h3>
            <div className="flex gap-2">
              <Badge variant="subtle" className="text-[10px] font-mono">fixture</Badge>
              <Badge variant="subtle" className="text-[10px] font-mono">{analysis.signalType}</Badge>
            </div>
          </div>
          <div className="flex gap-4 text-sm flex-wrap">
            <span>Open roles in fixture: {analysis.jobCount}</span>
            <span>Latest posting date claimed: {analysis.latestPostingDate ? analysis.latestPostingDate.slice(0, 10) : 'not in fixture'}</span>
          </div>
          <div>
            <p className="text-xs font-mono text-[var(--text-secondary)] mb-1">SAMPLE TITLES</p>
            <div className="flex flex-wrap gap-1">
              {analysis.sampleTitles.map((t) => (
                <Badge key={t} variant="matrix" className="text-[10px] font-mono">{t}</Badge>
              ))}
            </div>
          </div>
          {analysis.locations.length > 0 && (
            <div>
              <p className="text-xs font-mono text-[var(--text-secondary)] mb-1">LOCATIONS</p>
              <div className="flex flex-wrap gap-1">
                {analysis.locations.map((l) => (
                  <Badge key={l} variant="subtle" className="text-[10px] font-mono">{l}</Badge>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-[var(--text-secondary)]">{analysis.caveat}</p>
          <div className="border-t border-[var(--border)] pt-3 flex items-center gap-3">
            {saved ? (
              <Badge variant="verified" className="text-[10px] font-mono">
                <Check className="h-3 w-3 mr-1" /> Saved to signal table
              </Badge>
            ) : (
              <Button disabled={busy} onClick={save}>
                <Save className="h-4 w-4 mr-1" /> Save to signal table
              </Button>
            )}
            <span className="text-xs text-[var(--text-secondary)]">
              Saves the engine-normalized fixture above as a row in the{' '}
              <Link href="/app/tables" className="underline">Intent signals (fixture)</Link>{' '}
              table, labeled {analysis.source}.
            </span>
          </div>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="p-4 space-y-2">
          <h3 className="font-semibold text-sm">Saved fixture signals ({rows.length})</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Rows in the Intent signals (fixture) table. All sample data - not live prospect intelligence.
          </p>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.rowId} className="flex items-center justify-between border border-[var(--border)] rounded-md px-3 py-2 text-sm gap-2">
                <span className="font-mono">{String(r.values['Company'] ?? '')}</span>
                <span className="text-[var(--text-secondary)] text-xs truncate max-w-[50%]">
                  {String(r.values['Sample titles'] ?? '')}
                </span>
                <span className="text-[var(--text-secondary)] text-xs whitespace-nowrap">
                  {String(r.values['Open roles in fixture'] ?? '')} roles
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
