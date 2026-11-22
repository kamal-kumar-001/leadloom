import {createHash} from 'node:crypto';
import type {TransactionalDatabase} from './atomic-dispatch.repository';
export class PrivateCampaignConflict extends Error{}
export interface PrivateCampaignCopy{name:string;steps:unknown[];dailyLimitTotal:number;scheduleTimezone:string}
const copy=(r:any):PrivateCampaignCopy=>({name:r.name,steps:(typeof r.steps==='string'?JSON.parse(r.steps):r.steps).map((s:any)=>({stepNumber:s.stepNumber,delayHours:s.delayHours,subject:s.subject,bodyTemplate:s.bodyTemplate})),dailyLimitTotal:Number(r.daily_limit_total),scheduleTimezone:r.schedule_timezone});
const revision=(id:string,v:PrivateCampaignCopy)=>createHash('sha256').update(JSON.stringify({id,...v})).digest('hex');
/** Draft-only content service. It cannot change identity, lifecycle, recipients, senders or jobs. */
export class PrivateCampaignService{
 constructor(private readonly db:TransactionalDatabase){}
 private async locked(tx:any,workspaceId:string,projectId:string|undefined,id:string){
  const rows=await tx.query('SELECT id,name,steps,daily_limit_total,schedule_timezone,status,table_id,project_id FROM campaigns WHERE id=$1::uuid AND workspace_id=$2::uuid AND ($4::boolean OR project_id=$3::uuid) FOR UPDATE',[id,workspaceId,projectId??null,projectId===undefined]);if(!rows[0])return null;const r=rows[0];
  const effects=await tx.query('SELECT EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=$1::uuid) OR EXISTS(SELECT 1 FROM campaign_mailboxes WHERE campaign_id=$1::uuid) OR EXISTS(SELECT 1 FROM outbound_jobs WHERE campaign_id=$1::uuid) AS attached',[id]);
  if(r.status!=='draft'||r.table_id!==null||effects[0]?.attached)throw new PrivateCampaignConflict('Only private drafts without table, recipients, senders or jobs can be revised. Existing workflow state was not changed.');return r;
 }
 async get(workspaceId:string,projectId:string|undefined,id:string){return this.db.transaction(async tx=>{const r=await this.locked(tx,workspaceId,projectId,id);if(!r)return null;const v=copy(r);return{id,projectId:r.project_id,status:'draft',...v,revision:revision(id,v)};});}
 async revise(workspaceId:string,projectId:string|undefined,id:string,input:PrivateCampaignCopy&{expectedRevision:string}){return this.db.transaction(async tx=>{const r=await this.locked(tx,workspaceId,projectId,id);if(!r)return null;const current=copy(r),next=copy({name:input.name,steps:input.steps,daily_limit_total:input.dailyLimitTotal,schedule_timezone:input.scheduleTimezone}),old=revision(id,current),fresh=revision(id,next);if(old===fresh)return{id,projectId:r.project_id,status:'draft',...current,revision:old,changed:false};if(input.expectedRevision!==old)throw new PrivateCampaignConflict('Draft copy changed since restore. Keep local words and read the current draft before revising.');await tx.query('UPDATE campaigns SET name=$2,steps=$3::jsonb,daily_limit_total=$4,schedule_timezone=$5,updated_at=clock_timestamp() WHERE id=$1::uuid',[id,next.name,JSON.stringify(next.steps),next.dailyLimitTotal,next.scheduleTimezone]);return{id,projectId:r.project_id,status:'draft',...next,revision:fresh,changed:true};});}
}
