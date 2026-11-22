import {createHash,randomUUID} from 'node:crypto';
import {CreateProjectExperimentDraftSchema,type CreateProjectExperimentDraft} from '@leadloom/contracts';
import type {PrismaClient} from '@leadloom/database';
export class ExperimentDraftConflict extends Error{}
export class ExperimentDraftDenied extends Error{}
/** Private storage only. Never generates copy, publishes, records demand or schedules outreach. */
export class ProjectExperimentDraftService{
 constructor(private readonly db:PrismaClient){}
 async create(workspaceId:string,projectId:string,userId:string,raw:CreateProjectExperimentDraft){
  const input=CreateProjectExperimentDraftSchema.parse(raw);
  const canonical={projectId,hypothesis:input.rawHypothesis,slug:input.preferredSlug,pageCopy:input.pageCopy,surveyQuestions:input.surveyQuestions};
  const hash=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return this.db.$transaction(async tx=>{
   // Parent first. In particular, deletion and a repeated request cannot race recreation.
   const ws:any[]=await tx.$queryRawUnsafe('SELECT id FROM workspaces WHERE id=$1::uuid AND is_active FOR UPDATE',workspaceId);if(!ws.length)return null;
   const actor:any[]=await tx.$queryRawUnsafe("SELECT id FROM users WHERE id=$1::uuid AND workspace_id=$2::uuid AND disabled_at IS NULL AND role IN ('admin','member') FOR SHARE",userId,workspaceId);if(!actor.length)throw new ExperimentDraftDenied('Current workspace write access required');
   const project:any[]=await tx.$queryRawUnsafe('SELECT id FROM projects WHERE id=$1::uuid AND workspace_id=$2::uuid FOR KEY SHARE',projectId,workspaceId);if(!project.length)return null;
   const receipt:any[]=await tx.$queryRawUnsafe('SELECT payload_hash,experiment_id FROM experiment_create_receipts WHERE workspace_id=$1::uuid AND request_id=$2::uuid',workspaceId,input.requestId);
   const read=async(id:string)=>{
    const rows:any[]=await tx.$queryRawUnsafe('SELECT e.id,e.project_id,p.slug,p.status,p.title,p.headline,p.subheadline,p.hero_cta_text,p.survey_questions FROM validation_experiments e JOIN smoke_test_pages p ON p.experiment_id=e.id WHERE e.id=$1::uuid AND e.workspace_id=$2::uuid AND e.project_id=$3::uuid ORDER BY p.created_at,p.id',id,workspaceId,projectId);
    if(rows.length!==1)throw new ExperimentDraftConflict('Original draft no longer has one saved page. No replacement was created.');
    const r=rows[0];return{experimentId:r.id,projectId:r.project_id,slug:r.slug,status:r.status,pageCopy:{title:r.title,headline:r.headline,subheadline:r.subheadline,heroCtaText:r.hero_cta_text},surveyQuestions:r.survey_questions};
   };
   if(receipt.length){if(receipt[0].payload_hash!==hash)throw new ExperimentDraftConflict('Request ID already used for different experiment input');return{...await read(receipt[0].experiment_id),replayed:true};}
   // Slugs are globally unique, but never expose another workspace's page or record.
   // A transaction-scoped advisory lock covers this check across workspaces, too.
   await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text",'experiment-slug:'+input.preferredSlug);
   const taken:any[]=await tx.$queryRawUnsafe('SELECT id FROM smoke_test_pages WHERE slug=$1',input.preferredSlug);if(taken.length)throw new ExperimentDraftConflict('Requested page slug unavailable. No experiment was created.');
   const id=randomUUID(),pageId=randomUUID();
   await tx.$executeRawUnsafe('INSERT INTO validation_experiments(id,workspace_id,project_id,hypothesis,updated_at)VALUES($1::uuid,$2::uuid,$3::uuid,$4,clock_timestamp())',id,workspaceId,projectId,input.rawHypothesis);
   await tx.$executeRawUnsafe("INSERT INTO smoke_test_pages(id,experiment_id,slug,title,headline,subheadline,hero_cta_text,survey_questions,status,updated_at)VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,'draft',clock_timestamp())",pageId,id,input.preferredSlug,input.pageCopy.title,input.pageCopy.headline,input.pageCopy.subheadline,input.pageCopy.heroCtaText,JSON.stringify(input.surveyQuestions));
   await tx.$executeRawUnsafe('INSERT INTO experiment_create_receipts(workspace_id,request_id,project_id,payload_hash,experiment_id)VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid)',workspaceId,input.requestId,projectId,hash,id);
   return{...await read(id),replayed:false};
  });
 }
}
