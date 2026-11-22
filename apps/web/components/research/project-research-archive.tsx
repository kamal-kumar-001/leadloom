'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Button,Card} from '@leadloom/ui';
import type {ProjectResearchKind,ProjectResearchPage,ProjectResearchSummary,ProjectResearchDetail} from '@leadloom/contracts';
import {engineFetch} from '../../lib/engine-client';
export function ProjectResearchArchive({projectId,revision=0}:{projectId:string;revision?:number}){
 const [kind,setKind]=useState<ProjectResearchKind>('website'),[query,setQuery]=useState(''),[applied,setApplied]=useState('');
 const [items,setItems]=useState<ProjectResearchSummary[]>([]),[cursor,setCursor]=useState<string|null>(null),[detail,setDetail]=useState<ProjectResearchDetail|null>(null);
 const [loading,setLoading]=useState(false),[opening,setOpening]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0),detailSequence=useRef(0);
 const identity=projectId+'|'+kind+'|'+applied;
 const [loadedIdentity,setLoadedIdentity]=useState('');
 const visibleItems=loadedIdentity===identity?items:[],visibleCursor=loadedIdentity===identity?cursor:null;
 const visibleDetail=loadedIdentity===identity&&detail?.projectId===projectId&&detail.kind===kind?detail:null;
 const load=async(next?:string)=>{
  const seq=++sequence.current;detailSequence.current++;setOpening(false);setDetail(null);setError('');setLoading(true);
  if(!next){setItems([]);setCursor(null);}
  const params=new URLSearchParams({projectId,kind,q:applied,limit:'10'});if(next)params.set('cursor',next);
  try{const response=await engineFetch<ProjectResearchPage>('/research/records?'+params,{cache:'no-store'});if(seq!==sequence.current)return;
   if(!response.data){setItems([]);setCursor(null);setError(response.error||'Saved project research is unavailable');return;}
   if(response.data.items.some(item=>item.projectId!==projectId||item.kind!==kind)){setItems([]);setCursor(null);setError('Research response did not match this project and kind');return;}
   setItems(old=>next?[...old,...response.data!.items.filter(item=>!old.some(existing=>existing.rowId===item.rowId))]:response.data!.items);setCursor(response.data.nextCursor);setLoadedIdentity(identity);
  }catch{if(seq===sequence.current){setItems([]);setCursor(null);setError('Saved project research is unavailable');}}
  finally{if(seq===sequence.current)setLoading(false);}
 };
 useEffect(()=>{void load();return()=>{sequence.current++;detailSequence.current++;};},[projectId,kind,applied,revision]);
 const open=async(rowId:string)=>{
  const seq=++detailSequence.current;setDetail(null);setOpening(true);setError('');
  try{const response=await engineFetch<ProjectResearchDetail>('/research/records/'+rowId+'?'+new URLSearchParams({projectId,kind}),{cache:'no-store'});if(seq!==detailSequence.current)return;
   if(!response.data||response.data.projectId!==projectId||response.data.kind!==kind||response.data.rowId!==rowId){setError(response.error||'Saved row unavailable for this project and kind');return;}setDetail(response.data);
  }catch{if(seq===detailSequence.current)setError('Saved research detail unavailable');}finally{if(seq===detailSequence.current)setOpening(false);}
 };
 return <Card className="p-4 space-y-4" data-testid="project-research-archive">
  <div><h2 className="text-base font-semibold">Saved project research archive</h2><p className="text-xs text-text-secondary mt-1">Search all explicitly assigned saved rows, including older research. Read short excerpts first, then open one row. Current editable cells, not source snapshots, verified demand or live feeds.</p></div>
  <form onSubmit={e=>{e.preventDefault();setApplied(query.trim());}} className="flex flex-wrap gap-2">
   <select aria-label="Archived research kind" value={kind} onChange={e=>setKind(e.target.value as ProjectResearchKind)} className="rounded-md border border-border-subtle bg-canvas-elevated p-2 text-xs"><option value="website">Website keyword observations</option><option value="intent-fixture">Hiring-board fixtures, not live events</option></select>
   <input aria-label="Search saved project research" value={query} onChange={e=>setQuery(e.target.value)} maxLength={200} placeholder="Search saved research fields" className="min-w-0 flex-1 rounded-md border border-border-subtle bg-canvas-elevated p-2 text-xs"/>
   <Button type="submit" size="sm" variant="outline" disabled={loading}>Search archive</Button><Button type="button" size="sm" variant="outline" disabled={loading} onClick={()=>void load()}>Reload archive</Button>
  </form>
  {error&&<p role="alert" className="text-xs text-signal-failed">{error}</p>}
  {loading&&<p className="text-xs text-text-secondary">Reading saved research...</p>}
  {!loading&&!error&&!visibleItems.length&&<p className="text-xs text-text-secondary">No saved rows match this project, kind and search.</p>}
  <ul className="space-y-2">{visibleItems.map(item=><li key={item.rowId}><button type="button" disabled={loading} onClick={()=>void open(item.rowId)} className="w-full text-left rounded-md border border-border-subtle p-3 space-y-1"><h3 className="text-sm font-semibold break-words">{item.title}</h3><p className="text-[11px] text-text-muted">{item.kind==='intent-fixture'?'Fixture claim, not a live observation':'Saved keyword observation'} · saved {new Date(item.savedAt).toLocaleString()}</p><p className="text-xs text-text-secondary whitespace-pre-wrap break-words">{item.excerpt}</p><p className="text-[11px] text-text-muted break-words">Stored source label: {item.source||'not recorded'}</p></button></li>)}</ul>
  {visibleCursor&&<Button type="button" variant="outline" size="sm" disabled={loading} onClick={()=>void load(visibleCursor)}>Load older research</Button>}
  {opening&&<p className="text-xs text-text-secondary">Opening saved research detail...</p>}
  {visibleDetail&&<section aria-label="Saved project research detail" className="rounded-lg border border-brand-loom/30 p-4 space-y-3"><div className="flex justify-between gap-2"><h3 className="text-sm font-semibold break-words">{visibleDetail.title}</h3><button type="button" className="text-xs text-text-muted" onClick={()=>{detailSequence.current++;setDetail(null);setOpening(false);}}>Close saved row</button></div><p className="text-xs text-text-secondary">{visibleDetail.note}</p><dl className="space-y-3">{Object.entries(visibleDetail.values).map(([name,value])=><div key={name}><dt className="text-xs font-semibold break-words">{name}</dt><dd className="text-xs text-text-secondary whitespace-pre-wrap [overflow-wrap:anywhere]">{typeof value==='string'?value:JSON.stringify(value)}</dd></div>)}</dl></section>}
  <p className="text-[11px] text-text-muted">Only the original computed-schema fields are read. Extra custom columns are excluded. Search/pagination is live, not a frozen export. A saved result is never consent, budget approval, contact or a scheduling instruction.</p>
 </Card>;
}
