'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Card,Button,Badge} from '@leadloom/ui';
import {engineFetch} from '../../lib/engine-client';
interface PlanStatus{enforcement:'enabled'|'disabled';asOf:string;plan:{id:string|null;known:boolean;billingStatus:string}|null;features:Array<{key:string;allowed:boolean;reason:string}>;limits:Array<{key:string;used:number;cap:number|null;capKnown:boolean;available:number|null;allowsOneMore:boolean;reason:string;measurement:string;period:string}>;notes:string[]}
export function PlanLimitsCard(){
 const [data,setData]=useState<PlanStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const sequence=useRef(0);
 const load=async()=>{const seq=++sequence.current;setBusy(true);setData(null);setError('');try{const r=await engineFetch<PlanStatus>('/workspace/plan-status');if(seq!==sequence.current)return;if(r.data)setData(r.data);else setError(r.error||'Current plan policy unavailable');}catch{if(seq===sequence.current)setError('Current plan policy unavailable');}finally{if(seq===sequence.current)setBusy(false);}};
 useEffect(()=>{void load();return()=>{sequence.current++;};},[]);
 return <Card className="p-5 sm:p-6 space-y-4" data-testid="plan-status">
  <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-text-primary">Plan & System Limits</h2><p className="text-xs text-text-secondary mt-1">Current server policy for this workspace. No billing or plan changes are made here.</p></div><Button size="sm" variant="outline" disabled={busy} onClick={()=>void load()}>Reload policy</Button></div>
  {busy&&<p className="text-xs text-text-muted">Loading current policy...</p>}{error&&<p role="alert" className="text-xs text-signal-failed">{error}. No plan or available quota is assumed.</p>}
  {data&&<>
   <Badge variant="subtle">{data.enforcement==='enabled'?'Policy checks enabled':'Plan enforcement disabled'}</Badge>
   <p className="text-xs text-text-secondary">{data.plan?`Configured plan: ${data.plan.id??'none'}${data.plan.known?'':' (unknown)'}. Recorded billing status: ${data.plan.billingStatus}. Not a payment confirmation.`:'No plan or available quota is inferred while enforcement is disabled.'}</p>
   {data.enforcement==='enabled'&&<><div className="overflow-x-auto"><table className="w-full text-xs text-left"><caption className="text-left text-text-secondary mb-2">Measured limits. Recorded counters are not proof of complete usage accounting.</caption><thead className="text-text-muted"><tr>{['Limit','Measured','Cap','Available now','One more'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{data.limits.map(l=><tr key={l.key} className="border-t border-border-subtle"><td className="p-2 text-text-primary">{l.key}<span className="block text-[10px] text-text-muted">{l.measurement==='saved_rows'?'Current saved tables':'Recorded counter'} · {l.period}</span></td><td className="p-2">{l.used}</td><td className="p-2">{!l.capKnown?'Unknown':l.cap===null?'Unlimited':l.cap}</td><td className="p-2">{!l.capKnown?'Unknown':l.available===null?'Unlimited':l.available}</td><td className="p-2">{l.allowsOneMore?'Allowed by policy':l.reason.replaceAll('_',' ')}</td></tr>)}</tbody></table></div>
   <details className="text-xs text-text-secondary"><summary className="cursor-pointer">Configured feature decisions</summary><ul className="mt-2 space-y-1">{data.features.map(f=><li key={f.key}>{f.key}: {f.allowed?'allowed by policy':f.reason.replaceAll('_',' ')}</li>)}</ul></details></>}
   <ul className="space-y-1 text-[11px] text-text-muted">{data.notes.map(n=><li key={n}>{n}</li>)}</ul><p className="text-[10px] text-text-muted">Checked {new Date(data.asOf).toLocaleString()}. Reload for current state.</p>
  </>}
 </Card>;
}
