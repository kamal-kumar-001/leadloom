'use client';
import React,{useState} from 'react';
import {Button} from '@leadloom/ui';
import {DraftPageCopySchema,type DraftPageCopy} from '@leadloom/contracts';
import {editDraftPageCopy,fetchOwnerPage} from '../../lib/engine-client';
import type {OwnerPagePreview} from './page-preview-modal';
const fields=[['title','Title',160],['headline','Headline',300],['subheadline','Description',1500],['heroCtaText','Button text',80]] as const;
const copyOf=(page:OwnerPagePreview):DraftPageCopy=>({title:page.title,headline:page.headline,subheadline:page.subheadline,heroCtaText:page.heroCtaText});
export function PageCopyEditor({experimentId,page,onClose,onSaved}:{experimentId:string;page:OwnerPagePreview;onClose:()=>void;onSaved:(page:OwnerPagePreview)=>void}){
 const [loaded,setLoaded]=useState(page),[draft,setDraft]=useState<DraftPageCopy>(()=>copyOf(page)),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const close=()=>{if(!busy)onClose();};
 const reload=async()=>{setBusy(true);setError(null);try{const r=await fetchOwnerPage(experimentId);if(!r.data){setError(r.error||'Saved copy could not be loaded. Your edits are still here.');return;}setLoaded(r.data);setDraft(copyOf(r.data));}catch{setError('Saved copy could not be loaded. Your edits are still here.');}finally{setBusy(false);}};
 const save=async()=>{
  const parsed=DraftPageCopySchema.safeParse(draft);if(!parsed.success){setError('Complete every field within the shown limits.');return;}
  setBusy(true);setError(null);
  try{const r=await editDraftPageCopy(experimentId,{expectedRevision:loaded.revision,pageCopy:parsed.data});
   if(!r.data||r.data.saved!==true){setError(r.error||'Copy was not confirmed saved. Your edits are still here. Reload the saved page before retrying.');return;}
   onSaved(r.data);
  }catch{setError('Save was not confirmed. Your edits are still here. Reload the saved page before retrying.');}finally{setBusy(false);}
 };
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-md p-4" onClick={close}>
  <section role="dialog" aria-modal="true" aria-label="Edit draft page copy" className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border-muted bg-canvas p-6 shadow-2xl space-y-4" onClick={e=>e.stopPropagation()}>
   <h2 className="text-lg font-semibold text-text-primary">Edit draft page copy</h2>
   <p className="text-xs text-text-muted">/v/{loaded.slug}. This saves plain text only, never publishes. Slug, project, survey, counters and captured leads do not change. Review the saved preview before publishing.</p>
   {loaded.status!=='draft'&&<p role="alert" className="text-xs text-signal-failed">This page is published. Close and explicitly unpublish it before editing.</p>}
   <fieldset disabled={busy||loaded.status!=='draft'} className="space-y-3">
    {fields.map(([key,label,max])=><label key={key} className="block text-xs text-text-secondary">{label}, maximum {max} characters<textarea aria-label={'Edit page '+label.toLowerCase()} rows={key==='subheadline'?4:2} maxLength={max} value={draft[key]} onChange={e=>setDraft(v=>({...v,[key]:e.target.value}))} className="block w-full mt-1 rounded border border-border-muted bg-canvas-elevated p-2 text-text-primary"/></label>)}
   </fieldset>
   {error&&<p role="alert" className="text-xs text-signal-failed whitespace-pre-wrap">{error}</p>}
   <p className="text-xs text-text-muted">A changed saved page rejects stale edits. Failed saves keep these fields. Reload below discards your unsaved edits.</p>
   <div className="flex flex-wrap justify-end gap-2">
    <Button size="sm" variant="outline" disabled={busy} onClick={reload}>Discard my edits and reload</Button>
    <Button size="sm" variant="outline" disabled={busy} onClick={close}>Cancel editing</Button>
    <Button size="sm" variant="primary" disabled={busy||loaded.status!=='draft'} onClick={save}>{busy?'Working...':'Save draft copy'}</Button>
   </div>
  </section>
 </div>;
}
