'use client';
import {useEffect,useState} from 'react';
import {ReviewReportSummarySchema,StoredReviewReportSchema,type ProjectAssetDetail} from '@leadloom/contracts';
import type {z} from 'zod';
export function ReviewReportPreview({asset}:{asset:ProjectAssetDetail}){
 let applies=false;try{applies=asset.kind==='research'&&StoredReviewReportSchema.safeParse(JSON.parse(asset.body)).success;}catch{}
 const[data,setData]=useState<z.infer<typeof ReviewReportSummarySchema>|null>(null),[failed,setFailed]=useState('');const key=asset.id+':'+asset.version;
 useEffect(()=>{if(!applies)return;const controller=new AbortController();setData(null);setFailed('');void(async()=>{try{const r=await fetch('/api/engine/projects/'+asset.projectId+'/reviews/'+asset.id+'?version='+asset.version,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Unavailable');const d=ReviewReportSummarySchema.parse(await r.json());if(d.projectId!==asset.projectId||d.assetId!==asset.id||d.version!==asset.version)throw Error('Wrong report');setData(d);}catch{if(!controller.signal.aborted)setFailed(key);}})();return()=>controller.abort();},[asset.id,asset.projectId,asset.version,applies,key]);
 if(!applies)return null;const ready=data?.assetId===asset.id&&data.version===asset.version&&data.projectId===asset.projectId?data:null;
 return <section data-testid="review-report-preview" data-report-state={ready?'ready':failed===key?'failed':'loading'} className="mb-4 rounded-xl border border-border-subtle bg-canvas p-4 text-sm text-text-primary">
  <h3 className="font-semibold">Saved pain report</h3>
  {!ready?<p className="mt-2 text-text-muted">{failed===key?'The saved source/report digest could not be verified. No validation result is confirmed.':'Checking exact saved source versions...'}</p>:<>
   <p className="mt-2 font-medium">{ready.assessment.conclusion}</p><p className="mt-1 text-text-muted">Caller judgment: {ready.assessment.verdict.replaceAll('_',' ')}. {ready.counts.inputRecords} input records: {ready.counts.provenance.caller_reported_public} caller-reported public, {ready.counts.provenance.caller_report} caller reports, {ready.counts.provenance.synthetic} synthetic.</p>
   <p className="mt-2"><span className="font-medium">Biggest gap: </span>{ready.assessment.biggestGap}</p><p className="mt-1"><span className="font-medium">Next test: </span>{ready.assessment.nextTest}</p>
   <ol className="mt-3 space-y-3">{ready.themes.map(t=><li key={t.id} className="rounded-lg border border-border-subtle p-3"><p className="font-medium">{t.pain}</p><p className="mt-1">Untested opportunity: {t.opportunity}</p><p className="mt-1 text-text-muted">{t.supportRecords} supporting records ({t.supportProvenance.synthetic} synthetic), {t.counterRecords} counter records ({t.counterProvenance.synthetic} synthetic). {t.caveat}</p>{[...t.examples.map(e=>({...e,role:'support'})),...t.counterExamples.map(e=>({...e,role:'counter'}))].map(e=><p key={e.id} className="mt-1 text-xs text-text-muted"><a href={e.sourceUrl} target="_blank" rel="noreferrer" className="underline">{e.id}</a> ({e.role}, {e.provenance}): {e.excerpt}</p>)}</li>)}</ol>
   <p className="mt-3 text-xs text-text-muted">{ready.counts.repeatedTextRecords} repeated-text records after case/whitespace normalization. No semantic deduplication. {ready.omittedThemes?ready.omittedThemes+' further themes remain in the saved asset. ':''}{ready.note}</p>
  </>}
 </section>;
}
