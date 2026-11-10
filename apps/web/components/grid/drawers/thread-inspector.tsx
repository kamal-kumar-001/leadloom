'use client';

import React, { useState } from 'react';
import { Button, Badge } from '@leadloom/ui';
import { X, Play, Code, FileText, CheckCircle } from 'lucide-react';
import { useLoomStore } from '../../../store/loom-store';

export function ThreadInspector() {
  const inspectorRowId = useLoomStore((state) => state.inspectorRowId);
  const setInspectorRowId = useLoomStore((state) => state.setInspectorRowId);
  const rowsById = useLoomStore((state) => state.rowsById);

  const [activeTab, setActiveTab] = useState<'markdown' | 'prompt'>('markdown');
  const [model, setModel] = useState('gpt-4o-mini');

  if (!inspectorRowId) return null;
  const row = rowsById[inspectorRowId];
  if (!row) return null;

  const companyName = String(row.cells['00000000-0000-4000-8000-000000000101'] || 'Target Account');
  const domain = String(row.cells['00000000-0000-4000-8000-000000000102'] || 'domain.com');

  const mockScrapedMarkdown = `# ${companyName} (${domain})
## Product Overview
Developer platform for high-performance frontend workflows and edge compute infrastructure.

## Recent Initiatives & Signals
- Announced Next.js 15 Release Candidate with Turbopack enabled by default.
- Scaling Platform Engineering team (+4 open backend roles in Rust and Go).
- Published 10-K cloud infrastructure cost attribution architecture.`;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-border-muted bg-canvas-surface/95 backdrop-blur-2xl shadow-2xl flex flex-col font-sans animate-fade-in">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-text-primary text-sm">{companyName}</h3>
            <Badge variant="loom">{domain}</Badge>
          </div>
          <p className="text-xs font-mono text-text-muted mt-0.5">Thread Inspector & AI Scraper Debugger</p>
        </div>
        <button
          onClick={() => setInspectorRowId(null)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-canvas-elevated transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Controls */}
      <div className="flex border-b border-border-subtle px-4 bg-canvas-elevated/30">
        <button
          onClick={() => setActiveTab('markdown')}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 text-xs font-mono transition-colors ${
            activeTab === 'markdown'
              ? 'border-brand-loom text-brand-loom font-medium'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Scraped Markdown (What Bot Saw)
        </button>
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 text-xs font-mono transition-colors ${
            activeTab === 'prompt'
              ? 'border-brand-loom text-brand-loom font-medium'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Code className="w-3.5 h-3.5" /> Prompt Template & JSON Schema
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-text-secondary leading-relaxed">
        {activeTab === 'markdown' ? (
          <div className="p-4 rounded-lg border border-border-subtle bg-canvas-elevated/40 whitespace-pre-wrap">
            {mockScrapedMarkdown}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] text-text-muted mb-1 uppercase tracking-wider">
                Model Routing
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded border border-border-subtle bg-canvas-elevated p-2 text-xs text-text-primary focus:border-brand-loom focus:outline-none"
              >
                <option value="gpt-4o-mini">OpenAI: gpt-4o-mini ($0.00015/1k)</option>
                <option value="claude-3-5-haiku">Anthropic: claude-3-5-haiku</option>
                <option value="gemini-1-5-flash">Google: Gemini 1.5 Flash (Free Tier)</option>
                <option value="ollama-llama-3-1">Local Ollama: Llama 3.1 8B ($0.00)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1 uppercase tracking-wider">
                System Prompt Template
              </label>
              <textarea
                rows={5}
                defaultValue={`You are an expert SDR researcher. Given the scraped text for {{domain}}, extract:
1. The #1 technical initiative this quarter
2. The specific cloud/DevOps pain point
Output valid JSON adhering to schema.`}
                className="w-full rounded border border-border-subtle bg-canvas-elevated p-3 text-xs text-text-primary font-mono focus:border-brand-loom focus:outline-none"
              />
            </div>

            <Button size="sm" variant="primary" className="w-full">
              <Play className="w-3.5 h-3.5" />
              <span>Test Prompt on This Row</span>
            </Button>
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="border-t border-border-subtle p-3 bg-canvas-elevated/40 flex items-center justify-between text-[11px] font-mono text-text-muted">
        <span>Playwright Chromium • Fenced (640MB)</span>
        <span className="text-signal-verified font-medium">Render Time: 120ms</span>
      </div>
    </div>
  );
}
