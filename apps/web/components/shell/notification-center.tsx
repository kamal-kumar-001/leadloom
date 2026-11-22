'use client';
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Bell,X,AlertCircle,Info} from 'lucide-react';
import {Badge,Button} from '@leadloom/ui';
import {engineFetch} from '../../lib/engine-client';
import {checkedCampaignAttention,type CampaignAttentionFlag} from '../../lib/work-activity';
export interface NotificationCenterProps{isOpen:boolean;onClose:()=>void}
export function NotificationCenter({isOpen,onClose}:NotificationCenterProps){
 const [flags,setFlags]=useState<CampaignAttentionFlag[]>([]),[state,setState]=useState<'idle'|'loading'|'ok'|'error'>('idle'),[hidden,setHidden]=useState<Set<string>>(new Set());
 const sequence=useRef(0),controller=useRef<AbortController|null>(null),closeRef=useRef(onClose);closeRef.current=onClose;
 const load=async()=>{
  const ticket=++sequence.current;controller.current?.abort();const current=new AbortController();controller.current=current;const timer=setTimeout(()=>current.abort(),15000);setState('loading');setFlags([]);setHidden(new Set());
  try{const response=await engineFetch<unknown>('/workspace/campaigns',{signal:current.signal});if(ticket!==sequence.current)return;const result=response.error?null:checkedCampaignAttention(response.data);if(!result)throw Error('unavailable');setFlags(result);setState('ok');}
  catch{if(ticket===sequence.current){setFlags([]);setState('error');}}
  finally{clearTimeout(timer);}
 };
 const close=()=>{sequence.current++;controller.current?.abort();setFlags([]);setState('idle');closeRef.current();};
 useEffect(()=>{if(!isOpen){setFlags([]);setState('idle');return;}void load();const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};window.addEventListener('keydown',onKey);return()=>{sequence.current++;controller.current?.abort();window.removeEventListener('keydown',onKey);};},[isOpen]);
 if(!isOpen)return null;
 const visible=flags.filter(flag=>!hidden.has(flag.id));
 return <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 pt-16"><div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={close}/><div role="dialog" aria-modal="true" aria-label="Notification Center" className="relative w-full max-w-sm rounded-xl border border-border-subtle bg-canvas-surface shadow-2xl overflow-hidden font-sans z-10">
  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border-subtle"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-brand-loom"/><h2 className="text-xs font-semibold text-text-primary">Campaign attention</h2>{state==='ok'&&visible.length>0&&<Badge variant="matrix" className="text-[10px]">{visible.length} flags</Badge>}</div><button onClick={close} aria-label="Close notifications" className="text-text-muted p-1"><X className="w-4 h-4"/></button></div>
  <div className="p-3 space-y-3 max-h-[65vh] overflow-y-auto">
   <p className="text-[11px] text-text-secondary">Saved job states from up to 100 newest campaign records. This is a manual read, not live queue/provider health or delivery confirmation.</p>
   {(state==='idle'||state==='loading')&&<p role="status" className="text-xs text-text-muted py-3">Loading stored campaign attention...</p>}
   {state==='error'&&<p role="alert" className="text-xs text-signal-failed">Stored campaign attention unavailable. Retry to check. No healthy or empty state was confirmed.</p>}
   {state==='ok'&&visible.length===0&&<div className="py-3 space-y-2"><p className="text-xs text-text-primary">{flags.length?'Loaded flags hidden for this visit':'No flags in loaded campaigns'}</p><p className="text-[11px] text-text-secondary">Only awaiting-approval, uncertain and cancelled/rejected records are checked. Other work and older campaigns are not covered.</p></div>}
   {state==='ok'&&visible.map(flag=><div key={flag.id} className="rounded-lg border border-border-subtle p-3 space-y-1"><div className="flex gap-2 items-start">{flag.kind==='uncertain'?<AlertCircle className="w-4 h-4 text-signal-failed shrink-0"/>:<Info className="w-4 h-4 text-brand-loom shrink-0"/>}<div className="min-w-0 flex-1"><h3 className="text-xs font-semibold text-text-primary">{flag.label}: {flag.count}</h3><p className="text-[11px] text-text-secondary break-words mt-1">{flag.name}</p></div><button aria-label={'Hide '+flag.label+' for '+flag.name} className="text-text-muted" onClick={()=>setHidden(old=>new Set([...old,flag.id]))}><X className="w-3.5 h-3.5"/></button></div><p className="text-[11px] text-text-secondary">{flag.note}</p></div>)}
   <div className="flex gap-2 flex-wrap"><Button size="sm" variant="outline" disabled={state==='loading'} onClick={()=>void load()}>Refresh attention</Button>{state==='ok'&&visible.length>0&&<Button size="sm" variant="outline" onClick={()=>setHidden(new Set(flags.map(flag=>flag.id)))}>Hide loaded flags</Button>}</div>
  </div>
  <div className="p-3 border-t border-border-subtle flex gap-4 text-xs"><Link href="/app/campaigns" onClick={close} className="text-brand-loom">Open campaigns</Link><Link href="/app/runs" onClick={close} className="text-brand-loom">Project work history</Link></div>
 </div></div>;
}
