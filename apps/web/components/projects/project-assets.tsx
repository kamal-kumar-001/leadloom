'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Button,Card} from '@leadloom/ui';
import type {ProjectResponse,ProjectAssetDetail,ProjectAssetSummary,ProjectAssetPage} from '@leadloom/contracts';
import {engineFetch} from '../../lib/engine-client';
import {WorkbenchReadEpoch,boundedWorkbenchOperation,checkedAssetPage,checkedAssetDetail,checkedAssetSave,appendAssetPage} from '../../lib/workbench-reads';
const kinds=['product_brief','research','launch_copy','outreach_draft','investor_pitch'] as const;
const inputClass='w-full bg-canvas-elevated border border-border-subtle rounded-lg p-2 text-xs text-text-primary';
export function ProjectAssets({project}:{project:ProjectResponse}){return <ProjectAssetsEditor key={project.id} project={project}/>;}
function ProjectAssetsEditor({project}:{project:ProjectResponse}){
 const base='/projects/'+encodeURIComponent(project.id)+'/assets';
 const [items,setItems]=useState<ProjectAssetSummary[]>([]),[query,setQuery]=useState(''),[applied,setApplied]=useState(''),[loading,setLoading]=useState(true),[listError,setListError]=useState(''),[next,setNext]=useState<number|null>(null),[active,setActive]=useState<ProjectAssetDetail|null>(null);
 const [kind,setKind]=useState<typeof kinds[number]>('product_brief'),[title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const requestId=useRef<string|null>(null),readEpoch=useRef(new WorkbenchReadEpoch()),detailSequence=useRef(0);
 const load=async(offset=0)=>{
  if(!readEpoch.current.isMounted())return;
  const ticket=readEpoch.current.begin();setLoading(true);setListError('');
  if(offset===0){setItems([]);setNext(null);}
  try{const r=await boundedWorkbenchOperation(engineFetch<unknown>(base+'?'+new URLSearchParams({q:ticket.query,limit:'10',offset:String(offset)})));if(!readEpoch.current.accepts(ticket))return;
   const page=checkedAssetPage(r.data,project.id,offset);
   if(!page){setItems([]);setNext(null);setListError(r.error||'Exact project drafts unavailable');return;}
   const merged=offset?appendAssetPage(items,page.items):page.items;
   if(!merged){setItems([]);setNext(null);setListError('Saved drafts changed while paging. Reload this search before continuing.');return;}
   setItems(merged);setNext(page.nextOffset);
  }catch{if(readEpoch.current.accepts(ticket)){setItems([]);setNext(null);setListError('Assets unavailable');}}
  finally{if(readEpoch.current.accepts(ticket))setLoading(false);}
 };
 useEffect(()=>{readEpoch.current.mount();void load();return()=>{readEpoch.current.unmount();detailSequence.current++;};},[project.id]);
 const open=async(id:string,version?:number)=>{const seq=++detailSequence.current;setBusy(true);setError('');setNotice('');
  try{const r=await boundedWorkbenchOperation(engineFetch<unknown>(base+'/'+id+(version?'?version='+version:'')));if(!readEpoch.current.isMounted()||seq!==detailSequence.current)return;
   const draft=checkedAssetDetail(r.data,project.id,id,version);
   if(!draft){setError(r.error||'Exact asset/version unavailable');setNotice('Requested draft was not loaded. The editor is unchanged; its words and target are not the requested draft.');return;}
   setActive(draft);setKind(draft.kind);setTitle(draft.title);setBody(draft.body);requestId.current=null;setNotice('Loaded saved version '+draft.version+'; current version is '+draft.currentVersion+'. Read the current version before revising old text.');
  }catch{if(readEpoch.current.isMounted()&&seq===detailSequence.current){setError('Asset unavailable');setNotice('Requested draft was not loaded. The editor is unchanged; its words and target are not the requested draft.');}}
  finally{if(readEpoch.current.isMounted()&&seq===detailSequence.current)setBusy(false);}
 };
 const start=()=>{detailSequence.current++;setActive(null);setTitle('');setBody('');requestId.current=null;setError('');setNotice('New private draft. Save does not send or publish.');};
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');requestId.current??=crypto.randomUUID();
  const submitted={title,body,kind,...(active?{id:active.id,expectedVersion:active.version}:{})};
  try{const r=await boundedWorkbenchOperation(engineFetch<unknown>(base+(active?'/'+active.id:''),{method:active?'PUT':'POST',body:JSON.stringify({requestId:requestId.current,title,body,...(active?{expectedVersion:active.version}:{kind})})}));
   if(!readEpoch.current.isMounted())return;const saved=checkedAssetSave(r.data,project.id,submitted);
   if(!saved){setError((r.error||'Save acknowledgement unavailable or mismatched.')+' Save is unconfirmed. Keep these words and retry unchanged with the same request; inspect saved drafts before starting a different save.');return;}
   const {replayed,...draft}=saved;setActive(draft);setTitle(draft.title);setBody(draft.body);requestId.current=null;setNotice((replayed?'Original save recovered. ':'Private draft saved. ')+'Saved version '+draft.version+'; current version is '+draft.currentVersion+'. Nothing sent or published.');await load();
  }catch{if(readEpoch.current.isMounted())setError('Save unconfirmed. Keep these words and retry unchanged with the same request.');}finally{if(readEpoch.current.isMounted())setBusy(false);}
 };
 const download=()=>{if(!active)return;const link=document.createElement('a'),url=URL.createObjectURL(new Blob([active.body],{type:'text/plain;charset=utf-8'}));link.href=url;link.download='project-draft-'+active.id+'-v'+active.version+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <Card className="p-5 sm:p-6 space-y-4" data-testid="project-assets">
  <div><h2 className="text-base font-semibold text-text-primary">Project drafts and pitch materials</h2><p className="text-xs text-text-secondary mt-1">{project.name}: store caller-written product briefs, research, launch copy, outreach drafts and investor pitches. Visible to authorized workspace members and this project's asset credentials. No AI, send, sharing link or publishing runs here. Do not store secrets.</p></div>
  <form onSubmit={save} className="space-y-2">
   <p aria-label="Draft editor target" className="text-xs text-text-muted break-words">{active?'Editing saved draft: '+active.title+' · version '+active.version:'New unsaved draft. No saved target selected.'}</p>
   {(active?(title!==active.title||body!==active.body):(!!title||!!body))&&<p aria-label="Draft local edit status" className="text-xs text-text-secondary">Local editor changes are not confirmed saved. List reloads keep these words; page reload or project switching loses local edits.</p>}
   <div className="flex flex-wrap gap-2"><select aria-label="Asset kind" value={kind} disabled={busy||!!active} onChange={e=>{setKind(e.target.value as typeof kind);requestId.current=null;setNotice('');}} className={inputClass+' sm:w-auto'}>{kinds.map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select><Button type="button" size="sm" variant="outline" onClick={start} disabled={busy}>New private draft</Button>{active&&<span className="text-xs text-text-muted">Version {active.version} / latest at read {active.currentVersion}</span>}</div>
   <input aria-label="Asset title" value={title} required maxLength={160} disabled={busy} onChange={e=>{setTitle(e.target.value);requestId.current=null;setNotice('');}} placeholder="Name this draft" className={inputClass}/>
   <textarea aria-label="Asset body" value={body} required maxLength={40000} rows={8} disabled={busy} onChange={e=>{setBody(e.target.value);requestId.current=null;setNotice('');}} placeholder="Plain text or Markdown. Content is stored, never executed or treated as approval." className={inputClass+' font-mono'}/>
   <p className="text-xs text-text-muted">{body.length}/40000 characters. New versions append; prior versions stay available. A stale version cannot overwrite newer work. Changing fields starts a new request ID. Reloading this page loses unsaved text and its request ID.</p>
   <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy||!title.trim()||!body.length}>{busy?'Saving draft...':active?'Save new version':'Save private draft'}</Button>{active&&<><Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void open(active.id)}>Discard edits and load current</Button><Button type="button" size="sm" variant="outline" disabled={busy||active.version<=1} onClick={()=>void open(active.id,active.version-1)}>Discard edits and load previous version</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={download}>Download saved text</Button></>}</div>
  </form>
  {error&&<p role="alert" className="text-xs text-signal-failed">{error}</p>}{notice&&<p role="status" className="text-xs text-text-secondary">{notice}</p>}
  <form onSubmit={e=>{e.preventDefault();const search=query.trim();readEpoch.current.setScope({query:search});setApplied(search);void load();}} className="flex gap-2"><input aria-label="Search project assets" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="Search latest project drafts" className={inputClass}/><Button type="submit" size="sm" variant="outline">Search drafts</Button></form>
  {listError&&<p role="alert" className="text-xs text-signal-failed">Draft list unavailable: {listError}. Editor text is retained.</p>}
  <p aria-label="Applied draft search" className="text-xs text-text-muted">{applied?'Saved draft search: '+applied:'All saved project drafts (loaded pages, not a frozen snapshot)'}. List search does not select or retarget the editor.</p>
  <ul className="space-y-2">{items.map(item=><li key={item.id}><button disabled={busy} type="button" onClick={()=>void open(item.id)} className="w-full text-left border border-border-subtle rounded-lg p-3"><span className="text-xs text-text-muted">{item.kind.replaceAll('_',' ')} · version {item.version}</span><h3 className="text-sm text-text-primary break-words">{item.title}</h3><p className="text-xs text-text-secondary whitespace-pre-wrap [overflow-wrap:anywhere]">{item.excerpt}</p></button></li>)}</ul>
  <Button type="button" size="sm" variant="outline" disabled={loading} onClick={()=>void load()}>Reload draft list</Button>
  {loading&&<p className="text-xs text-text-muted">Loading saved drafts...</p>}{!loading&&!listError&&!items.length&&<p className="text-xs text-text-muted">No saved drafts match this project and search.</p>}{next!==null&&<Button size="sm" variant="outline" disabled={loading} onClick={()=>void load(next)}>Load more drafts</Button>}
 </Card>;
}
