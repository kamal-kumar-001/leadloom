'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DraftPageCopySchema, DraftSurveyQuestionsSchema, type DraftPageCopy, type DraftSurveyQuestions } from '@leadloom/contracts';
import { SurveyDraftEditor } from '../../../components/validator/survey-draft-editor';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, GatedButton, type GateState } from '@leadloom/ui';
import {
  fetchWorkspaceProjects,
  fetchWorkspaceExperiments,
  fetchExperimentScorecard,
  fetchOwnerPage,
  fetchEntitlementDecision,
  generateExperiment,
  setExperimentPublish,
  type ExperimentScorecard,
  type WorkspaceExperimentRow,
} from '../../../lib/engine-client';
import { ExperimentScorecardPanel } from '../../../components/validator/experiment-scorecard';
import { gateFromDecision } from '../../../lib/gate';
import {PageCopyEditor} from '../../../components/validator/page-copy-editor';
import { PagePreviewModal, type OwnerPagePreview } from '../../../components/validator/page-preview-modal';
import {
  FlaskConical,
  ExternalLink,
  RefreshCw,
  Plus,
} from 'lucide-react';

function renderVerdictBadge(verdict: string) {
  const raw = (verdict || 'pending').toLowerCase();
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
  if (raw === 'validated' || raw === 'pass') {
    return (
      <Badge variant="verified" className="text-[10px] font-mono">
        {capitalized}
      </Badge>
    );
  }
  if (raw === 'rejected' || raw === 'fail' || raw === 'failed') {
    return (
      <Badge variant="failed" className="text-[10px] font-mono">
        {capitalized}
      </Badge>
    );
  }
  if (raw === 'pending') {
    return (
      <Badge variant="matrix" className="text-[10px] font-mono">
        {capitalized}
      </Badge>
    );
  }
  return (
    <Badge variant="subtle" className="text-[10px] font-mono">
      {capitalized}
    </Badge>
  );
}

