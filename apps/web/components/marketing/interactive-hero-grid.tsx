'use client';

import React, { useState } from 'react';
import { Button, Badge } from '@leadloom/ui';
import { Play, RotateCcw, CheckCircle, Clock, Zap } from 'lucide-react';

interface DemoRow {
  id: number;
  company: string;
  domain: string;
  signal: string;
  status: 'idle' | 'running' | 'verified' | 'skipped';
  email: string | null;
  provider: string | null;
  latency: number | null;
}

const INITIAL_ROWS: DemoRow[] = [
  { id: 1, company: 'Vercel', domain: 'vercel.com', signal: '[GH] +140 stars/wk', status: 'idle', email: null, provider: null, latency: null },
  { id: 2, company: 'Supabase', domain: 'supabase.com', signal: '[Job] +3 Rust Eng', status: 'idle', email: null, provider: null, latency: null },
  { id: 3, company: 'Railway', domain: 'railway.app', signal: '[Web] Pricing Change', status: 'idle', email: null, provider: null, latency: null },
  { id: 4, company: 'Linear', domain: 'linear.app', signal: '[News] Series B Raised', status: 'idle', email: null, provider: null, latency: null },
  { id: 5, company: 'Modal', domain: 'modal.com', signal: '[Job] ML Infra Lead', status: 'idle', email: null, provider: null, latency: null },
];

export function InteractiveHeroGrid() {
  const [rows, setRows] = useState<DemoRow[]>(INITIAL_ROWS);
  const [isRunning, setIsRunning] = useState(false);

  const runSimulation = () => {
    setIsRunning(true);
    setRows(INITIAL_ROWS.map((r) => ({ ...r, status: 'running' })));

    // Step-by-step simulated cascades with realistic network delays
    setTimeout(() => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === 1
            ? { ...r, status: 'verified', email: 'alex@vercel.com', provider: 'Hunter [HU]', latency: 142 }
            : r
        )
      );
    }, 450);

    setTimeout(() => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === 2
            ? { ...r, status: 'verified', email: 'paul@supabase.com', provider: 'Apollo [AP]', latency: 98 }
            : r
        )
      );
    }, 850);

    setTimeout(() => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === 3
            ? { ...r, status: 'verified', email: 'tito@railway.app', provider: 'Dropcontact [DC]', latency: 210 }
            : r
        )
      );
    }, 1300);

    setTimeout(() => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === 4
            ? { ...r, status: 'verified', email: 'karri@linear.app', provider: 'Hunter [HU]', latency: 120 }
            : r
        )
      );
    }, 1650);

    setTimeout(() => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === 5
            ? { ...r, status: 'verified', email: 'erik@modal.com', provider: 'Apollo [AP]', latency: 110 }
            : r
        )
      );
      setIsRunning(false);
    }, 2000);
  };

  const reset = () => {
    setRows(INITIAL_ROWS);
    setIsRunning(false);
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border-muted bg-canvas-surface backdrop-blur-md">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border-subtle bg-canvas-elevated px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border-muted" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-muted" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-muted" aria-hidden="true" />
        <span className="caption-4 mx-auto text-text-muted">LeadLoom - simulated cascade preview</span>
      </div>
      {/* Table Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-loom animate-pulse" />
          <span className="caption-3 text-text-primary">
            Interactive demo - no signup needed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={runSimulation}
            disabled={isRunning}
            className="text-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunning ? 'Cascading...' : 'Run simulated waterfall'}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={reset} disabled={isRunning} className="text-xs" aria-label="Reset demo">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Grid Columns */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle caption-4 text-text-muted">
              <th className="py-3 px-5 font-medium">Account</th>
              <th className="py-3 px-5 font-medium whitespace-nowrap">Sample buying signal</th>
              <th className="py-3 px-5 font-medium whitespace-nowrap">Waterfall result</th>
              <th className="py-3 px-5 font-medium text-right whitespace-nowrap">Telemetry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-canvas-subtle transition-colors">
                <td className="py-3.5 px-5 font-medium text-text-primary">
                  {row.company} <span className="text-text-muted font-normal">({row.domain})</span>
                </td>
                <td className="py-3.5 px-5">
                  <Badge variant="loom">{row.signal}</Badge>
                </td>
                <td className="py-3.5 px-5">
                  {row.status === 'idle' && (
                    <span className="text-text-muted">Ready to cascade</span>
                  )}
                  {row.status === 'running' && (
                    <span className="inline-flex items-center gap-1.5 text-brand-loom">
                      <Clock className="w-3 h-3 animate-spin" /> Checking providers
                    </span>
                  )}
                  {row.status === 'verified' && (
                    <div className="inline-flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-signal-verified" />
                      <span className="text-text-primary font-medium font-mono text-xs">{row.email}</span>
                      <span className="caption-4 text-text-muted bg-canvas-elevated px-1.5 py-0.5 rounded border border-border-subtle">
                        {row.provider}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-3.5 px-5 text-right font-mono text-xs text-text-muted">
                  {row.latency ? (
                    <span className="text-signal-verified font-medium">{row.latency}ms - $0.003</span>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Guarantee Note */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-t border-border-subtle px-5 py-2.5 caption-4 text-text-muted">
        <span className="flex items-start gap-1.5">
          <Zap className="w-3 h-3 mt-0.5 shrink-0 text-signal-verified" />
          <span>Simulated example: early exit on the first provider for row 1, so the next step ($0.03) is skipped. No real provider calls.</span>
        </span>
        <span className="font-mono text-xs text-text-primary font-medium">Simulated cost: $0.015</span>
      </div>
    </div>
  );
}
