import {createHash} from 'node:crypto';
import {DmpilotPreparedHandoffSchema,DmpilotPostCopySchema,type DmpilotPostCopy,type PrepareDmpilotPost,type RecordDmpilotPreview} from '@leadloom/contracts';
import {ProjectAssetService} from './project-asset.service';
export class DmpilotHandoffConflict extends Error{}
const fingerprint=(copy:DmpilotPostCopy)=>createHash('sha256').update(JSON.stringify(DmpilotPostCopySchema.parse(copy))).digest('hex');
const boundary='Private caller-driven handoff only. No account eligibility, media bytes, current permission, human approval, schedule, publication or provider execution is certified. Use the existing DMPilot connector for its preview; actual publishing remains in its separately reviewed dashboard. No DMPilot or Meta credential belongs in this record.';
/** Reuses private versioned assets. It never fetches a URL, stores a provider key or calls DMPilot/Meta. */
export class DmpilotPostHandoffService{
 constructor(private readonly assets:ProjectAssetService){}
 async prepare(workspaceId:string,projectId:string,userId:string,input:PrepareDmpilotPost){
  const brief=await this.assets.get(workspaceId,projectId,input.productBriefId,input.productBriefVersion);if(!brief)return null;
  if(brief.kind!=='product_brief')throw new DmpilotHandoffConflict('Select an explicit saved product brief version, not another asset kind.');
  const copy=DmpilotPostCopySchema.parse({instagramAccountId:input.instagramAccountId,mediaUrl:input.mediaUrl,mediaType:input.mediaType,caption:input.caption,scheduledAt:input.scheduledAt});
  const body={schema:'leadloom-dmpilot-post-handoff-v1',state:'private_handoff',productBrief:{assetId:brief.id,version:brief.version},copy,copyDigest:fingerprint(copy),dmpilotRequest:{instagramAccountId:copy.instagramAccountId,mediaUrl:copy.mediaUrl,mediaType:copy.mediaType,caption:copy.caption,...copy.scheduledAt?{scheduledAt:copy.scheduledAt}:{},dryRun:true,clientRequestId:input.requestId},limits:[boundary,'IMAGE, REEL and VIDEO only. The inspected DMPilot implementation does not create carousel children; CAROUSEL is refused here.','A selected historical brief is not silently upgraded. Schedule validity, tester/account/scoped-key access, media format and public reachability still require DMPilot and human checks.']};
  return this.assets.create(workspaceId,projectId,userId,{requestId:input.requestId,kind:'launch_copy',title:input.title,body:JSON.stringify(body,null,2)});
 }
 async recordPreview(workspaceId:string,projectId:string,userId:string,input:RecordDmpilotPreview){
  const draft=await this.assets.get(workspaceId,projectId,input.draftAssetId,input.draftVersion);if(!draft)return null;
  let saved:any;try{saved=JSON.parse(draft.body);}catch{throw new DmpilotHandoffConflict('Selected asset is not a structured DMPilot handoff.');}
  const intact=DmpilotPreparedHandoffSchema.safeParse(saved);
  const parsed=DmpilotPostCopySchema.safeParse(saved.copy);
  if(draft.kind!=='launch_copy'||!intact.success||!parsed.success||saved.copyDigest!==fingerprint(parsed.data))throw new DmpilotHandoffConflict('Selected asset is not an intact supported DMPilot handoff.');
  const expected={...parsed.data,caption:parsed.data.caption||null},reported=input.preview.wouldPublish;
  if(['instagramAccountId','mediaUrl','mediaType','caption','scheduledAt'].some(key=>(reported as any)[key]!== (expected as any)[key]))throw new DmpilotHandoffConflict('Reported preview differs from the exact saved account, media, words or time. No preview record was saved.');
  return this.assets.create(workspaceId,projectId,userId,{requestId:input.requestId,kind:'research',title:('Reported DMPilot preview: '+draft.title).slice(0,160),body:JSON.stringify({schema:'leadloom-dmpilot-reported-preview-v1',state:'caller_reported_preview_only',draft:{assetId:draft.id,version:draft.version,copyDigest:saved.copyDigest},provenance:'Unverified caller-supplied DMPilot API-key preview data. Shape and exact draft equality checked locally; origin and execution are not authenticated.',reportedPreview:input.preview,limits:[boundary,'This is neither human approval nor a publish receipt. A provider publication ID, uncertain result, error or partial publication must not be relabeled as a preview. Do not retry external publication based on this record.']},null,2)});
 }
}
