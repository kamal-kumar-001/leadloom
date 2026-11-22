import {z} from 'zod';
import {ProjectResponseSchema,ProjectEntryKindSchema} from '@leadloom/contracts';
const Count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Summary=z.object({id:z.string().uuid(),projectId:z.string().uuid(),kind:ProjectEntryKindSchema,title:z.string().min(1).max(160),excerpt:z.string().max(360),createdAt:z.string().datetime()}).strict();
const Detail=Summary.extend({body:z.string().min(1).max(6000)});
const Page=z.object({items:Summary.array().max(10),nextCursor:z.string().min(1).max(400).nullable()}).strict();
export type HistorySummary=z.infer<typeof Summary>;
export type HistoryDetail=z.infer<typeof Detail>;
export function checkedHistoryProjects(value:unknown){const result=ProjectResponseSchema.array().safeParse(value);return result.success&&new Set(result.data.map(p=>p.id)).size===result.data.length?result.data:null;}
export function checkedHistoryPage(value:unknown,projectId:string){const result=Page.safeParse(value);return result.success&&result.data.items.every(e=>e.projectId===projectId)&&new Set(result.data.items.map(e=>e.id)).size===result.data.items.length?result.data:null;}
export function checkedHistoryDetail(value:unknown,projectId:string,id:string){const result=Detail.safeParse(value);return result.success&&result.data.projectId===projectId&&result.data.id===id?result.data:null;}
export function appendHistoryPage(current:HistorySummary[],incoming:HistorySummary[]){const ids=new Set(current.map(e=>e.id));return incoming.some(e=>ids.has(e.id))?null:[...current,...incoming];}
const Campaign=z.object({id:z.string().uuid(),name:z.string().min(1).max(255),sendStatus:z.object({awaitingApproval:Count,uncertain:Count,failed:Count})});
export interface CampaignAttentionFlag{id:string;campaignId:string;name:string;kind:'review'|'uncertain'|'stopped';count:number;label:string;note:string}
export function checkedCampaignAttention(value:unknown):CampaignAttentionFlag[]|null{
 const parsed=Campaign.array().max(100).safeParse(value);if(!parsed.success||new Set(parsed.data.map(c=>c.id)).size!==parsed.data.length)return null;
 return parsed.data.flatMap(c=>{
  const result:CampaignAttentionFlag[]=[];
  if(c.sendStatus.awaitingApproval)result.push({id:c.id+':review',campaignId:c.id,name:c.name,kind:'review',count:c.sendStatus.awaitingApproval,label:'Awaiting message review',note:'Stored pending-approval records. Review is not permission to release or send.'});
  if(c.sendStatus.uncertain)result.push({id:c.id+':uncertain',campaignId:c.id,name:c.name,kind:'uncertain',count:c.sendStatus.uncertain,label:'Provider outcome uncertain',note:'These attempts may have reached a provider. Reconcile before deciding whether to retry.'});
  if(c.sendStatus.failed)result.push({id:c.id+':stopped',campaignId:c.id,name:c.name,kind:'stopped',count:c.sendStatus.failed,label:'Cancelled or rejected',note:'Stored cancelled/rejected job records, not a live queue-health or delivery result.'});
  return result;
 });
}
