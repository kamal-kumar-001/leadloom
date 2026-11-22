'use client';

import React, { useState } from 'react';
import { Card, Button, Badge, EmptyState } from '@leadloom/ui';
import {
  KeyRound,
  Plus,
  Trash2,
  Shield,
  Calendar,
  Clock,
  X,
  Lock,
  Layers,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { FormField } from '../feedback/form-field';
import { ConfirmDialog } from '../feedback/confirm-dialog';
import { notify } from '../../lib/notify';
import { issueWorkspaceAgentToken, revokeWorkspaceAgentToken } from '../../lib/engine-client';
import { IssueAgentTokenRequestSchema } from '@leadloom/contracts';
import {credentialScopeRecord} from '../../lib/agent-connection-config';
import type { AgentTokenListItem, AgentTokenResponse, ProjectResponse } from '@leadloom/contracts';

export type TokenPreset = 'project-context' | 'workspace-tools' | 'custom';

export interface AgentTokensCardProps {
  tokens: AgentTokenListItem[];
  projects: ProjectResponse[];
  selectedProject: ProjectResponse | null;
  onTokenIssued: (
    token: AgentTokenResponse,
    envVarName?: 'LEADLOOM_AGENT_TOKEN' | 'LEADLOOM_TOOL_TOKEN' | string
  ) => void;
  onTokenRevoked: (tokenId: string) => void;
  isLoading?: boolean;
}

export function AgentTokensCard({
  tokens,
  projects,
  selectedProject,
  onTokenIssued,
  onTokenRevoked,
  isLoading = false,
}: AgentTokensCardProps) {
  const [isIssuing, setIsIssuing] = useState(false);
  const [preset, setPreset] = useState<TokenPreset>('project-context');
  const [name, setName] = useState('');
  const [boundProjectId, setBoundProjectId] = useState<string>(selectedProject?.id || '');
  const [scopes, setScopes] = useState<string[]>(['context:read', 'context:write']);
  const [expiryDays, setExpiryDays] = useState<number | undefined>(30);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; projectId?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Revocation state
  const [revokeTarget, setRevokeTarget] = useState<AgentTokenListItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Synchronize default boundProjectId with selectedProject when it changes
  React.useEffect(() => {
    if (preset === 'project-context') {
      if (selectedProject) {
        setBoundProjectId(selectedProject.id);
        if (!name || name.includes('Context Agent') || name.includes('Tools')) {
          setName(`${selectedProject.name} Context Agent`);
        }
      } else if (projects.length > 0) {
        setBoundProjectId((prev) => prev || projects[0].id);
      }
    } else if (preset === 'workspace-tools') {
      setBoundProjectId('');
    }
  }, [selectedProject, preset, projects]);

  const handleSelectPreset = (nextPreset: TokenPreset) => {
    setPreset(nextPreset);
    setFieldErrors({});

    if (nextPreset === 'project-context') {
      const targetProjId = selectedProject?.id || projects[0]?.id || '';
      setBoundProjectId(targetProjId);
      setScopes(['context:read', 'context:write']);
      const p = projects.find((x) => x.id === targetProjId) || selectedProject;
      setName(p ? `${p.name} Context Agent` : 'Project Context Agent');
    } else if (nextPreset === 'workspace-tools') {
      // Guardrail: Force empty project binding on tool tokens to prevent accidental project binding
      setBoundProjectId('');
      setScopes(['experiments:read', 'experiments:write', 'research:read', 'research:write']);
      setName('Workspace Tools Execution Agent');
    } else {
      setScopes(['context:read', 'context:write']);
    }
  };

  const handleScopeToggle = (scope: string) => {
    if (scope === '*') {
      setScopes(scopes.includes('*') ? ['context:read', 'context:write'] : ['*']);
      return;
    }
    const nextScopes = scopes.includes('*') ? [scope] : scopes.includes(scope) ? scopes.filter((s) => s !== scope) : [...scopes, scope];
    setScopes(nextScopes.length === 0 ? ['context:read'] : nextScopes);
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setFieldErrors({ name: 'Token name is required' });
      return;
    }

    if (scopes.some(scope=>['project:experiments:read','project:experiments:draft','project:experiments:results','project:campaigns:read','project:tables:read','project:tables:write','project:campaigns:edit','project:campaigns:draft','project:assets:read','project:assets:write','project:research:read','project:research:search','project:inventory:read'].includes(scope))&&!boundProjectId) {
      setFieldErrors({projectId:'Select the project this credential may access'});return;
    }
    if (preset === 'project-context' && !boundProjectId) {
      setFieldErrors({
        projectId: 'Project context token must be bound to a canonical project',
      });
      return;
    }

    // Force undefined projectId for workspace-tools preset to prevent accidental project binding
    const effectiveProjectId =
      preset === 'workspace-tools' ? undefined : boundProjectId || undefined;

    const payload = {
      name: trimmedName,
      projectId: effectiveProjectId,
      scopes,
      expiresInDays: expiryDays,
    };

    const parseResult = IssueAgentTokenRequestSchema.safeParse(payload);
    if (!parseResult.success) {
      setFieldErrors({ name: parseResult.error.issues[0]?.message || 'Invalid token parameters' });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const res = await issueWorkspaceAgentToken(parseResult.data);
      if (res.error || !res.data) {
        notify.error(res.error || 'Failed to issue agent token');
        return;
      }

      const envVar = effectiveProjectId ? 'LEADLOOM_AGENT_TOKEN' : 'LEADLOOM_TOOL_TOKEN';
      notify.success(`Agent token "${res.data.name}" issued successfully as ${envVar}`);
      setName('');
      setIsIssuing(false);
      onTokenIssued(res.data, envVar);
    } catch (err: unknown) {
      notify.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await revokeWorkspaceAgentToken(revokeTarget.id);
      if (!res.success) {
        notify.error(res.error || 'Failed to revoke agent token');
        return;
      }
      notify.success(`Agent token "${revokeTarget.name}" revoked`);
      onTokenRevoked(revokeTarget.id);
      setRevokeTarget(null);
    } catch (err: unknown) {
      notify.error(err);
    } finally {
      setIsRevoking(false);
    }
  };

  // Helper map from project ID to project object
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Show this project's tokens PLUS workspace-wide tokens so founder sees both credentials
  const filteredTokens = selectedProject
    ? tokens.filter((t) => t.projectId === selectedProject.id || !t.projectId)
    : tokens;

  // Bounded saved metadata is not proof of working access or a complete inventory.
  const hasContextToken = Boolean(selectedProject && credentialScopeRecord(tokens, selectedProject.id, ['context:read','context:write']));
  const hasToolToken = credentialScopeRecord(tokens, null, ['experiments:read','experiments:write','research:read','research:write']);

  return (
    <Card className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-brand-loom" />
            <span>Agent Credentials</span>
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {selectedProject
              ? `Manage credentials for ${selectedProject.name}. Start with a project-bound credential. Workspace-wide tools are optional.`
              : 'Workspace credentials for external coding agents. Your customer agent is the brain; LeadLoom persists state.'}
          </p>
        </div>

        <Button
          variant={isIssuing ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => {
            const next = !isIssuing;
            setIsIssuing(next);
            setFieldErrors({});
            if (next) {
              handleSelectPreset('project-context');
            }
          }}
          className="text-xs gap-1.5 self-start sm:self-auto"
        >
          {isIssuing ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Agent Token</span>
            </>
          )}
        </Button>
      </div>

      {/* 2-Credential Readiness Helper for Founders */}
      {selectedProject && !isIssuing && (
        <div className="p-3.5 rounded-xl bg-brand-loom/5 border border-brand-loom/20 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-loom" />
              <span className="text-xs font-semibold text-text-primary">
                Customer Agent Credentials Setup
              </span>
            </div>
            <span className="text-[11px] text-text-muted">Project first; workspace optional</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* 1. Project Context Token */}
            <div className="p-2.5 rounded-lg bg-canvas-elevated border border-border-subtle flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <code className="font-mono font-medium text-text-primary text-[11px]">
                    LEADLOOM_AGENT_TOKEN
                  </code>
                  {isLoading ? <Badge variant="muted">Unconfirmed</Badge> : hasContextToken ? (
                    <Badge variant="verified" className="text-[9px] px-1 py-0">
                      Scope record
                    </Badge>
                  ) : (
                    <Badge variant="matrix" className="text-[9px] px-1 py-0">
                      Not in loaded records
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-text-secondary truncate">
                  context:read + context:write recorded
                </p>
              </div>
              {!hasContextToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsIssuing(true);
                    handleSelectPreset('project-context');
                  }}
                  className="text-xs h-7 px-2 shrink-0"
                >
                  Issue
                </Button>
              )}
            </div>

            {/* 2. Workspace Tools Token */}
            <div className="p-2.5 rounded-lg bg-canvas-elevated border border-border-subtle flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <code className="font-mono font-medium text-text-primary text-[11px]">
                    LEADLOOM_TOOL_TOKEN
                  </code>
                  {isLoading ? <Badge variant="muted">Unconfirmed</Badge> : hasToolToken ? (
                    <Badge variant="verified" className="text-[9px] px-1 py-0">
                      Scope record
                    </Badge>
                  ) : (
                    <Badge variant="matrix" className="text-[9px] px-1 py-0">
                      Not in loaded records
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-text-secondary truncate">
                  Optional workspace validator/research scopes
                </p>
              </div>
              {!hasToolToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsIssuing(true);
                    handleSelectPreset('workspace-tools');
                  }}
                  className="text-xs h-7 px-2 shrink-0"
                >
                  Issue
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedProject && <p className="text-[11px] text-text-secondary">Newest 100 credential records only. Scope metadata is not a live connection test. Not found here does not mean no credential exists.</p>}
      {/* Issue Token Form with Presets */}
      {isIssuing && (
        <form
          onSubmit={handleIssue}
          className="p-4 rounded-xl bg-canvas-elevated border border-border-subtle space-y-4 transition-all"
        >
          <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Issue Agent Credential
            </h3>
            <span className="text-[11px] text-text-muted">Displays secret once</span>
          </div>

          {/* Preset Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary">
              Credential Preset & Target Environment Variable
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Preset 1: Project Context */}
              <button
                type="button"
                onClick={() => handleSelectPreset('project-context')}
                className={`p-3 rounded-lg border text-left transition-all space-y-1 ${
                  preset === 'project-context'
                    ? 'border-brand-loom bg-brand-loom/10 shadow-sm'
                    : 'border-border-subtle bg-canvas hover:border-brand-loom/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-brand-loom" />
                    <span className="text-xs font-semibold text-text-primary">Project Context</span>
                  </div>
                  <Badge variant="loom" className="text-[9px] px-1 py-0 font-mono">
                    Project-Bound
                  </Badge>
                </div>
                <code className="text-[11px] font-mono text-brand-loom block">
                  LEADLOOM_AGENT_TOKEN
                </code>
                <p className="text-[11px] text-text-secondary leading-snug">
                  Least scopes: <span className="font-mono">context:read,write</span>. Fenced to project.
                </p>
              </button>

              {/* Preset 2: Workspace Tools */}
              <button
                type="button"
                onClick={() => handleSelectPreset('workspace-tools')}
                className={`p-3 rounded-lg border text-left transition-all space-y-1 ${
                  preset === 'workspace-tools'
                    ? 'border-brand-loom bg-brand-loom/10 shadow-sm'
                    : 'border-border-subtle bg-canvas hover:border-brand-loom/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-status-verified" />
                    <span className="text-xs font-semibold text-text-primary">Workspace Tools</span>
                  </div>
                  <Badge variant="verified" className="text-[9px] px-1 py-0 font-mono">
                    Unbound
                  </Badge>
                </div>
                <code className="text-[11px] font-mono text-status-verified block">
                  LEADLOOM_TOOL_TOKEN
                </code>
                <p className="text-[11px] text-text-secondary leading-snug">
                  Least scopes: <span className="font-mono">experiments:*, research:*</span>. Workspace-wide.
                </p>
              </button>

              {/* Preset 3: Custom */}
              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`p-3 rounded-lg border text-left transition-all space-y-1 ${
                  preset === 'custom'
                    ? 'border-brand-loom bg-brand-loom/10 shadow-sm'
                    : 'border-border-subtle bg-canvas hover:border-brand-loom/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-text-secondary" />
                    <span className="text-xs font-semibold text-text-primary">Custom / Advanced</span>
                  </div>
                  <Badge variant="muted" className="text-[9px] px-1 py-0 font-mono">
                    Manual
                  </Badge>
                </div>
                <code className="text-[11px] font-mono text-text-muted block">
                  Custom Scopes
                </code>
                <p className="text-[11px] text-text-secondary leading-snug">
                  Manually configure custom permissions and project scoping.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Token Name */}
            <FormField
              id="token-name"
              label="Token Name"
              required
              hint="Descriptive name for identification"
              error={fieldErrors.name}
            >
              <input
                id="token-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project Context Agent"
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 text-xs bg-canvas border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-loom"
              />
            </FormField>

            {/* Bound Project Field with Anti-Accidental Binding Guardrail */}
            <FormField
              id="token-project"
              label="Bound Project"
              hint={
                preset === 'workspace-tools'
                  ? 'Locked: Tool tokens must be workspace-wide'
                  : 'Bind credential to a specific workspace project'
              }
              error={fieldErrors.projectId}
            >
              {preset === 'workspace-tools' ? (
                <div className="space-y-1.5">
                  <div className="w-full px-3 py-1.5 text-xs bg-canvas/60 border border-border-subtle rounded-md text-text-muted font-mono flex items-center justify-between select-none">
                    <span>No Project (Workspace-wide)</span>
                    <Lock className="w-3.5 h-3.5 text-brand-loom" />
                  </div>
                  <p className="text-[11px] text-brand-loom flex items-center gap-1">
                    <Shield className="w-3 h-3 shrink-0" />
                    <span>Guardrail active: Engine blocks project-scoped tokens from calling validator or research.</span>
                  </p>
                </div>
              ) : (
                <select
                  id="token-project"
                  value={boundProjectId}
                  onChange={(e) => setBoundProjectId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-1.5 text-xs bg-canvas border border-border-subtle rounded-md text-text-primary focus:outline-none focus:border-brand-loom"
                >
                  {preset !== 'project-context' && (
                    <option value="">No Project (Workspace-wide)</option>
                  )}
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.slug})
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Scopes Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary">
                Permissions / Scopes ({preset === 'custom' ? 'Custom' : 'Preset Enforced'})
              </label>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {preset === 'project-context' && (
                  <>
                    <Badge variant="loom" className="text-xs font-mono px-2 py-0.5">
                      context:read
                    </Badge>
                    <Badge variant="loom" className="text-xs font-mono px-2 py-0.5">
                      context:write
                    </Badge>
                  </>
                )}
                {preset === 'workspace-tools' && (
                  <>
                    <Badge variant="verified" className="text-xs font-mono px-2 py-0.5">
                      experiments:read
                    </Badge>
                    <Badge variant="verified" className="text-xs font-mono px-2 py-0.5">
                      experiments:write
                    </Badge>
                    <Badge variant="verified" className="text-xs font-mono px-2 py-0.5">
                      research:read
                    </Badge>
                    <Badge variant="verified" className="text-xs font-mono px-2 py-0.5">
                      research:write
                    </Badge>
                  </>
                )}
                {preset === 'custom' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleScopeToggle('context:read')}
                      disabled={isSubmitting || scopes.includes('*')}
                      className={`px-2 py-0.5 rounded text-xs font-mono border transition-all ${
                        scopes.includes('context:read') || scopes.includes('*')
                          ? 'bg-brand-loom/20 text-brand-loom border-brand-loom/40'
                          : 'bg-canvas text-text-muted border-border-subtle hover:text-text-primary'
                      }`}
                    >
                      context:read
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScopeToggle('context:write')}
                      disabled={isSubmitting || scopes.includes('*')}
                      className={`px-2 py-0.5 rounded text-xs font-mono border transition-all ${
                        scopes.includes('context:write') || scopes.includes('*')
                          ? 'bg-brand-loom/20 text-brand-loom border-brand-loom/40'
                          : 'bg-canvas text-text-muted border-border-subtle hover:text-text-primary'
                      }`}
                    >
                      context:write
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScopeToggle('experiments:write')}
                      disabled={isSubmitting || scopes.includes('*')}
                      className={`px-2 py-0.5 rounded text-xs font-mono border transition-all ${
                        scopes.includes('experiments:write') || scopes.includes('*')
                          ? 'bg-brand-loom/20 text-brand-loom border-brand-loom/40'
                          : 'bg-canvas text-text-muted border-border-subtle hover:text-text-primary'
                      }`}
                    >
                      experiments:write
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScopeToggle('research:write')}
                      disabled={isSubmitting || scopes.includes('*')}
                      className={`px-2 py-0.5 rounded text-xs font-mono border transition-all ${
                        scopes.includes('research:write') || scopes.includes('*')
                          ? 'bg-brand-loom/20 text-brand-loom border-brand-loom/40'
                          : 'bg-canvas text-text-muted border-border-subtle hover:text-text-primary'
                      }`}
                    >
                      research:write
                    </button>
                    <button type="button" aria-pressed={scopes.includes('project:experiments:read')||scopes.includes('*')} onClick={()=>handleScopeToggle('project:experiments:read')} disabled={isSubmitting||scopes.includes('*')} className={`px-2 py-0.5 rounded text-xs font-mono border ${scopes.includes('project:experiments:read')||scopes.includes('*')?'bg-brand-loom/20 text-brand-loom border-brand-loom/40':'bg-canvas text-text-muted border-border-subtle'}`}>project:experiments:read</button>
                    {['project:experiments:results','project:experiments:draft','project:assets:read','project:assets:write','project:research:read','project:inventory:read','project:tables:read','project:tables:write','project:campaigns:edit','project:campaigns:draft'].map(scope=><button key={scope} type="button" aria-pressed={scopes.includes(scope)||scopes.includes('*')} onClick={()=>handleScopeToggle(scope)} disabled={isSubmitting||scopes.includes('*')} className={`px-2 py-0.5 rounded text-xs font-mono border ${scopes.includes(scope)||scopes.includes('*')?'bg-brand-loom/20 text-brand-loom border-brand-loom/40':'bg-canvas text-text-muted border-border-subtle'}`}>{scope}</button>)}
                    <button type="button" aria-pressed={scopes.includes('project:campaigns:read')||scopes.includes('*')} onClick={()=>handleScopeToggle('project:campaigns:read')} disabled={isSubmitting||scopes.includes('*')} className={`px-2 py-0.5 rounded text-xs font-mono border ${scopes.includes('project:campaigns:read')||scopes.includes('*')?'bg-brand-loom/20 text-brand-loom border-brand-loom/40':'bg-canvas text-text-muted border-border-subtle'}`}>project:campaigns:read</button>
                    {['tables:read','tables:write'].map(scope=><button key={scope} type="button" aria-pressed={scopes.includes(scope)||scopes.includes('*')} onClick={()=>handleScopeToggle(scope)} disabled={isSubmitting||scopes.includes('*')} className={`px-2 py-0.5 rounded text-xs font-mono border ${scopes.includes(scope)||scopes.includes('*')?'bg-brand-loom/20 text-brand-loom border-brand-loom/40':'bg-canvas text-text-muted border-border-subtle'}`}>{scope}</button>)}
                    <span className="w-full text-[11px] text-text-muted">project:campaigns:edit separately allows guarded revision of empty private drafts only. project:campaigns:draft creates private project campaign copy only. It cannot add recipients/senders, activate, approve, release or send. Presets do not include it. project:experiments:draft separately creates private caller-authored validation pages, never publishes them or captures leads. project:experiments:results reads aggregate stored counts only, no contacts, answers or metric writes.</span>
                    <button type="button" aria-pressed={scopes.includes('project:research:search')} onClick={()=>handleScopeToggle('project:research:search')} disabled={isSubmitting||scopes.includes('*')} className={`px-2 py-0.5 rounded text-xs font-mono border ${scopes.includes('project:research:search')?'bg-brand-loom/20 text-brand-loom border-brand-loom/40':'bg-canvas text-text-muted border-border-subtle'}`}>project:research:search</button>
                    <span className="w-full text-[11px] text-text-muted">project:research:search explicitly permits bounded public HN queries sent to Algolia when enabled by the operator. Never send private context or secrets. It saves nothing; stored-research and wildcard scopes do not grant it. Presets exclude it.</span>
                    <span className="w-full text-[11px] text-text-muted">project:tables scopes access only newly project-owned tables. Existing unassigned tables are excluded. Tables scopes are workspace-wide, not project-isolated. Write creates new text tables and edits text cells only; it never enriches through a provider or sends.</span>
                    <button type="button" aria-pressed={scopes.includes('campaigns:read')||scopes.includes('*')} onClick={()=>handleScopeToggle('campaigns:read')} disabled={isSubmitting||scopes.includes('*')} className={`px-2 py-0.5 rounded text-xs font-mono border ${scopes.includes('campaigns:read')||scopes.includes('*')?'bg-brand-loom/20 text-brand-loom border-brand-loom/40':'bg-canvas text-text-muted border-border-subtle'}`}>campaigns:read</button>
                    <button
                      type="button"
                      onClick={() => handleScopeToggle('*')}
                      disabled={isSubmitting}
                      className={`px-2 py-0.5 rounded text-xs font-mono border transition-all ${
                        scopes.includes('*')
                          ? 'bg-brand-loom/20 text-brand-loom border-brand-loom/40'
                          : 'bg-canvas text-text-muted border-border-subtle hover:text-text-primary'
                      }`}
                    >
                      * (all)
                    </button>
                  </>
                )}
              </div>
              <p className="text-[11px] text-text-muted">
                {preset === 'project-context' &&
                  'Enforces least privileges required for reading and persisting canonical project context memory.'}
                {preset === 'workspace-tools' &&
                  'Enforces least privileges required for hypothesis validation and AI web research tools.'}
                {preset === 'custom' &&
                  'Select the granular permission scopes granted to this agent credential.'}
              </p>
            </div>

            {/* Expiration selection */}
            <FormField
              id="token-expiry"
              label="Expiration"
              hint="Time-to-live for this credential"
            >
              <select
                id="token-expiry"
                value={expiryDays ?? 'never'}
                onChange={(e) =>
                  setExpiryDays(e.target.value === 'never' ? undefined : Number(e.target.value))
                }
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 text-xs bg-canvas border border-border-subtle rounded-md text-text-primary focus:outline-none focus:border-brand-loom"
              >
                <option value={7}>7 Days</option>
                <option value={30}>30 Days (Recommended)</option>
                <option value={90}>90 Days</option>
                <option value={365}>1 Year</option>
                <option value="never">No Expiration</option>
              </select>
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsIssuing(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="text-xs"
            >
              {isSubmitting
                ? 'Issuing...'
                : preset === 'project-context'
                ? 'Issue Context Credential'
                : preset === 'workspace-tools'
                ? 'Issue Tools Credential'
                : 'Issue Credential'}
            </Button>
          </div>
        </form>
      )}

      {/* Tokens Table & List */}
      {isLoading ? (
        <div className="py-6 text-center text-xs text-text-muted">
          Loading agent credentials...
        </div>
      ) : filteredTokens.length === 0 ? (
        <EmptyState
          title={
            selectedProject
              ? `No tokens issued for ${selectedProject.name}`
              : 'No agent tokens issued yet'
          }
          description="Issue both project-context (LEADLOOM_AGENT_TOKEN) and workspace-tools (LEADLOOM_TOOL_TOKEN) credentials to empower your customer coding agent."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsIssuing(true);
                handleSelectPreset('project-context');
              }}
              className="text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Token</span>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted font-medium">
                  <th className="py-2.5 px-3">Token Name</th>
                  <th className="py-2.5 px-3">Target Env</th>
                  <th className="py-2.5 px-3">Prefix</th>
                  <th className="py-2.5 px-3">Bound Project</th>
                  <th className="py-2.5 px-3">Scopes</th>
                  <th className="py-2.5 px-3">Expires</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredTokens.map((token) => {
                  const boundProj = token.projectId ? projectMap.get(token.projectId) : null;
                  const isExpired =
                    token.expiresAt && new Date(token.expiresAt).getTime() < Date.now();
                  const isRevoked = token.revoked;
                  const envVar = token.projectId
                    ? 'LEADLOOM_AGENT_TOKEN'
                    : 'LEADLOOM_TOOL_TOKEN';

                  return (
                    <tr
                      key={token.id}
                      className="hover:bg-canvas-elevated/40 transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-text-primary">
                        {token.name}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={token.projectId ? 'loom' : 'verified'}
                          className="text-[10px] font-mono px-1.5 py-0"
                        >
                          {envVar}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-text-muted">
                        {token.tokenPrefix}••••
                      </td>
                      <td className="py-3 px-3">
                        {boundProj ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-text-primary font-medium">
                              {boundProj.name}
                            </span>
                            <Badge
                              variant="muted"
                              className="text-[10px] font-mono px-1 py-0"
                            >
                              {boundProj.slug}
                            </Badge>
                          </div>
                        ) : (
                          <Badge
                            variant="muted"
                            className="text-[10px] font-mono px-1 py-0"
                          >
                            Workspace-wide (Unbound)
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {token.scopes.map((sc) => (
                            <Badge
                              key={sc}
                              variant="muted"
                              className="text-[10px] font-mono px-1.5 py-0"
                            >
                              {sc}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-text-secondary text-[11px] font-mono">
                        {token.expiresAt
                          ? new Date(token.expiresAt).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="py-3 px-3">
                        {isRevoked ? (
                          <Badge variant="failed" className="text-[10px]">
                            Revoked
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="catchall" className="text-[10px]">
                            Expired
                          </Badge>
                        ) : (
                          <Badge variant="verified" className="text-[10px]">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!isRevoked && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRevokeTarget(token)}
                            className="text-xs text-signal-failed hover:bg-signal-failed/10 hover:border-signal-failed/30 h-7 px-2"
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (390px responsive) */}
          <div className="block md:hidden space-y-3">
            {filteredTokens.map((token) => {
              const boundProj = token.projectId ? projectMap.get(token.projectId) : null;
              const isExpired =
                token.expiresAt && new Date(token.expiresAt).getTime() < Date.now();
              const isRevoked = token.revoked;
              const envVar = token.projectId
                ? 'LEADLOOM_AGENT_TOKEN'
                : 'LEADLOOM_TOOL_TOKEN';

              return (
                <div
                  key={token.id}
                  className="p-3.5 rounded-xl bg-canvas-elevated border border-border-subtle space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-text-primary">{token.name}</div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Badge
                          variant={token.projectId ? 'loom' : 'verified'}
                          className="text-[9px] font-mono px-1 py-0"
                        >
                          {envVar}
                        </Badge>
                        <span className="font-mono text-[11px] text-text-muted">
                          {token.tokenPrefix}••••
                        </span>
                      </div>
                    </div>
                    {isRevoked ? (
                      <Badge variant="failed" className="text-[10px]">
                        Revoked
                      </Badge>
                    ) : isExpired ? (
                      <Badge variant="catchall" className="text-[10px]">
                        Expired
                      </Badge>
                    ) : (
                      <Badge variant="verified" className="text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-border-subtle">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Project:</span>
                      <span className="font-medium text-text-primary">
                        {boundProj
                          ? `${boundProj.name} (${boundProj.slug})`
                          : 'Workspace-wide (Unbound)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Expires:</span>
                      <span className="font-mono text-text-secondary">
                        {token.expiresAt
                          ? new Date(token.expiresAt).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Scopes:</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {token.scopes.map((sc) => (
                          <Badge
                            key={sc}
                            variant="muted"
                            className="text-[10px] font-mono px-1 py-0"
                          >
                            {sc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {!isRevoked && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRevokeTarget(token)}
                        className="text-xs text-signal-failed hover:bg-signal-failed/10 hover:border-signal-failed/30 w-full justify-center"
                      >
                        Revoke Credential
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revocation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(revokeTarget)}
        title="Revoke Agent Credential"
        description={
          revokeTarget
            ? `Are you sure you want to revoke the agent token "${revokeTarget.name}"? Any autonomous agents or background workers currently using this token will immediately lose access.`
            : ''
        }
        confirmLabel="Revoke Token"
        cancelLabel="Keep Active"
        variant="danger"
        isLoading={isRevoking}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </Card>
  );
}
