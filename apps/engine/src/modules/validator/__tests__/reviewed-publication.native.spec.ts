import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@leadloom/database';
import {ValidatorService,PagePublicationConflict} from '../validator.service';
import {ValidatorController} from '../validator.controller';
import {createApplication} from '../../../main';
import {issueSession} from '../../auth/issuer';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native publication requires exact reviewed revision, serializes with edit and returns truthful failures without exposing diagnostics',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID(),uid=randomUUID(),service=new ValidatorService('http://localhost',db),key=Buffer.alloc(32,8);let app:any;
 const tag='pub_'+randomUUID().replaceAll('-',''),copy={title:'Reviewed title',headline:'Reviewed headline',subheadline:'Reviewed description',heroCtaText:'Reviewed button'};
 try{
  await db.workspace.create({data:{id:ws,name:'Publication boundary fixture'}});const made=await service.generate(ws,{rawHypothesis:'Synthetic reviewed-copy publication boundary',pageCopy:copy,surveyQuestions:[]}),id=made.experimentId,first=(await service.getOwnerPage(id,ws))!;
  app=await createApplication({sessionKey:key,validator:new ValidatorController(service)} as any);const server=app.getHttpAdapter().getInstance(),human=(role:any='member',workspaceId=ws)=>({authorization:'Bearer '+issueSession({workspaceId,userId:uid,role},key,3600).token}),post=(body:any,headers=human(),action='publish',target=id)=>server.inject({method:'POST',url:'/validator/experiments/'+target+'/'+action,headers,payload:body});
  for(const invalid of [{},{expectedRevision:'bad'},{expectedRevision:first.revision,extra:true}])expect((await post(invalid)).statusCode).toBe(400);
  expect((await post({expectedRevision:first.revision},human('read_only'))).statusCode).toBe(403);expect((await post({expectedRevision:first.revision},human('member',randomUUID()))).statusCode).toBe(404);expect((await post({expectedRevision:first.revision},human(),'publish','not-a-uuid')).statusCode).toBe(400);
  const changed=await service.editDraftCopy(id,ws,{expectedRevision:first.revision,pageCopy:{...copy,headline:'Newer exact reviewed headline'}});expect((await post({expectedRevision:first.revision})).statusCode).toBe(409);expect(await service.getPublicPage(first.slug)).toBeUndefined();expect((await db.smokeTestPage.findFirstOrThrow({where:{experimentId:id}})).visitors).toBe(0);
  expect((await post({expectedRevision:changed!.revision})).statusCode).toBe(200);const published=await db.smokeTestPage.findFirstOrThrow({where:{experimentId:id}});expect(published.status).toBe('published');expect((await post({expectedRevision:changed!.revision})).statusCode).toBe(200);expect((await db.smokeTestPage.findUniqueOrThrow({where:{id:published.id}})).updatedAt).toEqual(published.updatedAt);
  expect((await post({},human(),'unpublish')).statusCode).toBe(200);
  // Hold the exact row in a real independent edit transaction. The publication waiter must read the committed new content.
  let release!:()=>void,inside!:()=>void;const gate=new Promise<void>(r=>release=r),locked=new Promise<void>(r=>inside=r);
  const editing=db.$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT id FROM smoke_test_pages WHERE id=$1::uuid FOR UPDATE',published.id);await tx.smokeTestPage.update({where:{id:published.id},data:{title:'Transaction changed title'}});inside();await gate;});await locked;
  const waiting=service.setPublishStatus(id,ws,true,changed!.revision);release();await editing;await expect(waiting).rejects.toBeInstanceOf(PagePublicationConflict);expect((await service.getOwnerPage(id,ws))?.status).toBe('draft');
  // Storage failure is not mislabeled as missing, and no partial publication escapes.
  const current=(await service.getOwnerPage(id,ws))!;await db.$executeRawUnsafe(`CREATE FUNCTION ${tag}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${published.id}'::uuid THEN RAISE EXCEPTION 'Private fixture diagnostics'; END IF; RETURN NEW; END $$`);await db.$executeRawUnsafe(`CREATE TRIGGER ${tag} BEFORE UPDATE ON smoke_test_pages FOR EACH ROW EXECUTE FUNCTION ${tag}()`);
  const failed=await post({expectedRevision:current.revision});expect(failed.statusCode).toBe(503);expect(failed.body).not.toContain('diagnostics');expect((await service.getOwnerPage(id,ws))?.status).toBe('draft');
  expect((await db.waitlistLead.count({where:{pageId:published.id}}))).toBe(0);expect((await db.smokeTestPage.findUniqueOrThrow({where:{id:published.id}})).visitors).toBe(0);
 }finally{await app?.close();await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${tag} ON smoke_test_pages`);await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${tag}()`);await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
},30000);
