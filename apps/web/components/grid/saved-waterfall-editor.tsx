'use client';
import React,{useState,useRef,useEffect} from 'react';
import {Button} from '@leadloom/ui';
import {engineFetch} from '../../lib/engine-client';
type Column={id:string;name:string;type:string};
type Mapping={domain:string;firstName:string;lastName:string;companyName?:string;title?:string};
type Saved={columnId:string;name:string;inputColumns:Mapping;revision:string};
/** Explicit load/edit avoids silently overwriting someone else's saved mapping. */
export function SavedWaterfallEditor({tableId,columnId,columns,canEdit,onSaved,onChanged}:{tableId:string;columnId:string;columns:Column[];canEdit:boolean;onSaved:()=>void;onChanged:()=>void}){
 const [saved,setSaved]=useState<Saved|null>(null),[name,setName]=useState(''),[mapping,setMapping]=useState<Mapping>({domain:'',firstName:'',lastName:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;},[]);
 const inputs=columns.filter(c=>['text','email','url'].includes(c.type));
 const load=async()=>{onChanged();const seq=++sequence.current;setBusy(true);setSaved(null);setError('');setNotice('');try{const r=await engineFetch<Saved>('/workspace/tables/'+tableId+'/waterfall-columns/'+columnId);if(seq!==sequence.current)return;if(!r.data){setError(r.error||'Saved mapping unavailable.');return;}setSaved(r.data);setName(r.data.name);setMapping(r.data.inputColumns);}finally{if(seq===sequence.current)setBusy(false);}};
 return <section aria-label="Edit saved waterfall mapping" className="space-y-3 border-t border-border-subtle pt-3">
 <Button type="button" size="sm" variant="outline" disabled={busy} onClick={load}>{saved?'Reload current mapping':'Load saved mapping'}</Button>
 {saved&&<form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(!canEdit||busy)return;onChanged();setBusy(true);setError('');setNotice('');try{const r=await engineFetch<Saved&{changed:boolean}>('/workspace/tables/'+tableId+'/waterfall-columns/'+columnId,{method:'PUT',body:JSON.stringify({expectedRevision:saved.revision,name,inputColumns:mapping})});if(!r.data){setError(r.error||'Edit unconfirmed. Retry unchanged or reload.');return;}setSaved(r.data);onChanged();setNotice(r.data.changed?'Mapping revised. No work queued or provider called.':'Desired mapping already saved. No duplicate change.');onSaved();}finally{setBusy(false);}}}>
 <p className="text-xs text-text-secondary">Changes affect future input validation. Existing run snapshots stay unchanged and will conflict or cancel if their configuration no longer matches. This does not recall any external work.</p>
 <label className="block text-xs text-text-secondary">Saved result column name<input aria-label="Edit waterfall column name" value={name} disabled={busy||!canEdit} required maxLength={100} onChange={e=>setName(e.target.value)} className="block w-full p-2 mt-1 rounded border border-border-subtle bg-canvas text-text-primary"/></label>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{([['domain','Domain'],['firstName','First name'],['lastName','Last name'],['companyName','Company (optional)'],['title','Title (optional)']]as const).map(([key,label])=><label key={key} className="text-xs text-text-secondary space-y-1"><span>{label}</span><select aria-label={'Edit waterfall '+key} value={mapping[key]||''} disabled={busy||!canEdit} className="block w-full p-2 rounded border border-border-subtle bg-canvas text-text-primary" onChange={e=>{const value=e.target.value;setMapping(previous=>{const next={...previous};if(value)next[key]=value;else delete next[key];return next;});}}><option value="">{key==='companyName'||key==='title'?'Not mapped':'Choose saved column'}</option>{mapping[key]&&!inputs.some(c=>c.id===mapping[key])&&<option value={mapping[key]}>Missing or unsupported saved input</option>}{inputs.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>)}</div>
 {canEdit&&<Button type="submit" size="sm" disabled={busy||!name.trim()||!mapping.domain||!mapping.firstName||!mapping.lastName||new Set(Object.values(mapping)).size!==Object.values(mapping).length}>Save mapping changes</Button>}
 </form>}
 {error&&<p role="alert" className="text-xs text-signal-failed">{error}</p>}{notice&&<p role="status" className="text-xs text-signal-verified">{notice}</p>}
 </section>;
}
