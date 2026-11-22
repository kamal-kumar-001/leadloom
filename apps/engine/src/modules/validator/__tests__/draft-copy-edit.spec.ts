import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {EditDraftPageCopySchema} from '@leadloom/contracts';
import {ValidatorService,DraftPageConflict,PagePublicationConflict} from '../validator.service';
import {ValidatorController} from '../validator.controller';
import {createApplication} from '../../../main';
import {issueSession} from '../../auth/issuer';
const initial={title:'First title',headline:'First headline',subheadline:'First description',heroCtaText:'First button'};
it('draft editing validates exact fields, fences tenants/roles, retains survey and never publishes; stale writes conflict and exact retries are safe',async()=>{
 const ws=randomUUID(),key=Buffer.alloc(32,9),uid=randomUUID(),service=new ValidatorService(),controller=new ValidatorController(service);
 const result=await service.generate(ws,{rawHypothesis:'Synthetic draft copy edit fixture',pageCopy:initial,surveyQuestions:[]});
 const app=await createApplication({sessionKey:key,validator:controller} as any),server=app.getHttpAdapter().getInstance();
 const token=(role:any='member',workspaceId=ws)=>issueSession({workspaceId,userId:uid,role},key,3600).token;
 const original=(await service.getOwnerPage(result.experimentId,ws))!,copy={...initial,headline:'Revised exact words <script>never executes</script>'},payload={expectedRevision:original.revision,pageCopy:copy};
 const put=(body:any=payload,raw=token(),id=result.experimentId)=>server.inject({method:'PUT',url:'/validator/experiments/'+id+'/page',headers:{authorization:'Bearer '+raw},payload:body});
 try{
  expect(EditDraftPageCopySchema.safeParse({...payload,surveyQuestions:[]}).success).toBe(false);
  expect((await put(payload,token('read_only'))).statusCode).toBe(403);expect((await put(payload,token('member',randomUUID()))).statusCode).toBe(404);
  expect((await put({...payload,pageCopy:{...copy,html:'Synthetic extra'}})).statusCode).toBe(400);expect((await put({...payload,expectedRevision:'stale'})).statusCode).toBe(400);
  const edited=await put();expect(edited.statusCode).toBe(200);expect(edited.json().saved).toBe(true);expect(edited.json().changed).toBe(true);expect(edited.json().headline).toBe(copy.headline);expect(edited.json().surveyQuestions).toEqual([]);expect(edited.json().slug).toBe(original.slug);expect(edited.json().revision).not.toBe(original.revision);expect(await service.getPublicPage(original.slug)).toBeUndefined();
  expect((await put()).json().changed).toBe(false);
  expect((await put({...payload,pageCopy:{...copy,title:'Stale lost edit'}})).statusCode).toBe(409);
  await service.setPublishStatus(result.experimentId,ws,true,(await service.getOwnerPage(result.experimentId,ws))?.revision);expect((await put()).statusCode).toBe(409);expect((await service.getPublicPage(original.slug))?.headline).toBe(copy.headline);
 }finally{await app.close();}
});
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native draft copy CAS locks prevent competing overwrites, preserve all captured data and roll back failed updates',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),service=new ValidatorService('http://localhost:3000',db),controller=new ValidatorController(service),key=Buffer.alloc(32,3);let app:any;
 const tag='page_edit_'+randomUUID().replaceAll('-','');
 try{
  await db.workspace.create({data:{id:ws,name:'Synthetic native draft copy'}});
  const generated=await service.generate(ws,{rawHypothesis:'Synthetic real native copy revisions',pageCopy:initial,surveyQuestions:[{id:'need',type:'text',text:'What is missing?'}]});
  const id=generated.experimentId,original=(await service.getOwnerPage(id,ws))!;
  await service.setPublishStatus(id,ws,true,(await service.getOwnerPage(id,ws))?.revision);await service.getPublicPage(original.slug);await service.submitLead(original.slug,{email:'captured@example.invalid',surveyResponses:{'What is missing?':'Saved answer'}});await service.setPublishStatus(id,ws,false);
  const page=await db.smokeTestPage.findFirstOrThrow({where:{experimentId:id}}),lead=await db.waitlistLead.findFirstOrThrow({where:{pageId:page.id}});
  const results=await Promise.allSettled(['One','Two'].map(title=>service.editDraftCopy(id,ws,{expectedRevision:original.revision,pageCopy:{...initial,title}})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason).toBeInstanceOf(DraftPageConflict);
  const current=(await service.getOwnerPage(id,ws))!,before=await db.smokeTestPage.findUniqueOrThrow({where:{id:page.id}});
  const retry=await service.editDraftCopy(id,ws,{expectedRevision:original.revision,pageCopy:{title:current.title,headline:current.headline,subheadline:current.subheadline,heroCtaText:current.heroCtaText}});expect(retry?.changed).toBe(false);expect((await db.smokeTestPage.findUniqueOrThrow({where:{id:page.id}})).updatedAt).toEqual(before.updatedAt);
  expect(before.surveyQuestions).toEqual(page.surveyQuestions);expect(before.visitors).toBe(page.visitors);expect(before.slug).toBe(page.slug);expect(await db.waitlistLead.findUnique({where:{id:lead.id}})).toEqual(lead);
  expect(await service.editDraftCopy(id,randomUUID(),{expectedRevision:current.revision,pageCopy:initial})).toBeUndefined();
  await db.$executeRawUnsafe(`CREATE FUNCTION ${tag}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${page.id}'::uuid THEN RAISE EXCEPTION 'Synthetic private edit failure'; END IF; RETURN NEW; END $$`);await db.$executeRawUnsafe(`CREATE TRIGGER ${tag} BEFORE UPDATE ON smoke_test_pages FOR EACH ROW EXECUTE FUNCTION ${tag}()`);
  app=await createApplication({sessionKey:key,validator:controller} as any);const response=await app.getHttpAdapter().getInstance().inject({method:'PUT',url:'/validator/experiments/'+id+'/page',headers:{authorization:'Bearer '+issueSession({workspaceId:ws,userId:randomUUID(),role:'member'},key,3600).token},payload:{expectedRevision:current.revision,pageCopy:{...initial,title:'Failed edit'}}});expect(response.statusCode).toBe(503);expect(response.body).not.toContain('private');expect(await db.smokeTestPage.findUnique({where:{id:page.id}})).toEqual(before);
  await db.$executeRawUnsafe(`DROP TRIGGER ${tag} ON smoke_test_pages`);await db.$executeRawUnsafe(`DROP FUNCTION ${tag}()`);
  // Publish and edit serialize on the same page row. Either edit wins before publish,
  // or edit rejects after publish. It never overwrites an already-published page.
  const race=await Promise.allSettled([service.setPublishStatus(id,ws,true,current.revision),service.editDraftCopy(id,ws,{expectedRevision:current.revision,pageCopy:{...initial,title:'Race candidate'}})]);
  expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  if(race[0].status==='fulfilled'){expect(race[1].status).toBe('rejected');expect((race[1] as PromiseRejectedResult).reason).toBeInstanceOf(DraftPageConflict);expect((await service.getOwnerPage(id,ws))?.status).toBe('published');await expect(service.editDraftCopy(id,ws,{expectedRevision:current.revision,pageCopy:initial})).rejects.toBeInstanceOf(DraftPageConflict);}
  else{expect(race[0].reason).toBeInstanceOf(PagePublicationConflict);expect((await service.getOwnerPage(id,ws))?.status).toBe('draft');}
  expect(await db.waitlistLead.findUnique({where:{id:lead.id}})).toEqual(lead);

 }finally{await app?.close();await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${tag} ON smoke_test_pages`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${tag}()`);await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
},30000);
