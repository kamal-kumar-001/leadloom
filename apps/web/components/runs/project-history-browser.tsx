'use client';
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Button,Card} from '@leadloom/ui';
import type {ProjectResponse} from '@leadloom/contracts';
import {engineFetch} from '../../lib/engine-client';
import {checkedHistoryProjects,checkedHistoryPage,checkedHistoryDetail,appendHistoryPage,type HistorySummary,type HistoryDetail} from '../../lib/work-activity';
const kinds=['decision','progress','blocker','next_step','research','note'];
export function ProjectHistoryBrowser(){
 const [projects,setProjects]=useState<ProjectResponse[]>([]),[projectId,setProjectId]=useState(''),[projectsBusy,setProjectsBusy]=useState(true),[projectError,setProjectError]=useState(''),[version,setVersion]=useState(0);
 const [items,setItems]=useState<HistorySummary[]>([]),[cursor,setCursor]=useState<string|null>(null),[detail,setDetail]=useState<HistoryDetail|null>(null),[state,setState]=useState<'idle'|'loading'|'ok'|'error'>('idle'),[error,setError]=useState(''),[detailBusy,setDetailBusy]=useState(false);
 const [query,setQuery]=useState(''),[applied,setApplied]=useState(''),[kind,setKind]=useState('');
 const projectSeq=useRef(0),historySeq=useRef(0),detailSeq=useRef(0);
 const selected=projects.find(p=>p.id===projectId);
 const reset=(next:'idle'|'loading'='idle')=>{historySeq.current++;detailSeq.current++;setItems([]);setCursor(null);setDetail(null);setDetailBusy(false);setError('');setState(next);};
 const loadProjects=async()=>{
  const ticket=++projectSeq.current;reset(projectId?'loading':'idle');setProjectsBusy(true);setProjectError('');
  try{const res=await engineFetch<unknown>('/projects',{signal:AbortSignal.timeout(15000)});if(ticket!==projectSeq.current)return;const parsed=res.error?null:checkedHistoryProjects(res.data);if(!parsed)throw Error('unavailable');setProjects(parsed);if(projectId&&!parsed.some(p=>p.id===projectId))setProjectId('');setVersion(v=>v+1);}
  catch{if(ticket===projectSeq.current){setProjects([]);setProjectId('');reset();setProjectError('Project list unavailable. Retry before choosing a project.');}}
  finally{if(ticket===projectSeq.current)setProjectsBusy(false);}
 };
 const loadHistory=async(next?:string)=>{
  if(!projectId||!selected)return;const ticket=++historySeq.current;detailSeq.current++;setDetail(null);setDetailBusy(false);setState('loading');setError('');if(!next){setItems([]);setCursor(null);}const params=new URLSearchParams({limit:'10'});if(applied)params.set('q',applied);if(kind)params.set('kind',kind);if(next)params.set('cursor',next);
  try{const res=await engineFetch<unknown>('/projects/'+encodeURIComponent(projectId)+'/entries?'+params,{signal:AbortSignal.timeout(15000)});if(ticket!==historySeq.current)return;const page=res.error?null:checkedHistoryPage(res.data,projectId);if(!page)throw Error('unavailable');const merged=next?appendHistoryPage(items,page.items):page.items;if(!merged)throw Error('overlapping pages');setItems(merged);setCursor(page.nextCursor);setState('ok');}
  catch{if(ticket===historySeq.current){detailSeq.current++;setDetailBusy(false);setItems([]);setCursor(null);setDetail(null);setState('error');setError('Saved project history unavailable. Retry to check records; no empty history was confirmed.');}}
 };
 const openDetail=async(id:string)=>{
  const ticket=++detailSeq.current;setDetail(null);setDetailBusy(true);setError('');
  try{const res=await engineFetch<unknown>('/projects/'+encodeURIComponent(projectId)+'/entries/'+encodeURIComponent(id),{signal:AbortSignal.timeout(15000)});if(ticket!==detailSeq.current)return;const value=res.error?null:checkedHistoryDetail(res.data,projectId,id);if(!value)throw Error('unavailable');setDetail(value);}
  catch{if(ticket===detailSeq.current)setError('Selected entry detail unavailable. No previous detail is being shown.');}
  finally{if(ticket===detailSeq.current)setDetailBusy(false);}
 };
 useEffect(()=>{void loadProjects();return()=>{projectSeq.current++;historySeq.current++;detailSeq.current++;};},[]);
 useEffect(()=>{if(projectId&&selected)void loadHistory();else reset();return()=>{historySeq.current++;detailSeq.current++;};},[projectId,version,applied,kind]);
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="project-history-browser">
  <div><h1 className="text-xl font-semibold text-text-primary">Project work history</h1><p className="text-sm text-text-secondary mt-2">Read entries explicitly saved to one selected project's work record, including decisions, progress, research notes and next steps. These are authored records, not automatic execution receipts, proof that a blocker is unresolved, or permission to act.</p></div>
  <Card className="p-4 space-y-3"><div className="flex flex-wrap gap-2 items-center"><label className="text-xs text-text-secondary" htmlFor="history-project">Project</label><select id="history-project" aria-label="History project" value={projectId} disabled={projectsBusy} onChange={e=>{reset(e.target.value?'loading':'idle');setProjectId(e.target.value);}} className="min-w-0 max-w-full rounded-lg bg-canvas-elevated border border-border-subtle p-2 text-sm text-text-primary"><option value="">Select a project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name} ({p.slug})</option>)}</select><Button size="sm" variant="outline" disabled={projectsBusy} onClick={()=>void loadProjects()}>Refresh projects</Button><Link href="/app/projects" className="text-xs text-brand-loom">Open Projects to save records</Link></div>{projectsBusy&&<p className="text-xs text-text-muted">Loading project choices...</p>}{projectError&&<p role="alert" className="text-xs text-signal-failed">{projectError}</p>}{!projectsBusy&&!projectError&&projects.length===0&&<p className="text-xs text-text-secondary">No project records were returned for this workspace. Create a project in Projects.</p>}</Card>
  {selected?<Card className="p-4 space-y-4"><div><h2 className="text-sm font-semibold text-text-primary">Saved history for {selected.name}</h2><p className="text-[11px] font-mono text-text-muted break-all">{selected.id}</p></div>
   <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();reset('loading');if(query.trim()===applied)void loadHistory();else setApplied(query.trim());}}><input aria-label="Search saved history" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="Search short excerpts" className="min-w-0 flex-1 rounded-lg bg-canvas-elevated border border-border-subtle p-2 text-xs text-text-primary"/><select aria-label="History kind" value={kind} onChange={e=>{reset('loading');setKind(e.target.value);}} className="rounded-lg bg-canvas-elevated border border-border-subtle p-2 text-xs text-text-primary"><option value="">All kinds</option>{kinds.map(k=><option key={k} value={k}>{k.replace('_',' ')}</option>)}</select><Button size="sm" type="submit" variant="outline" disabled={state==='loading'||projectsBusy}>Search history</Button><Button size="sm" type="button" variant="outline" disabled={state==='loading'||projectsBusy} onClick={()=>void loadHistory()}>Refresh history</Button></form>
   {error&&<p role="alert" className="text-xs text-signal-failed">{error}</p>}{state==='loading'&&<p role="status" className="text-xs text-text-muted">Loading saved history...</p>}{state==='ok'&&items.length===0&&<p className="text-xs text-text-secondary">No saved entries match this project and search.</p>}
   {items.length>0&&<ul className="space-y-2" aria-label="Saved project history">{items.map(item=><li key={item.id} className="rounded-lg border border-border-subtle p-3"><button className="w-full text-left" type="button" onClick={()=>void openDetail(item.id)}><p className="text-[11px] text-text-muted">{item.kind.replace('_',' ')} · {new Date(item.createdAt).toLocaleString()}</p><h3 className="text-sm font-medium text-text-primary break-words">{item.title}</h3><p className="text-xs text-text-secondary whitespace-pre-wrap break-words mt-1">{item.excerpt}</p></button></li>)}</ul>}
   {cursor&&<Button size="sm" variant="outline" disabled={state==='loading'||projectsBusy} onClick={()=>void loadHistory(cursor)}>Load older history</Button>}
   {detailBusy&&<p className="text-xs text-text-muted">Loading selected detail...</p>}{detail&&<section aria-label="History entry detail" className="rounded-lg border border-brand-loom/30 p-4 space-y-2"><div className="flex justify-between gap-3"><h3 className="text-sm font-medium text-text-primary break-words">{detail.title}</h3><button className="text-xs text-text-muted" onClick={()=>{detailSeq.current++;setDetail(null);setDetailBusy(false);}}>Close detail</button></div><p className="text-xs text-text-secondary whitespace-pre-wrap break-words">{detail.body}</p></section>}
  </Card>:!projectsBusy&&!projectError&&projects.length>0?<p className="text-sm text-text-secondary">Choose a project to read its saved history. No project is selected automatically.</p>:null}
  <p className="text-xs text-text-muted">Ten short records per page; open detail only when needed. Draft assets, research tables and campaign jobs have separate views and are not included here. Add corrections as new entries in Projects. Legacy local pipeline files are separate and are not migrated or deleted by this view.</p>
 </div>;
}
