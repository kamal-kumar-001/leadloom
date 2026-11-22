import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {CreateProjectGrowthWatchSchema,UpdateProjectGrowthWatchSchema,ProjectGrowthWatchSchema,ProjectExperimentResultsSchema,type ProjectExperimentResults} from '@leadloom/contracts';
import {ProjectExperimentResultsService,StoredAggregateInvalid} from '../validator/project-experiment-results.service';
export class GrowthWatchConflict extends Error{}
export class GrowthWatchInvalid extends Error{}
export class GrowthWatchAccess extends Error{}
export class GrowthWatchUnavailable extends Error{}
const q=(tx:any,sql:string,...args:any[])=>tx.$queryRawUnsafe(sql,...args);
const stamp=(n:any)=>new Date(n).toISOString();
/** Only stored counters and their provenance. No contact/page payload or generated conclusion. */
const receipt=(s:ProjectExperimentResults)=>({experimentId:s.experimentId,projectId:s.projectId,asOf:s.asOf,counts:s.counts,ratios:s.ratios,provenance:s.provenance,limits:s.limits});
const digest=(s:ProjectExperimentResults)=>createHash('sha256').update(JSON.stringify(s.counts)).digest('hex');
/** Durable private observations. No provider, network, send, metric-write or model dependency exists. */
export class ProjectGrowthWatchService{
 private readonly results:ProjectExperimentResultsService;
 constructor(private readonly db:any){this.results=new ProjectExperimentResultsService(db);}
 private detail(r:any){return ProjectGrowthWatchSchema.parse({id:r.id,projectId:r.project_id,experimentId:r.experiment_id,intervalMinutes:r.interval_minutes,state:r.state,revision:r.revision,nextDueAt:stamp(r.next_due_at),lastCheckedAt:r.last_checked_at?stamp(r.last_checked_at):null,lastEntryId:r.last_entry_id??null,blockedReason:r.blocked_reason??null,createdAt:stamp(r.created_at),updatedAt:stamp(r.updated_at)});}
 private async transaction<T>(fn:(tx:any)=>Promise<T>):Promise<T>{
  for(let attempt=0;;attempt++){try{return await this.db.$transaction(fn,{isolationLevel:'RepeatableRead',maxWait:5000,timeout:10000});}catch(e:any){const code=e?.meta?.code;if(attempt<3&&(e?.code==='P2034'||code==='40001'||code==='40P01'||code==='23505'))continue;throw e;}}
 }
 private async parents(tx:any,workspaceId:string,projectId:string,userId?:string){
  const workspace=(await q(tx,'SELECT is_active FROM workspaces WHERE id=$1::uuid FOR SHARE',workspaceId))[0];
  if(!workspace?.is_active)throw new GrowthWatchAccess('Active workspace required');
  if(userId&&!(await q(tx,"SELECT id FROM users WHERE id=$1::uuid AND workspace_id=$2::uuid AND disabled_at IS NULL AND role IN('admin','member') FOR SHARE",userId,workspaceId)).length)throw new GrowthWatchAccess('Current workspace writer required');
  return Boolean((await q(tx,'SELECT id FROM projects WHERE id=$1::uuid AND workspace_id=$2::uuid FOR UPDATE',projectId,workspaceId)).length);
 }
 private async source(tx:any,workspaceId:string,projectId:string,experimentId:string){
  if(!(await q(tx,'SELECT id FROM validation_experiments WHERE id=$1::uuid AND workspace_id=$2::uuid AND project_id=$3::uuid FOR SHARE',experimentId,workspaceId,projectId)).length)return null;
  const result=await this.results.readInTransaction(tx,workspaceId,projectId,experimentId);return result?ProjectExperimentResultsSchema.parse(result):null;
 }
 private async append(tx:any,workspaceId:string,projectId:string,userId:string,watchId:string,s:ProjectExperimentResults,baseline=false){
  const body=['Private scheduled aggregate observation, not a caller conclusion or demand verdict.',baseline?'Baseline saved when this watch was explicitly started.':'Counters changed since this watch last recorded an observation. Decreases can reflect corrections/deletions.',`Watch ${watchId}. Actual stored snapshot follows.`,JSON.stringify(receipt(s),null,2),'No contact, metric change, provider call, publication, notification or send is authorized or performed.'].join('\n');
  if(body.length>6000)throw new StoredAggregateInvalid('Aggregate receipt exceeds work-record bound');
  const id=randomUUID();await q(tx,"INSERT INTO project_entries(id,workspace_id,project_id,request_id,kind,title,body,created_by_user_id)VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'research',$5,$6,$7::uuid) RETURNING id",id,workspaceId,projectId,randomUUID(),baseline?'Growth watch baseline':'Growth watch changed counters',body,userId);return id;
 }
 async list(workspaceId:string,projectId:string){
  if(!(await q(this.db,'SELECT id FROM projects WHERE id=$1::uuid AND workspace_id=$2::uuid',projectId,workspaceId)).length)return null;
  const rows=await q(this.db,'SELECT * FROM project_growth_watches WHERE workspace_id=$1::uuid AND project_id=$2::uuid ORDER BY created_at,id LIMIT 21',workspaceId,projectId);
  if(rows.length>20)throw new GrowthWatchInvalid('Watch list exceeds project bound');return rows.map((r:any)=>this.detail(r));
 }
 async create(workspaceId:string,projectId:string,userId:string,raw:unknown,workerAvailable:boolean){
  const input=CreateProjectGrowthWatchSchema.parse(raw);
  return this.transaction(async tx=>{
   if(!await this.parents(tx,workspaceId,projectId,userId))return null;
   const previous=(await q(tx,'SELECT * FROM project_growth_watches WHERE id=$1::uuid AND workspace_id=$2::uuid AND project_id=$3::uuid FOR UPDATE',input.requestId,workspaceId,projectId))[0];
   if(previous){if(previous.experiment_id!==input.experimentId||previous.requested_by!==userId||previous.requested_interval_minutes!==input.intervalMinutes)throw new GrowthWatchConflict('Request already used for another watch configuration');return{watch:this.detail(previous),created:false};}
   if(!workerAvailable)throw new GrowthWatchUnavailable('Local observation worker is unavailable');
   if((await q(tx,'SELECT id FROM project_growth_watches WHERE id=$1::uuid',input.requestId)).length)throw new GrowthWatchConflict('Request already used');
   const inventory=await q(tx,'SELECT experiment_id FROM project_growth_watches WHERE workspace_id=$1::uuid AND project_id=$2::uuid',workspaceId,projectId);
   if(inventory.some((r:any)=>r.experiment_id===input.experimentId))throw new GrowthWatchConflict('This experiment already has a watch; update its existing watch');
   if(inventory.length>=20)throw new GrowthWatchInvalid('At most20 watches per project');
   const snapshot=await this.source(tx,workspaceId,projectId,input.experimentId);if(!snapshot)return null;
   const entryId=await this.append(tx,workspaceId,projectId,userId,input.requestId,snapshot,true);
   const rows=await q(tx,"INSERT INTO project_growth_watches(id,workspace_id,project_id,experiment_id,requested_by,authorized_by,requested_interval_minutes,interval_minutes,next_due_at,last_checked_at,last_digest,last_entry_id)VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$5::uuid,$6,$6,clock_timestamp()+($6::int*interval '1 minute'),clock_timestamp(),$7,$8::uuid) RETURNING *",input.requestId,workspaceId,projectId,input.experimentId,userId,input.intervalMinutes,digest(snapshot),entryId);
   return{watch:this.detail(rows[0]),created:true};
  });
 }
 async update(workspaceId:string,projectId:string,userId:string,id:string,raw:unknown,workerAvailable:boolean){
  const input=UpdateProjectGrowthWatchSchema.parse(raw);
  return this.transaction(async tx=>{
   if(!await this.parents(tx,workspaceId,projectId,userId))return null;
   const candidate=(await q(tx,'SELECT experiment_id FROM project_growth_watches WHERE id=$1::uuid AND workspace_id=$2::uuid AND project_id=$3::uuid',id,workspaceId,projectId))[0];if(!candidate)return null;
   await q(tx,'SELECT id FROM validation_experiments WHERE id=$1::uuid AND workspace_id=$2::uuid AND project_id=$3::uuid FOR SHARE',candidate.experiment_id,workspaceId,projectId);
   const row=(await q(tx,'SELECT * FROM project_growth_watches WHERE id=$1::uuid AND workspace_id=$2::uuid AND project_id=$3::uuid FOR UPDATE',id,workspaceId,projectId))[0];if(!row)return null;
   if(row.experiment_id!==candidate.experiment_id)throw new GrowthWatchConflict('Watch source changed');
   if(row.revision!==input.expectedRevision)throw new GrowthWatchConflict('Watch changed; reload before changing it');
   if(input.state==='active'&&!workerAvailable)throw new GrowthWatchUnavailable('Local observation worker is unavailable');
   if(input.state==='active'&&!await this.source(tx,workspaceId,projectId,row.experiment_id))return null;
   const interval=input.intervalMinutes??row.interval_minutes;
   if(row.state===input.state&&row.interval_minutes===interval&&(input.state!=='active'||row.authorized_by===userId))return this.detail(row);
   const updated=await q(tx,"UPDATE project_growth_watches SET state=$2,interval_minutes=$3,authorized_by=CASE WHEN $2='active' THEN $4::uuid ELSE authorized_by END,blocked_reason=NULL,revision=revision+1,next_due_at=clock_timestamp()+($3::int*interval '1 minute'),updated_at=clock_timestamp() WHERE id=$1::uuid RETURNING *",id,input.state,interval,userId);return this.detail(updated[0]);
  });
 }
 private async observe(id:string){
  const candidate=(await q(this.db,'SELECT workspace_id,project_id,experiment_id,authorized_by FROM project_growth_watches WHERE id=$1::uuid',id))[0];if(!candidate)return null;
  return this.transaction(async tx=>{
   // Same parent-before-child order as project deletion and writes. Role locks fence revocation.
   const workspace=(await q(tx,'SELECT is_active FROM workspaces WHERE id=$1::uuid FOR SHARE',candidate.workspace_id))[0];if(!workspace)return null;
   const actor=candidate.authorized_by?(await q(tx,"SELECT id FROM users WHERE id=$1::uuid AND workspace_id=$2::uuid AND disabled_at IS NULL AND role IN('admin','member') FOR SHARE",candidate.authorized_by,candidate.workspace_id))[0]:null;
   if(!(await q(tx,'SELECT id FROM projects WHERE id=$1::uuid AND workspace_id=$2::uuid FOR UPDATE',candidate.project_id,candidate.workspace_id)).length)return null;
   const experiment=(await q(tx,'SELECT id FROM validation_experiments WHERE id=$1::uuid AND workspace_id=$2::uuid AND project_id=$3::uuid FOR SHARE',candidate.experiment_id,candidate.workspace_id,candidate.project_id))[0];
   const row=(await q(tx,"SELECT * FROM project_growth_watches WHERE id=$1::uuid AND workspace_id=$2::uuid AND project_id=$3::uuid AND experiment_id=$4::uuid AND state='active' AND next_due_at<=clock_timestamp() FOR UPDATE SKIP LOCKED",id,candidate.workspace_id,candidate.project_id,candidate.experiment_id))[0];if(!row)return null;
   if(row.authorized_by!==candidate.authorized_by)return null;
   const block=async(reason:string)=>{await q(tx,"UPDATE project_growth_watches SET state='blocked',blocked_reason=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1::uuid RETURNING id",id,reason);return{state:'blocked',id,reason};};
   if(!workspace.is_active||!actor)return block('access_changed');if(!experiment)return block('experiment_unavailable');
   let snapshot:ProjectExperimentResults|null;
   try{snapshot=await this.source(tx,row.workspace_id,row.project_id,row.experiment_id);}catch(e){if(e instanceof StoredAggregateInvalid||e instanceof z.ZodError)return block('invalid_results');throw e;}
   if(!snapshot)return block('experiment_unavailable');const nextDigest=digest(snapshot),changed=nextDigest!==row.last_digest;
   const entryId=changed?await this.append(tx,row.workspace_id,row.project_id,row.authorized_by,id,snapshot):row.last_entry_id;
   await q(tx,"UPDATE project_growth_watches SET last_checked_at=clock_timestamp(),last_digest=$2,last_entry_id=$3::uuid,next_due_at=clock_timestamp()+(interval_minutes*interval '1 minute'),updated_at=clock_timestamp() WHERE id=$1::uuid RETURNING id",id,nextDigest,entryId);
   return{id,state:changed?'recorded':'unchanged',entryId};
  });
 }
 async tick(){
  const candidates=await q(this.db,"SELECT id FROM project_growth_watches WHERE state='active' AND next_due_at<=clock_timestamp() ORDER BY next_due_at,id LIMIT 20");const outcomes=[];
  for(const row of candidates){try{outcomes.push(await this.observe(row.id));}catch{outcomes.push({id:row.id,state:'unconfirmed'});}}
  return outcomes;
 }
}
/** One bounded local loop. stop() drains an in-flight transaction before database shutdown. */
export class ProjectGrowthWatchWorker{
 private timer:ReturnType<typeof setInterval>|null=null;private running:Promise<unknown>|null=null;
 constructor(private readonly service:ProjectGrowthWatchService,private readonly intervalMs=60_000){}
 get available(){return this.timer!==null;}
 start(){if(this.timer)return;this.timer=setInterval(()=>this.run(),this.intervalMs);this.timer.unref?.();this.run();}
 private run(){if(this.running)return;this.running=this.service.tick().catch(()=>undefined).finally(()=>{this.running=null;});}
 async stop(){if(this.timer)clearInterval(this.timer);this.timer=null;await this.running;}
}
