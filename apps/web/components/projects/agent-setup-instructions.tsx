'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@leadloom/ui';
import { Terminal, Copy, Check, ShieldAlert, FileCode2, CheckCircle2, Download, Package } from 'lucide-react';
import { notify } from '../../lib/notify';
import type { ProjectResponse } from '@leadloom/contracts';

export interface AgentSetupInstructionsProps {
  selectedProject: ProjectResponse | null;
  apiUrl: string | null;
  issuedToken?: string | null;
  issuedTokenType?: 'LEADLOOM_AGENT_TOKEN' | 'LEADLOOM_TOOL_TOKEN' | string;
}

export function AgentSetupInstructions({
  selectedProject,
  apiUrl,
  issuedToken,
  issuedTokenType,
}: AgentSetupInstructionsProps) {
  const [copiedBash, setCopiedBash] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const isToolToken = issuedTokenType === 'LEADLOOM_TOOL_TOKEN';
  const agentTokenPlaceholder = !isToolToken && issuedToken ? issuedToken : 'lld_agt_YOUR_PROJECT_BOUND_TOKEN';
  const projectPlaceholder = selectedProject?.id || 'YOUR_CANONICAL_PROJECT_UUID';
  const destination = apiUrl || 'SETUP_REQUIRED_CONFIGURE_PUBLIC_API_URL';
  const bashSnippet = `export LEADLOOM_AGENT_TOKEN="${agentTokenPlaceholder}"
export LEADLOOM_PROJECT_ID="${projectPlaceholder}"
export LEADLOOM_API_URL="${destination}"
# Workspace-wide tools are optional. Do not add a workspace token for project-only work.`;

  const envSnippet = `# LeadLoom Agent Configuration
# NEVER commit this file to git (.gitignore)
LEADLOOM_PROJECT_ID="${projectPlaceholder}"
LEADLOOM_AGENT_TOKEN="${agentTokenPlaceholder}"
LEADLOOM_API_URL="${destination}"
# Start with project-bound context:read and context:write.
# Add only the separate project scopes the intended workflow needs.
# Optional workspace-wide tools require a separately reviewed credential.
# LEADLOOM_TOOL_TOKEN=""`;

  const cliSnippet = `# Extract the selected project's bundle, then run inside its directory.
# The CLI reads .env.local itself; no shell export or xargs is needed.
node cli.mjs entries brief
# History is not proof that a blocker or next step is still current.
node cli.mjs entries search "current blocker"
node cli.mjs context get
# Prepare context.json with context, metadata and expectedRevision from get.
# Use expectedRevision:null only for a snapshot that does not exist yet.
node cli.mjs context save-file context.json
# A 409 requires deliberate reconciliation, not an automatic overwrite.`;

  const curlSnippet = `# Run after setting the shell variables above.
curl -X GET "\${LEADLOOM_API_URL}/${apiUrl?.endsWith('/api/agent') ? 'context' : 'agent/context'}/entries/brief" \\
  -H "Authorization: Bearer \${LEADLOOM_AGENT_TOKEN}"
# Empty project history is valid. A never-saved snapshot may return 404 on context get.`;

  const copyToClipboard = async (text: string, type: 'bash' | 'env' | 'curl' | 'cli') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'bash') {
        setCopiedBash(true);
        setTimeout(() => setCopiedBash(false), 2000);
      } else if (type === 'env') {
        setCopiedEnv(true);
        setTimeout(() => setCopiedEnv(false), 2000);
      } else if (type === 'curl') {
        setCopiedCurl(true);
        setTimeout(() => setCopiedCurl(false), 2000);
      } else {
        setCopiedCli(true);
        setTimeout(() => setCopiedCli(false), 2000);
      }
      notify.success('Copied configuration snippet to clipboard');
    } catch {
      notify.error('Failed to copy to clipboard');
    }
  };

  const handleDownloadBundle = () => {
    if (!selectedProject || !apiUrl) return;
    const a = document.createElement('a');
    a.href = `/api/projects/${projectPlaceholder}/bundle`;
    a.download = `leadloom-agent-skills-${selectedProject?.slug || 'bundle'}.tar.gz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify.success('Downloading skills and setup bundle');
  };

  return (
    <Card className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary tracking-tight">
            Agent Integration & Local Setup
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Configure your customer coding agent to communicate securely. Your customer coding agent is the brain; LeadLoom provides canonical project state and persistent memory.
          </p>
        </div>
        {selectedProject ? (
          <Badge variant="loom" className="text-xs self-start sm:self-auto font-mono">
            Bound Project: {selectedProject.name} ({selectedProject.slug})
          </Badge>
        ) : (
          <Badge variant="muted" className="text-xs self-start sm:self-auto text-text-muted">
            Select a project
          </Badge>
        )}
      </div>

      {/* Customer-Agent Skills Bundle (.tar.gz) Download */}
      <div className="rounded-xl border border-border-subtle bg-canvas-elevated p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-loom" />
            <h3 className="text-sm font-semibold text-text-primary">
              Customer-Agent Skills Bundle (.tar.gz)
            </h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Equip your local coding agent (Cursor, Claude Code, Cline) with LeadLoom&apos;s 8 project workflow packs and pre-configured <code className="font-mono text-text-mono">.env.local</code>. Download directly using your active session.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleDownloadBundle}
          disabled={!selectedProject || !apiUrl}
          className="shrink-0 text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Skills Bundle</span>
        </Button>
      </div>

      {!apiUrl && <p role="alert" className="text-xs text-text-secondary">Public agent gateway is unavailable. Configure LEADLOOM_PUBLIC_API_URL or the trusted application origin. No destination was inferred from request headers.</p>}
      {!selectedProject && <p className="text-xs text-text-secondary">Select a project before downloading its setup bundle.</p>}
      {/* Snippet Tabs / Blocks */}
      <div className="space-y-4">
        {/* Terminal Export */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <Terminal className="w-3.5 h-3.5 text-brand-loom" />
              <span>Shell Environment Variables</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!apiUrl || !selectedProject}
              onClick={() => copyToClipboard(bashSnippet, 'bash')}
              className="text-[11px] h-7 px-2 gap-1"
            >
              {copiedBash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedBash ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="bg-canvas-elevated border border-border-subtle rounded-lg p-3 font-mono text-xs text-text-mono overflow-x-auto select-all">
            {bashSnippet}
          </pre>
        </div>

        {/* .env.local file */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <FileCode2 className="w-3.5 h-3.5 text-brand-loom" />
              <span>Local Environment File (.env.local)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!apiUrl || !selectedProject}
              onClick={() => copyToClipboard(envSnippet, 'env')}
              className="text-[11px] h-7 px-2 gap-1"
            >
              {copiedEnv ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedEnv ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="bg-canvas-elevated border border-border-subtle rounded-lg p-3 font-mono text-xs text-text-mono overflow-x-auto select-all">
            {envSnippet}
          </pre>
        </div>

        {/* Bundled CLI Runner (cli.mjs) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <Terminal className="w-3.5 h-3.5 text-brand-loom" />
              <span>Bundled CLI Execution (cli.mjs)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!apiUrl || !selectedProject}
              onClick={() => copyToClipboard(cliSnippet, 'cli')}
              className="text-[11px] h-7 px-2 gap-1"
            >
              {copiedCli ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCli ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="bg-canvas-elevated border border-border-subtle rounded-lg p-3 font-mono text-xs text-text-mono overflow-x-auto select-all">
            {cliSnippet}
          </pre>
        </div>

        {/* Verification Command */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-loom" />
              <span>Context Verification Request</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!apiUrl || !selectedProject}
              onClick={() => copyToClipboard(curlSnippet, 'curl')}
              className="text-[11px] h-7 px-2 gap-1"
            >
              {copiedCurl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCurl ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="bg-canvas-elevated border border-border-subtle rounded-lg p-3 font-mono text-xs text-text-mono overflow-x-auto select-all">
            {curlSnippet}
          </pre>
        </div>
      </div>

      {/* Security Best Practices */}
      <div className="rounded-xl bg-canvas-elevated border border-border-subtle p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          <ShieldAlert className="w-4 h-4 text-brand-loom shrink-0" />
          <span>Security Invariants & Boundary Enforcements</span>
        </div>
        <ul className="text-xs text-text-secondary space-y-1.5 pl-5 list-disc leading-relaxed">
          <li>
            <strong className="text-text-primary">Project-first access:</strong> A project-bound credential supports context and separately granted project assets, research, tables, experiments and private campaign drafts. Existing presets do not add those scopes. A workspace tool credential is optional and has a wider boundary. Stored drafts never authorize publication or sending.
          </li>
          <li>
            <strong className="text-text-primary">Canonical Project Binding:</strong> Project-bound tokens are locked to this project&apos;s canonical UUID. Cross-tenant or foreign project access is rejected with <code className="font-mono text-text-mono">404 Not Found</code>.
          </li>
          <li>
            <strong className="text-text-primary">Human-Only Route Protection:</strong> Agent tokens are forbidden from calling administrative routes like project creation or listing.
          </li>
          <li>
            <strong className="text-text-primary">Payload & Context Cap:</strong> Project context memory is bounded to 256KB total size to prevent memory exhaustion.
          </li>
          <li>
            <strong className="text-text-primary">Keep Out of Version Control:</strong> Never check in <code className="font-mono text-text-mono">.env.local</code> or secret tokens into git. Verify that your <code className="font-mono text-text-mono">.gitignore</code> ignores environment files.
          </li>
        </ul>
      </div>
    </Card>
  );
}