export default function ValidatorPage() {
  const [projects,setProjects]=useState<import('@leadloom/contracts').ProjectResponse[]>([]);
  const [projectError,setProjectError]=useState('');
  const [createProjectId,setCreateProjectId]=useState('');
  const [filterProjectId,setFilterProjectId]=useState('');
  const listSequence=React.useRef(0);
  useEffect(()=>{let active=true;fetchWorkspaceProjects().then(r=>{if(!active)return;if(r.error)setProjectError('Projects could not be loaded. New experiments will remain unassigned.');else setProjects(r.projects);}).catch(()=>{if(active)setProjectError('Projects could not be loaded.');});return()=>{active=false;};},[]);
  const [experiments, setExperiments] = useState<WorkspaceExperimentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customSurvey,setCustomSurvey]=useState(false);
  const [surveyQuestions,setSurveyQuestions]=useState<DraftSurveyQuestions>([]);
  const [customCopy,setCustomCopy]=useState(false);
  const [pageCopy,setPageCopy]=useState<DraftPageCopy>({title:'',headline:'',subheadline:'',heroCtaText:'Request Early Access'});
  const [hypothesis, setHypothesis] = useState('');
  const [preferredSlug, setPreferredSlug] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<ExperimentScorecard | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [editor,setEditor]=useState<{experimentId:string;page:OwnerPagePreview}|null>(null);
  const [editLoadingId,setEditLoadingId]=useState<string|null>(null);
  const [copySaved,setCopySaved]=useState(false);
  const [publication,setPublication]=useState<{experimentId:string;page:OwnerPagePreview}|null>(null);
  const [publicationError,setPublicationError]=useState<string|null>(null);
  const [preview, setPreview] = useState<OwnerPagePreview | null>(null);
  // Plan gate for generation, from the engine's own decision route. When the
  // engine has no entitlement service mounted, enforcement is off there too,
  // so the button stays normal - a UI lock is never the boundary.
  const [generateGate, setGenerateGate] = useState<GateState>({ kind: 'available' });

  const loadExperiments = useCallback(async () => {
    const sequence=++listSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWorkspaceExperiments(filterProjectId||undefined);
      if(sequence!==listSequence.current)return;
      if (res.data) {
        setExperiments(res.data);
      } else {
        setError(res.error || 'Failed to fetch workspace experiments');
      }
    } catch (err: unknown) {
      if(sequence!==listSequence.current)return;
      setError(err instanceof Error ? err.message : 'Engine connection error');
    } finally {
      if(sequence===listSequence.current)setIsLoading(false);
    }
  }, [filterProjectId]);

  useEffect(() => {
    loadExperiments();
    fetchEntitlementDecision('validator').then((res) => {
      if (res.unconfigured) return; // enforcement off server-side too; normal button
      setGenerateGate(gateFromDecision(res.data));
    });
  }, [loadExperiments]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!hypothesis.trim()) {
      setGenerateError('Describe the hypothesis before generating a page.');
      return;
    }
    if(customCopy&&!DraftPageCopySchema.safeParse(pageCopy).success){setGenerateError('Complete every custom page-copy field within the shown limits.');return;}
    if(customSurvey&&!DraftSurveyQuestionsSchema.safeParse(surveyQuestions).success){setGenerateError('Check your survey: distinct questions, 300 characters each; choice questions need 2-10 distinct options of up to 160 characters.');return;}
    setCopySaved(false);
    setGenerating(true);
    setGenerateError(null);
    setCreatedUrl(null);
    const res = await generateExperiment({
      ...(createProjectId?{projectId:createProjectId}:{}),
      rawHypothesis: hypothesis.trim(),
      ...(customCopy?{pageCopy}:{}),
      ...(customSurvey?{surveyQuestions}:{}),
      ...(preferredSlug.trim() ? { preferredSlug: preferredSlug.trim() } : {}),
    });
    setGenerating(false);
    if (res.error || !res.data) {
      setGenerateError(res.error || 'The experiment could not be created.');
      return;
    }
    setCreatedUrl(res.data.pageUrl);
    setHypothesis('');
    setCustomCopy(false);setPageCopy({title:'',headline:'',subheadline:'',heroCtaText:'Request Early Access'});
    setCustomSurvey(false);setSurveyQuestions([]);
    setPreferredSlug('');
    await loadExperiments();
  }

  const scoreSequence=React.useRef(0);
  useEffect(()=>()=>{scoreSequence.current++;},[]);
  async function onViewScorecard(exp: WorkspaceExperimentRow) {
    const seq=++scoreSequence.current;setScorecard(null);setScorecardLoading(true);setGenerateError(null);
    try{const res=await fetchExperimentScorecard(exp.id);if(seq!==scoreSequence.current)return;if(!res.data||res.data.experimentId!==exp.id){setGenerateError(res.error||'The selected scorecard could not be loaded.');return;}setScorecard(res.data);}catch{if(seq===scoreSequence.current)setGenerateError('The selected scorecard could not be loaded.');}finally{if(seq===scoreSequence.current)setScorecardLoading(false);}
  }

  async function onEditCopy(exp:WorkspaceExperimentRow){
    setEditLoadingId(exp.id);setGenerateError(null);setCopySaved(false);
    try{const r=await fetchOwnerPage(exp.id);if(!r.data){setGenerateError(r.error||'Page copy could not be loaded.');return;}setEditor({experimentId:exp.id,page:r.data});}
    catch{setGenerateError('Page copy could not be loaded.');}finally{setEditLoadingId(null);}
  }

  async function onPreview(exp: WorkspaceExperimentRow) {
    const res = await fetchOwnerPage(exp.id);
    if (res.error || !res.data) {
      setGenerateError(res.error || 'The preview could not be loaded.');
      return;
    }
    setPreview(res.data);
  }

  async function onTogglePublish(exp:WorkspaceExperimentRow){
    setPublishingId(exp.id);setGenerateError(null);setPublicationError(null);
    try{if(exp.pageStatus!=='published'){const r=await fetchOwnerPage(exp.id);if(!r.data){setGenerateError(r.error||'Review copy unavailable. Nothing published.');return;}setPublication({experimentId:exp.id,page:r.data});return;}
      const r=await setExperimentPublish(exp.id,false);if(r.error){setGenerateError(r.error);return;}await loadExperiments();
    }catch{setGenerateError('Page state could not be confirmed. Reload before retrying.');}finally{setPublishingId(null);}
  }
  async function publishReviewed(){if(!publication||publishingId)return;setPublishingId(publication.experimentId);setPublicationError(null);try{const r=await setExperimentPublish(publication.experimentId,true,publication.page.revision);if(!r.data){setPublicationError(r.error||'Publication unconfirmed. Close and reload status before retrying.');return;}setPublication(null);await loadExperiments();}catch{setPublicationError('Publication unconfirmed. Close and reload status before retrying.');}finally{setPublishingId(null);}}

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Idea Validation & Smoke-Test Workbench
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Capture real buyer intent and validate B2B positioning before writing product code.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadExperiments}
            disabled={isLoading}
            className="text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-loom"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* New experiment: generates a real public smoke-test page with neutral,
          non-quantified copy derived from the hypothesis (no invented numbers). */}
      <Card className="p-5 sm:p-6 space-y-4 border border-border-subtle shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">New experiment</h2>
          <Plus className="w-4 h-4 text-text-muted" />
        </div>
        <form onSubmit={onGenerate} className="space-y-3" noValidate>
          <div>
            <label className="block text-xs font-mono text-text-muted mb-1.5">HYPOTHESIS</label>
            <textarea
              aria-label="Experiment hypothesis"
              rows={2}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="e.g. Automated Kubernetes cost-cutter for Series A startups"
              className="w-full rounded-md border border-border-muted bg-canvas-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-loom focus:outline-none focus:ring-1 focus:ring-brand-loom"
            />
          </div>
          <label className="block text-xs text-text-secondary">Project for this new experiment<select aria-label="New experiment project" disabled={generating} value={createProjectId} onChange={e=>setCreateProjectId(e.target.value)} className="block w-full mt-1 rounded border border-border-muted bg-canvas-elevated p-2 text-text-primary"><option value="">Unassigned workspace experiment</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p className="text-xs text-text-muted">Project ownership is fixed at creation. Existing workspace experiments stay unassigned. Project-bound observation requires its own read scope; context-only tokens are unchanged.</p>{projectError&&<p className="text-xs text-signal-failed">{projectError}</p>}
          <label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={customCopy} disabled={generating} onChange={e=>setCustomCopy(e.target.checked)} />Use my exact page copy instead of template copy</label>
          {customCopy&&<fieldset disabled={generating} className="space-y-3 border border-border-subtle rounded p-3"><legend className="text-xs text-text-primary px-1">Your unpublished page copy</legend><p className="text-xs text-text-muted">Stored as plain text, not HTML. Review all claims before publishing. ICP hints and suggested outreach remain heuristic templates. Survey questions use templates unless you supply your own below.</p>{([
            ['title','Page title',160],['headline','Page headline',300],['subheadline','Page description',1500],['heroCtaText','Button text',80],
          ] as const).map(([key,label,max])=><label key={key} className="block text-xs text-text-secondary">{label} ({max} characters maximum)<textarea aria-label={label} rows={key==='subheadline'?3:1} maxLength={max} value={pageCopy[key]} onChange={e=>setPageCopy(v=>({...v,[key]:e.target.value}))} className="block w-full mt-1 rounded border border-border-muted bg-canvas-elevated p-2 text-text-primary" /></label>)}</fieldset>}
          <label className="flex items-center gap-2 text-xs text-text-secondary"><input aria-label="Use my survey questions" type="checkbox" checked={customSurvey} disabled={generating} onChange={e=>setCustomSurvey(e.target.checked)} />Use my survey questions instead of template questions</label>
          {customSurvey&&<SurveyDraftEditor questions={surveyQuestions} onChange={setSurveyQuestions} disabled={generating}/>}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-mono text-text-muted mb-1.5">PAGE SLUG (OPTIONAL)</label>
              <input
                type="text"
                value={preferredSlug}
                onChange={(e) => setPreferredSlug(e.target.value)}
                placeholder="my-idea-slug"
                className="w-full rounded-md border border-border-muted bg-canvas-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-loom focus:outline-none focus:ring-1 focus:ring-brand-loom"
              />
            </div>
            {generateGate.kind === 'available' ? (
              <Button size="md" variant="primary" type="submit" disabled={generating || !hypothesis.trim()}>
                {generating ? 'Generating...' : 'Generate smoke-test page'}
              </Button>
            ) : (
              <GatedButton size="md" variant="primary" type="submit" gate={generateGate}>
                Generate smoke-test page
              </GatedButton>
            )}
          </div>
        </form>
        {generateError && <p className="text-sm text-signal-failed">{generateError}</p>}
        {createdUrl && (
          <p className="text-sm text-signal-verified">
            Page created as a draft. Review it below, then publish it before sharing - the public link only works once published.
          </p>
        )}
      </Card>

      {scorecardLoading && <p className="text-xs text-text-muted font-mono">Loading scorecard...</p>}
      {scorecard && <ExperimentScorecardPanel key={scorecard.experimentId} scorecard={scorecard} onClose={() => {scoreSequence.current++;setScorecard(null);}} />}

      {/* Workspace experiments (real, persisted) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Workspace Experiments</h2>
            <FlaskConical className="w-4 h-4 text-text-muted" />
          </div>
          {!isLoading && !error && (
            <span className="text-xs text-text-muted font-mono">
              {experiments.length} {experiments.length === 1 ? 'experiment' : 'experiments'}
            </span>
          )}
        </div>

        <label className="block text-xs text-text-secondary">Show experiments<select aria-label="Filter experiments by project" value={filterProjectId} onChange={e=>{scoreSequence.current++;setScorecardLoading(false);setFilterProjectId(e.target.value);setPreview(null);setEditor(null);setCopySaved(false);setScorecard(null);}} className="block w-full mt-1 rounded border border-border-muted bg-canvas-elevated p-2 text-text-primary"><option value="">All workspace experiments</option><option value="unassigned">Unassigned only</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="p-5 animate-pulse space-y-3">
                <div className="h-4 w-48 bg-canvas-elevated rounded" />
                <div className="h-4 w-32 bg-canvas-elevated rounded" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 border-signal-failed/30 bg-signal-failed/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-signal-failed">Failed to load workspace experiments</p>
              <p className="text-xs text-text-muted mt-0.5">{error}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadExperiments}
              className="text-xs focus-visible:ring-2 focus-visible:ring-brand-loom"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry</span>
            </Button>
          </Card>
        ) : experiments.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<FlaskConical className="w-6 h-6 text-text-muted" />}
              title="No experiments yet"
              description="Generate a smoke-test page above to start collecting waitlist signups."
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0 border border-border-subtle shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-canvas-surface/80 text-text-muted font-mono">
                    <th className="py-2.5 px-4 font-medium">Hypothesis</th>
                    <th className="py-2.5 px-4 font-medium">Verdict</th>
                    <th className="py-2.5 px-4 font-medium">Score</th>
                    <th className="py-2.5 px-4 font-medium">Page loads</th>
                    <th className="py-2.5 px-4 font-medium">Waitlist</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Public page</th>
                    <th className="py-2.5 px-4 font-medium text-right">Created date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-sans">
                  {experiments.map((exp) => (
                    <tr key={exp.id} className="hover:bg-canvas-elevated/40 transition-colors">
                      <td className="py-3 px-4 text-text-primary max-w-md font-medium">
                        <button type="button" onClick={() => onViewScorecard(exp)} className="text-left hover:text-brand-loom hover:underline">
                          {exp.hypothesis}
                        </button>
                        <p className="text-[10px] text-text-muted mt-1">Project: {exp.projectId?(projects.find(p=>p.id===exp.projectId)?.name??exp.projectId):'Unassigned'}</p>
                      </td>
                      <td className="py-3 px-4">
                        {renderVerdictBadge(exp.verdict)}
                      </td>
                      <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">
                        {exp.verdictScore != null ? (
                          <span className="px-2 py-0.5 rounded bg-canvas-elevated border border-border-subtle text-text-secondary font-mono">
                            {exp.verdictScore}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">{exp.visitors}</td>
                      <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">{exp.waitlistCount}</td>
                      <td className="py-3 px-4">
                        {exp.pageStatus === 'published' ? (
                          <Badge variant="verified" className="text-[10px] font-mono">Published</Badge>
                        ) : (
                          <Badge variant="subtle" className="text-[10px] font-mono">Draft</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onPreview(exp)}
                          className="text-[11px] font-mono text-text-secondary hover:text-text-primary underline mr-2"
                        >
                          Preview
                        </button>
                        {exp.pageStatus==='draft'&&<button type="button" disabled={editLoadingId===exp.id} onClick={()=>onEditCopy(exp)} className="text-[11px] font-mono text-brand-loom underline mr-2 disabled:opacity-50">{editLoadingId===exp.id?'Loading copy...':'Edit copy'}</button>}
                        {exp.pageStatus === 'published' && exp.slug ? (
                          <span className="inline-flex items-center gap-2">
                            <Link
                              href={`/v/${exp.slug}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-brand-loom hover:underline font-mono text-[11px]"
                            >
                              /v/{exp.slug}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => onTogglePublish(exp)}
                              disabled={publishingId === exp.id}
                              className="text-[11px] font-mono text-text-muted hover:text-text-primary underline disabled:opacity-50"
                            >
                              Unpublish
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onTogglePublish(exp)}
                            disabled={publishingId === exp.id}
                            className="text-[11px] font-mono text-brand-loom hover:underline disabled:opacity-50"
                          >
                            {publishingId === exp.id ? 'Publishing...' : 'Publish'}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-text-muted font-mono text-[11px]">
                        {new Date(exp.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked View (no horizontal scroll at 390px) */}
            <div className="sm:hidden divide-y divide-border-subtle">
              {experiments.map((exp) => (
                <div key={exp.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] uppercase font-mono text-text-muted shrink-0">Verdict</span>
                    {renderVerdictBadge(exp.verdict)}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-text-muted block mb-0.5">Hypothesis</span>
                    <p className="text-text-primary font-medium">{exp.hypothesis}</p>
                    <p className="text-[10px] text-text-muted">Project: {exp.projectId?(projects.find(p=>p.id===exp.projectId)?.name??exp.projectId):'Unassigned'}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Page loads / Waitlist</span>
                    <span className="font-mono text-[11px] text-text-secondary">{exp.visitors} / {exp.waitlistCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Status</span>
                    <span className="inline-flex items-center gap-2">
                      {exp.pageStatus === 'published' ? (
                        <Badge variant="verified" className="text-[10px] font-mono">Published</Badge>
                      ) : (
                        <Badge variant="subtle" className="text-[10px] font-mono">Draft</Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => onTogglePublish(exp)}
                        disabled={publishingId === exp.id}
                        className="text-[11px] font-mono text-brand-loom underline disabled:opacity-50"
                      >
                        {exp.pageStatus === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={()=>onPreview(exp)} className="text-[11px] font-mono text-text-secondary underline">Preview</button>
                    {exp.pageStatus==='draft'&&<button type="button" disabled={editLoadingId===exp.id} onClick={()=>onEditCopy(exp)} className="text-[11px] font-mono text-brand-loom underline disabled:opacity-50">Edit copy</button>}
                  </div>
                  {exp.pageStatus === 'published' && exp.slug && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono text-text-muted">Public page</span>
                      <Link href={`/v/${exp.slug}`} target="_blank" className="inline-flex items-center gap-1 text-brand-loom font-mono text-[11px]">
                        /v/{exp.slug}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-text-muted">Created date</span>
                    <span className="text-text-muted font-mono text-[11px]">
                      {new Date(exp.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      {copySaved&&<p role="status" className="text-xs text-signal-verified">Draft copy saved. Review the preview before publishing. Nothing was published.</p>}
      {editor&&<PageCopyEditor key={editor.experimentId} experimentId={editor.experimentId} page={editor.page} onClose={()=>setEditor(null)} onSaved={page=>{setEditor(null);setPreview(page);setCopySaved(true);loadExperiments();}}/>}
      {publication&&<PagePreviewModal page={publication.page} onClose={()=>{if(!publishingId)setPublication(null);}} onPublish={()=>void publishReviewed()} publishing={!!publishingId} error={publicationError}/>}
      {preview && <PagePreviewModal page={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
