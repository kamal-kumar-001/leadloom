import type {PrismaClient} from '@leadloom/database';
export class StoredAggregateInvalid extends Error{}
/** Aggregate stored observations only. No contact records, model verdict or side effect. */
export class ProjectExperimentResultsService{
 constructor(private readonly db:PrismaClient){}
 async read(workspaceId:string,projectId:string,experimentId:string){
  return this.db.$transaction(tx=>this.readInTransaction(tx,workspaceId,projectId,experimentId),{isolationLevel:'RepeatableRead'});
 }
 /** Read through an existing transaction so an explicitly authorized local record can commit
  * atomically with its aggregate snapshot. This method opens no nested transaction or job. */
 async readInTransaction(tx:Pick<PrismaClient,'$queryRawUnsafe'>,workspaceId:string,projectId:string,experimentId:string){
   const rows:any[]=await tx.$queryRawUnsafe('SELECT e.id,e.project_id,e.outreach_sent,e.replies,e.positive_replies,e.created_at,e.updated_at FROM validation_experiments e JOIN projects p ON p.id=e.project_id AND p.workspace_id=e.workspace_id WHERE e.workspace_id=$1::uuid AND e.project_id=$2::uuid AND e.id=$3::uuid',workspaceId,projectId,experimentId);
   if(!rows.length)return null;const e=rows[0];
   const pages:any[]=await tx.$queryRawUnsafe('SELECT p.id,p.slug,p.status,p.visitors,p.created_at,(SELECT count(*)::int FROM waitlist_leads l WHERE l.page_id=p.id) AS stored_submissions FROM smoke_test_pages p WHERE p.experiment_id=$1::uuid ORDER BY p.created_at,p.id LIMIT 101',experimentId);
   if(pages.length>100)throw new StoredAggregateInvalid('Experiment page count exceeds aggregate results bound');
   const cleanCount=(n:unknown)=>{if(!Number.isSafeInteger(n)||Number(n)<0)throw new StoredAggregateInvalid('Stored counters cannot be represented safely');return Number(n);};
   const sent=cleanCount(e.outreach_sent),replies=cleanCount(e.replies),positive=cleanCount(e.positive_replies);if(replies>sent||positive>replies)throw new StoredAggregateInvalid('Stored outreach counters are inconsistent');
   const perPage=pages.map(p=>({slug:p.slug,status:p.status,pageLoads:cleanCount(p.visitors),storedSubmissions:cleanCount(p.stored_submissions)}));
   const loads=perPage.reduce((n,p)=>n+p.pageLoads,0),submissions=perPage.reduce((n,p)=>n+p.storedSubmissions,0);cleanCount(loads);cleanCount(submissions);
   return{experimentId:e.id,projectId:e.project_id,asOf:new Date().toISOString(),pages:perPage,counts:{pages:pages.length,pageLoads:loads,storedSubmissions:submissions,recordedOutreachSent:sent,recordedReplies:replies,recordedPositiveReplies:positive},ratios:{storedSubmissionsPerPageLoad:loads?submissions/loads:null,recordedRepliesPerOutreach:sent?replies/sent:null,recordedPositiveRepliesPerOutreach:sent?positive/sent:null},provenance:{pageLoads:'Stored successful public-page reads, not unique people. Owner preview/results reads do not increment this counter.',storedSubmissions:'Current stored waitlist rows, deduplicated by page/email. Not verified people, consent to outreach or paying customers. Counts across pages are not deduplicated across people.',outreach:'Owner-recorded replacement totals. Not derived from campaign jobs, provider receipts, inbox delivery or independently verified replies.',ratios:'Derived from these current stored counters only. Null means zero denominator. Submissions per page load can exceed1; no confidence score, causal claim or demand verdict is inferred.'},limits:['Repeatable-read snapshot of this explicitly owned experiment only; other-project/unassigned records are excluded.','All pages are included up to100; a larger experiment is refused rather than silently truncated. No email, name, company, answer, message body or provider identifier is returned.','Saved publication status is not proof of live reachability. Current stored counts can change or decrease after deletion/correction.','A stored result does not approve publication, contact, metric changes, budget, delivery or investment. No visitor, lead, campaign, job or action is created by this read.']};
 }
}
