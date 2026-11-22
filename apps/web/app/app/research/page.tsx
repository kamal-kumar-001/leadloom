'use client';
import {ProjectResearchArchive} from '../../../components/research/project-research-archive';

import React, { useState } from 'react';
import { Badge, Button, Card } from '@leadloom/ui';
import { Globe, Search, AlertTriangle, Save, Check } from 'lucide-react';
import Link from 'next/link';
import {
  fetchWorkspaceProjects,
  analyzeWebsiteSignals,
  saveWebsiteAnalysis,
  fetchResearchLeads,
  type WebsiteSignalsResult,
  type SavedResearchRow,
} from '../../../lib/engine-client';
import {canSaveResearchSnapshot} from '../../../lib/research-snapshot';
import { IntentFixturePanel } from '../../../components/research/intent-fixture-panel';

export default function ResearchPage(){
 const [projectId,setProjectId]=useState(''),[projects,setProjects]=useState<import('@leadloom/contracts').ProjectResponse[]>([]),[error,setError]=useState('');
 React.useEffect(()=>{let active=true;fetchWorkspaceProjects().then(r=>{if(!active)return;if(r.error)setError(r.error);else setProjects(r.projects);});return()=>{active=false;};},[]);
 return <><div className="px-6 pt-6 max-w-5xl mx-auto space-y-2"><label className="text-sm" htmlFor="research-project">Research project for new saves and saved-list retrieval</label><select id="research-project" aria-label="Research project" value={projectId} onChange={e=>setProjectId(e.target.value)} className="w-full bg-canvas-elevated border border-border-subtle rounded-lg p-2 text-sm"><option value="">Workspace: new saves unassigned, show all saved research</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="text-xs text-text-secondary">Project selection is explicit, fixed when saving a new row. Workspace members/tools and Tables retain workspace access. Switching discards the current unsaved analysis and request ID; inspect saved results before retrying after a switch. Historical rows are not assigned by name.</p>{error&&<p role="alert" className="text-xs text-signal-failed">Projects unavailable. Workspace saves remain unassigned. {error}</p>}</div><ResearchContent key={projectId||'workspace'} projectId={projectId||undefined}/></>;
}
function ResearchContent({projectId}:{projectId?:string}) {
  const [url, setUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [pageText, setPageText] = useState('');
  const [result, setResult] = useState<WebsiteSignalsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedRows, setSavedRows] = useState<SavedResearchRow[]>([]);
  const [requestId,setRequestId]=useState<string|null>(null);
  const [lastPageText, setLastPageText] = useState('');
  const [archiveRevision,setArchiveRevision]=useState(0);

  React.useEffect(() => {
    if(projectId)return;
    fetchResearchLeads(projectId).then((res) => {
      if(res.error)setError(res.error);
      if (res.data?.items) setSavedRows(res.data.items);
    });
  }, []);

  async function save(domain: string, pageText: string) {
    if(!requestId){setError('Analyze the pasted text before saving.');return;}
    setError(null);
    setBusy(true);
    const res = await saveWebsiteAnalysis({ domain, pageText,requestId,...(projectId?{projectId}:{}) });
    setBusy(false);
    if (res.error||!res.data?.rowId||res.data.status!=='SAVED') {
      setError((res.error||'Research save was not confirmed.')+' Reload saved analyses before retrying an unconfirmed save.');
      return;
    }
    setSaved(res.data?.rowId ?? null);
    if(projectId){setArchiveRevision(n=>n+1);return;}
    const list = await fetchResearchLeads(projectId);
    if(list.error)setError('Save succeeded, but saved-list reload failed. '+list.error);
    if (list.data?.items) setSavedRows(list.data.items);
  }

  async function analyze(mode: 'url' | 'text') {
    setBusy(true);
    setError(null);
    setResult(null);
    setSaved(null);
    setRequestId(null);
    setLastPageText(mode==='text'?pageText:'');
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
    if(res.data?.input==='pasted_text')setRequestId(crypto.randomUUID());
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 font-sans">
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

          {result.input!=='pasted_text'&&<p className="text-xs text-text-secondary">Fetched output has no saved source-text snapshot. Paste the exact source text to save a reproducible analysis; earlier pasted text is never reused.</p>}
          <p className="text-xs text-text-secondary">One analysis keeps the same save request ID for safe retries in this page session. Analyze again to deliberately append another row. Reload saved analyses after an uncertain response. Reloading or leaving this page loses that ID, so inspect the saved list before starting again. New saved rows use the selected project, or remain unassigned in Workspace mode. Workspace access stays broad.</p>
          <div className="border-t border-[var(--border)] pt-3 flex items-center gap-3">
            {saved ? (
              <Badge variant="verified" className="text-[10px] font-mono">
                <Check className="h-3 w-3 mr-1" /> Saved to lead table
              </Badge>
            ) : (
              <Button disabled={busy||!requestId||!canSaveResearchSnapshot(result.input,lastPageText)} onClick={() => save(result.signals.companyDomain, lastPageText)}>
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

      {projectId&&<ProjectResearchArchive key={projectId} projectId={projectId} revision={archiveRevision}/>}
      {!projectId&&<Button variant="outline" disabled={busy} onClick={async()=>{setError(null);const r=await fetchResearchLeads(projectId);if(r.error)setError(r.error);else if(r.data)setSavedRows(r.data.items);}}>Reload saved research</Button>}
      {!projectId&&savedRows.length > 0 && (
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
        <IntentFixturePanel projectId={projectId} />
      </div>
    </div>
  );
}
