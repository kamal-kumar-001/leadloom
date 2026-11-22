import {z} from 'zod';
const mediaUrl=z.string().url().max(2000).refine(value=>{
 try{const u=new URL(value),host=u.hostname.toLowerCase().replace(/\.+$/,'');return value===value.trim()&&u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&host.includes('.')&&!host.startsWith('[')&&!/^\d+(\.\d+)*$/.test(host)&&!['localhost','local','internal','test','invalid','example'].some(s=>host===s||host.endsWith('.'+s));}catch{return false;}
},'Use an exact HTTPS media URL on a public hostname, without credentials or a fragment. Public reachability and media bytes remain unchecked.');
const exactText=z.string().max(2200).refine(value=>value===value.trim(),'DMPilot trims caption edges. Review that change before preparing an exact handoff.');
const accountId=z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
const schedule=z.string().datetime({offset:true}).nullable();
export const DmpilotPostCopySchema=z.object({instagramAccountId:accountId,mediaUrl,mediaType:z.enum(['IMAGE','REEL','VIDEO']),caption:exactText,scheduledAt:schedule}).strict();
export const DmpilotPreviewRequestSchema=DmpilotPostCopySchema.omit({scheduledAt:true}).extend({scheduledAt:z.string().datetime({offset:true}).optional(),dryRun:z.literal(true),clientRequestId:z.string().uuid()}).strict();
export const DmpilotPreparedHandoffSchema=z.object({schema:z.literal('leadloom-dmpilot-post-handoff-v1'),state:z.literal('private_handoff'),productBrief:z.object({assetId:z.string().uuid(),version:z.number().int().min(1).max(1000000)}).strict(),copy:DmpilotPostCopySchema,copyDigest:z.string().regex(/^[a-f0-9]{64}$/),dmpilotRequest:DmpilotPreviewRequestSchema,limits:z.array(z.string().max(5000)).min(1).max(10)}).strict().superRefine((saved,ctx)=>{for(const key of ['instagramAccountId','mediaUrl','mediaType','caption'] as const)if(saved.copy[key]!==saved.dmpilotRequest[key])ctx.addIssue({code:'custom',message:'Stored request differs from saved copy',path:['dmpilotRequest',key]});if(saved.copy.scheduledAt!==(saved.dmpilotRequest.scheduledAt??null))ctx.addIssue({code:'custom',message:'Stored request time differs from saved copy',path:['dmpilotRequest','scheduledAt']});});
export const PrepareDmpilotPostSchema=DmpilotPostCopySchema.extend({requestId:z.string().uuid(),title:z.string().trim().min(1).max(140),productBriefId:z.string().uuid(),productBriefVersion:z.number().int().min(1).max(1000000)}).strict();
/** This is caller-supplied data, not authenticated proof that DMPilot executed. */
export const DmpilotReportedPreviewSchema=z.object({dryRun:z.literal(true),draftOnly:z.literal(true),wouldPublish:z.object({instagramAccountId:accountId,username:z.string().min(1).max(80).nullable(),mediaUrl,mediaType:z.enum(['IMAGE','REEL','VIDEO']),caption:exactText.nullable(),scheduledAt:schedule}).strict()}).strict();
export const RecordDmpilotPreviewSchema=z.object({requestId:z.string().uuid(),draftAssetId:z.string().uuid(),draftVersion:z.number().int().min(1).max(1000000),preview:DmpilotReportedPreviewSchema}).strict();
export type PrepareDmpilotPost=z.infer<typeof PrepareDmpilotPostSchema>;
export type RecordDmpilotPreview=z.infer<typeof RecordDmpilotPreviewSchema>;
export type DmpilotPostCopy=z.infer<typeof DmpilotPostCopySchema>;
