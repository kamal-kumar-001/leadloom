'use client';

import React, { useState } from 'react';
import { Badge } from '@leadloom/ui';
import { Terminal, Shield, Cpu, Copy, Check } from 'lucide-react';

const DOCKER_SNIPPET = `version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    deploy:
      resources: { limits: { memory: 1024M } }
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 384mb --maxmemory-policy allkeys-lru
  api:
    image: leadloom/engine:latest
    environment: [ LEADLOOM_MASTER_KEY=sk_master_aes256_... ]
  web:
    image: leadloom/web:latest
    ports: ["3000:3000"]`;

const SDK_SNIPPET = `import { defineProvider, ExitCondition } from '@leadloom/engine';

export default defineProvider({
  id: 'custom_internal_crm',
  costMicrocents: 100, // $0.001
  async execute(target) {
    const res = await fetch(\`https://internal.crm/api/lookup?domain=\${target.domain}\`);
    const data = await res.json();
    return {
      status: data.email ? 'deliverable' : 'not_found',
      value: data.email,
      confidence: data.confidence,
    };
  },
});`;

const SECURITY_SNIPPET = `# LeadLoom Security Invariants
- AES-256-GCM Envelope Encryption (12-byte IV, 16-byte Auth Tag)
- Zero Plaintext Credentials in Logs or DB Backups
- SHA-256 One-Way Opt-Out Suppression List
- RFC 8058 One-Click Unsubscribe Headers Pre-Configured
- Automated SPF, DKIM, and DMARC Verification UDP Handshake`;

export function ArchitectureTabs() {
  const [activeTab, setActiveTab] = useState<'docker' | 'sdk' | 'security'>('docker');
  const [copied, setCopied] = useState(false);

  const activeContent =
    activeTab === 'docker' ? DOCKER_SNIPPET : activeTab === 'sdk' ? SDK_SNIPPET : SECURITY_SNIPPET;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24 max-w-5xl mx-auto px-4 sm:px-6">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <Badge variant="matrix" className="mb-3">
          Developer-First Transparency
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
          Own your stack. Inspect every queue.
        </h2>
        <p className="mt-3 text-sm sm:text-base text-text-secondary">
          No black boxes. Self-host on a single $5/mo VPS in 60 seconds with Docker Compose.
        </p>
      </div>

      <div className="rounded-xl border border-border-muted bg-canvas-surface/90 overflow-hidden shadow-2xl">
        {/* Tab Headers */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 bg-canvas-elevated/40">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('docker')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                activeTab === 'docker'
                  ? 'bg-canvas-elevated text-brand-loom border border-border-subtle'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" /> docker-compose.yml
            </button>
            <button
              onClick={() => setActiveTab('sdk')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                activeTab === 'sdk'
                  ? 'bg-canvas-elevated text-brand-weave border border-border-subtle'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" /> CustomProvider.ts
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                activeTab === 'security'
                  ? 'bg-canvas-elevated text-signal-verified border border-border-subtle'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Security.md
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-canvas-elevated transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-signal-verified" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Code Body */}
        <pre className="p-6 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed bg-canvas/60">
          <code>{activeContent}</code>
        </pre>
      </div>
    </section>
  );
}
