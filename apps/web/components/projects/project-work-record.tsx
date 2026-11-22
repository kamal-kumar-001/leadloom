'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Button,Card} from '@leadloom/ui';
import type {ProjectResponse,ProjectEntrySummary,ProjectEntryDetail,ProjectEntryPage,ProjectEntryKind} from '@leadloom/contracts';
import {engineFetch} from '../../lib/engine-client';
import {WorkbenchReadEpoch,boundedWorkbenchOperation,checkedEntrySave} from '../../lib/workbench-reads';
import {checkedHistoryPage,checkedHistoryDetail,appendHistoryPage} from '../../lib/work-activity';
const kinds:ProjectEntryKind[]=['decision','progress','blocker','next_step','research','note'];
const label=(s:string)=>s.replace('_',' ');
export function ProjectWorkRecord({project}:{project:ProjectResponse}){return <ProjectWorkRecordEditor key={project.id} project={project}/>;}
function ProjectWorkRecordEditor({project}:{project:ProjectResponse}){
 const [items,setItems]=useState<ProjectEntrySummary[]>([]),[cursor,setCursor]=useState<string|null>(null),[query,setQuery]=useState(''),[applied,setApplied]=useState(''),[filter,setFilter]=useState('');
 const [kind,setKind]=useState<ProjectEntryKind>('progress'),[title,setTitle]=useState(''),[body,setBody]=useState(''),[open,setOpen]=useState<ProjectEntryDetail|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const requestId=useRef<string|null>(null),reads=useRef(new WorkbenchReadEpoch()),detailSequence=useRef(0);const base='/projects/'+encodeURIComponent(project.id)+'/entries';
 const load=async(next?:string)=>{
  if(!reads.current.isMounted())return;
  const ticket=reads.current.begin();setLoading(true);setError('');if(!next){detailSequence.current++;setOpen(null);setItems([]);setCursor(null);}const params=new URLSearchParams({limit:'10'});if(ticket.query)params.set('q',ticket.query);if(ticket.kind)params.set('kind',ticket.kind);if(next)params.set('cursor',next);
  try{const res=await boundedWorkbenchOperation(engineFetch<unknown>(base+'?'+params));if(!reads.current.accepts(ticket))return;
   const page=checkedHistoryPage(res.data,project.id),merged=page?(next?appendHistoryPage(items,page.items):page.items):null;
   if(!page||!merged){detailSequence.current++;setOpen(null);setItems([]);setCursor(null);setError(res.error||'Exact project history unavailable or changed while paging. Reload this search.');return;}
   setItems(merged);setCursor(page.nextCursor);
  }catch{if(reads.current.accepts(ticket)){detailSequence.current++;setOpen(null);setItems([]);setCursor(null);setError('Project history unavailable');}}finally{if(reads.current.accepts(ticket))setLoading(false);}
 };
 useEffect(()=>{reads.current.mount();setItems([]);setCursor(null);setOpen(null);void load();return()=>{reads.current.unmount();detailSequence.current++;};},[project.id]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');requestId.current??=crypto.randomUUID();const submitted={kind,title,body};
  try{const res=await boundedWorkbenchOperation(engineFetch<unknown>(base,{method:'POST',body:JSON.stringify({requestId:requestId.current,...submitted})}));if(!reads.current.isMounted())return;
   if(!checkedEntrySave(res.data,project.id,submitted)){setError((res.error||'Save acknowledgement unavailable or mismatched.')+' Save is unconfirmed. Keep these words and retry unchanged with the same request; inspect history before starting a different save.');return;}
   requestId.current=null;setTitle('');setBody('');setNotice('Saved to this project. History is append-only; add a correction as a new entry.');await load();
  }catch{if(reads.current.isMounted())setError('Save unconfirmed. Keep these words and retry unchanged with the same request.');}finally{if(reads.current.isMounted())setBusy(false);}
 };
 const expand=async(id:string)=>{const seq=++detailSequence.current;setOpen(null);setError('');try{const res=await boundedWorkbenchOperation(engineFetch<unknown>(base+'/'+encodeURIComponent(id)));if(!reads.current.isMounted()||seq!==detailSequence.current)return;const detail=checkedHistoryDetail(res.data,project.id,id);if(detail)setOpen(detail);else setError(res.error||'Exact entry unavailable');}catch{if(reads.current.isMounted()&&seq===detailSequence.current)setError('Entry unavailable');}};
 return <Card className="p-5 sm:p-6 space-y-4" data-testid="project-work-record">
  <div><h2 className="text-base font-semibold text-text-primary">Project work record</h2><p className="text-xs text-text-secondary mt-1">{project.name}: save decisions, progress and next steps. Search returns short excerpts; open only the detail you need. No AI or posting runs from this record.</p></div>
  <form onSubmit={save} className="space-y-2 border-t border-border-subtle pt-4">
   <div className="flex gap-2"><select aria-label="Entry kind" value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as ProjectEntryKind);requestId.current=null;setNotice('');}} className="bg-canvas-elevated border border-border-subtle rounded-lg p-2 text-xs text-text-primary">{kinds.map(k=><option key={k} value={k}>{label(k)}</option>)}</select><input aria-label="Entry title" placeholder="What changed or was decided?" value={title} maxLength={160} required disabled={busy} onChange={e=>{setTitle(e.target.value);requestId.current=null;setNotice('');}} className="min-w-0 flex-1 bg-canvas-elevated border border-border-subtle rounded-lg p-2 text-xs text-text-primary"/></div>
   <textarea aria-label="Entry detail" placeholder="Record the result, reason, evidence or next step. Do not put passwords or API keys here." value={body} required maxLength={6000} rows={4} disabled={busy} onChange={e=>{setBody(e.target.value);requestId.current=null;setNotice('');}} className="w-full bg-canvas-elevated border border-border-subtle rounded-lg p-2 text-xs text-text-primary"/>
   <div className="flex items-center justify-between"><span className="text-[11px] text-text-muted">{body.length}/6000 characters. New entries do not replace earlier history.</span><Button type="submit" size="sm" disabled={busy||!title.trim()||!body.trim()}>{busy?'Saving...':'Save entry'}</Button></div>
  </form>
  {error&&<p role="alert" className="text-xs text-signal-failed">{error}</p>}{notice&&<p role="status" className="text-xs text-signal-verified">{notice}</p>}
  <form onSubmit={e=>{e.preventDefault();const search=query.trim();reads.current.setScope({query:search});setApplied(search);void load();}} className="flex flex-wrap gap-2 border-t border-border-subtle pt-4"><input aria-label="Search project history" placeholder="Search this project" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 bg-canvas-elevated border border-border-subtle rounded-lg p-2 text-xs text-text-primary"/><select aria-label="Filter entry kind" value={filter} onChange={e=>{reads.current.setScope({kind:e.target.value});setFilter(e.target.value);void load();}} className="bg-canvas-elevated border border-border-subtle rounded-lg p-2 text-xs text-text-primary"><option value="">All kinds</option>{kinds.map(k=><option key={k} value={k}>{label(k)}</option>)}</select><Button type="submit" variant="outline" size="sm" disabled={loading}>Search</Button><Button type="button" variant="outline" size="sm" disabled={loading} onClick={()=>void load()}>Reload</Button></form>
  <p aria-label="Applied history filter" className="text-xs text-text-muted">Saved history search: {applied||'all words'}; kind: {filter?label(filter):'all kinds'}. Loaded pages are not a frozen snapshot.</p>
  {loading&&items.length===0?<p className="text-xs text-text-muted">Loading project history...</p>:items.length===0?(error?<p className="text-xs text-text-muted">Project history could not be loaded. Retry to check saved records.</p>:<p className="text-xs text-text-muted">No entries match this project and search.</p>):<ul className="space-y-2">{items.map(item=><li key={item.id} className="rounded-lg border border-border-subtle p-3"><button type="button" onClick={()=>void expand(item.id)} className="text-left w-full"><span className="text-[11px] text-text-muted capitalize">{label(item.kind)} · {new Date(item.createdAt).toLocaleString()}</span><h3 className="text-sm text-text-primary font-medium break-words">{item.title}</h3><p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap break-words">{item.excerpt}</p></button></li>)}</ul>}
  {cursor&&<Button variant="outline" size="sm" disabled={loading} onClick={()=>void load(cursor)}>Load older entries</Button>}
  {open&&<section aria-label="Selected entry detail" className="border border-brand-loom/30 rounded-lg p-4 space-y-2"><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold text-text-primary break-words">{open.title}</h3><button type="button" onClick={()=>{detailSequence.current++;setOpen(null);}} className="text-xs text-text-muted">Close detail</button></div><p className="text-xs text-text-secondary whitespace-pre-wrap break-words">{open.body}</p></section>}
 </Card>;
}
