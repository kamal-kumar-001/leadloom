import React from 'react';
import {DmpilotPreparedHandoffSchema,DmpilotReportedPreviewSchema,type ProjectAssetDetail} from '@leadloom/contracts';
/** Saved immutable copy only, never unsaved editor values or an approval control. */
export function DmpilotHandoffPreview({asset}:{asset:ProjectAssetDetail|null}){
 if(!asset)return null;let body:any;try{body=JSON.parse(asset.body);}catch{return null;}
 const isReport=body.schema==='leadloom-dmpilot-reported-preview-v1';
 let copy:any;
 if(body.schema==='leadloom-dmpilot-post-handoff-v1'){const result=DmpilotPreparedHandoffSchema.safeParse(body);if(!result.success)return null;copy=result.data.copy;}
 else if(isReport){const result=DmpilotReportedPreviewSchema.safeParse(body.reportedPreview);if(!result.success)return null;copy=result.data.wouldPublish;}
 else return null;
 return <section data-testid="dmpilot-saved-handoff" className="rounded-lg border border-border-subtle p-4 space-y-3">
  <h3 className="text-sm font-semibold">{isReport?'Reported DMPilot preview':'Saved DMPilot posting handoff'} · version {asset.version}</h3>
  <p role="note" className="text-xs text-text-secondary">{isReport?'Unverified caller-reported preview. Its origin and execution are not authenticated.':'Private preparation for the existing DMPilot connector.'} Not human approval, scheduling or publication. These are the saved words, not unsaved editor changes.</p>
  <dl className="grid sm:grid-cols-2 gap-3 text-xs">
   <div><dt className="text-text-muted">DMPilot account ID, eligibility unchecked</dt><dd className="break-all mt-1">{copy.instagramAccountId}</dd></div>
   <div><dt className="text-text-muted">Format</dt><dd className="mt-1">{copy.mediaType}</dd></div>
   <div><dt className="text-text-muted">Requested time, not an active schedule</dt><dd className="break-all mt-1">{copy.scheduledAt||'None selected. No automatic publication.'}</dd></div>
   <div><dt className="text-text-muted">Media, bytes and public reachability unchecked</dt><dd className="break-all mt-1"><a href={copy.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline text-brand-loom">{copy.mediaUrl}</a></dd></div>
  </dl>
  <div><p className="text-xs text-text-muted">Exact saved caption</p><p className="text-sm whitespace-pre-wrap break-words mt-1">{copy.caption||'(No caption)'}</p></div>
  <p className="text-xs text-text-secondary">DMPilot API keys are preview-only. Actual publication remains a separate reviewed dashboard action. No account, token, media upload or provider call was made by this handoff.</p>
 </section>;
}
