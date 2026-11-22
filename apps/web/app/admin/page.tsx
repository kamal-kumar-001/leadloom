'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {PlatformOverviewSchema,type PlatformOverview} from '@leadloom/contracts';

export default function AdminPage(){
 const [snapshot,setSnapshot]=useState<PlatformOverview|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [search,setSearch]=useState(''),[applied,setApplied]=useState(''),[cursor,setCursor]=useState<string|null>(null),[previous,setPrevious]=useState<(string|null)[]>([]);
 const request=useRef(0),controller=useRef<AbortController|null>(null);
 const load=useCallback(async(q:string,next:string|null,history:(string|null)[])=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const generation=++request.current;
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;abort.abort();},10000);
  setLoading(true);setError('');setSnapshot(null);setApplied(q);setCursor(next);setPrevious(history);
  const params=new URLSearchParams();if(q)params.set('q',q);if(next)params.set('cursor',next);
  try{
   const response=await fetch('/api/engine/admin/overview'+(params.size?'?'+params.toString():''),{signal:abort.signal,cache:'no-store'});
   if(!response.ok)throw Error(response.status===401||response.status===403?'Operator access denied or expired. No snapshot displayed.':'Platform overview unavailable. No snapshot displayed.');
   const parsed=PlatformOverviewSchema.safeParse(await response.json());if(!parsed.success||parsed.data.search!==q)throw Error('Invalid platform snapshot. No data displayed.');
   if(generation!==request.current)return;setSnapshot(parsed.data);
  }catch(e){if(generation!==request.current||(abort.signal.aborted&&!timedOut))return;setSnapshot(null);setError(timedOut?'Platform overview timed out. No snapshot displayed.':e instanceof Error?e.message:'Platform overview unavailable.');}
  finally{clearTimeout(timer);if(generation===request.current)setLoading(false);}
 },[]);
 useEffect(()=>{void load('',null,[]);return()=>{request.current++;controller.current?.abort();};},[load]);
 const stat=[['Stored workspaces',snapshot?.counts.workspaces],['Active access flags',snapshot?.counts.activeWorkspaces],['User records',snapshot?.counts.users],['Project records',snapshot?.counts.projects],['Campaign records',snapshot?.counts.campaigns],['Outbound job records',snapshot?.counts.outboundJobs]] as const;
 return <div className="space-y-6" data-testid="platform-overview">
  <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-bold text-text-primary">Platform overview</h1><p className="text-sm text-text-secondary mt-1">Current database metadata. Read-only, no demo telemetry or automatic action.</p></div><button type="button" onClick={()=>void load(applied,null,[])} disabled={loading} className="px-3 py-2 rounded border border-border-subtle text-xs text-text-primary disabled:opacity-50">Refresh first page</button></header>
  <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void load(search.trim(),null,[]);}}><label className="text-xs text-text-secondary flex-1 min-w-64">Workspace name<input aria-label="Search platform workspaces" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)} className="block mt-1 w-full rounded border border-border-subtle bg-canvas-surface p-2 text-sm text-text-primary"/></label><button disabled={loading} className="px-4 py-2 rounded bg-brand-loom text-canvas text-sm disabled:opacity-50">Search workspaces</button></form>
  <p className="text-xs text-text-muted">Applied name search: {applied||'all workspaces'}. Totals always cover the full database, not only this search. Each page contains up to 25 workspaces.</p>
  {loading&&<p role="status" className="text-sm text-text-secondary">Loading current platform metadata...</p>}
  {error&&<p role="alert" className="rounded border border-signal-failed/40 p-3 text-sm text-signal-failed">{error}</p>}
  {snapshot&&<>
   <p className="text-xs text-text-muted" data-testid="platform-asof">Snapshot {snapshot.asOf}. Refresh after other changes. Not a readiness, billing or delivery verdict.</p>
   <section className="grid grid-cols-2 lg:grid-cols-3 gap-3" aria-label="Current platform record counts">{stat.map(([label,value])=><div key={label} className="rounded-xl border border-border-subtle bg-canvas-surface p-4"><p className="text-xs text-text-secondary">{label}</p><p className="text-2xl text-text-primary font-semibold mt-1">{value}</p></div>)}</section>
   <section className="rounded-xl border border-border-subtle bg-canvas-surface overflow-hidden"><h2 className="p-4 text-sm font-semibold text-text-primary border-b border-border-subtle">Workspace records, page {previous.length+1}</h2><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-xs" aria-label="Current platform workspace page"><thead className="bg-canvas-elevated text-text-secondary"><tr>{['Workspace','Access flag','Stored plan key','Members','Projects','Campaigns','Created'].map(t=><th className="p-3 font-medium" key={t}>{t}</th>)}</tr></thead><tbody>{snapshot.workspaces.map(w=><tr key={w.id} className="border-t border-border-subtle"><td className="p-3 text-text-primary"><div className="font-medium">{w.name}</div><code className="block text-[10px] text-text-muted mt-1">{w.id}</code></td><td className="p-3 text-text-secondary">{w.active?'Active':'Inactive'}</td><td className="p-3 text-text-secondary">{w.storedPlan}</td><td className="p-3 text-text-secondary">{w.members}</td><td className="p-3 text-text-secondary">{w.projects}</td><td className="p-3 text-text-secondary">{w.campaigns}</td><td className="p-3 text-text-muted whitespace-nowrap">{w.createdAt.slice(0,10)}</td></tr>)}</tbody></table></div>{snapshot.workspaces.length===0&&<p className="p-4 text-sm text-text-secondary">No matching workspace records in this page snapshot.</p>}</section>
   <div className="flex gap-3"><button type="button" disabled={loading||previous.length===0} onClick={()=>{const history=previous.slice(0,-1);void load(applied,previous.at(-1)??null,history);}} className="px-3 py-2 rounded border border-border-subtle text-xs text-text-primary disabled:opacity-40">Previous workspaces</button><button type="button" disabled={loading||!snapshot.nextCursor} onClick={()=>void load(applied,snapshot.nextCursor,[...previous,cursor])} className="px-3 py-2 rounded border border-border-subtle text-xs text-text-primary disabled:opacity-40">Next workspaces</button></div>
   <details className="rounded border border-border-subtle p-4 text-xs text-text-secondary"><summary className="cursor-pointer font-medium text-text-primary">Source limits and unsupported controls</summary><ul className="mt-3 space-y-2 list-disc pl-4">{snapshot.limits.map(t=><li key={t}>{t}</li>)}<li>Tenant changes, subscription billing, a global audit-event view and key operations are not provided by this page.</li></ul></details>
  </>}
 </div>;
}
