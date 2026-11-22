import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@leadloom/database';
import { ValidatorService } from '../validator.service';
import { ValidatorController } from '../validator.controller';
const url=process.env.LEADLOOM_TEST_DATABASE_URL;
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!url)('native Prisma retains exact authored and empty surveys across fresh services, captures answers, and fences workspace access',async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),ws=randomUUID();
 try{
  await db.workspace.create({data:{id:ws,name:'Synthetic authored survey'}});
  const svc=new ValidatorService('http://localhost:3000',db),controller=new ValidatorController(svc);
  const questions=[{id:'need',text:'What slows your workshop?',type:'text'},{id:'size',text:'Workshop size?',type:'choice',options:['Solo','Small team']}];
  const created=await controller.generate(ws,{rawHypothesis:'AI agent for local craftspeople',surveyQuestions:questions});
  const fresh=new ValidatorService('http://localhost:3000',db),preview=await fresh.getOwnerPage(created.experimentId,ws);
  expect(preview?.surveyQuestions).toEqual(questions);expect(preview?.status).toBe('draft');
  expect(await fresh.getPublicPage(preview!.slug)).toBeUndefined();expect(await fresh.getOwnerPage(created.experimentId,randomUUID())).toBeUndefined();
  await fresh.setPublishStatus(created.experimentId,ws,true,(await fresh.getOwnerPage(created.experimentId,ws))?.revision);
  expect((await fresh.getPublicPage(preview!.slug))?.surveyQuestions).toEqual(questions);
  const answers={'What slows your workshop?':'Manual planning','Workshop size?':'Solo'};
  await fresh.submitLead(preview!.slug,{email:'visitor@example.invalid',surveyResponses:answers});
  expect((await new ValidatorService('http://localhost:3000',db).getLeads(created.experimentId,ws)).leads[0].surveyResponses).toEqual(answers);
  const empty=await controller.generate(ws,{rawHypothesis:'Contact-only research invitation',surveyQuestions:[]});
  const emptyPreview=await fresh.getOwnerPage(empty.experimentId,ws);expect(emptyPreview?.surveyQuestions).toEqual([]);
  await fresh.setPublishStatus(empty.experimentId,ws,true,(await fresh.getOwnerPage(empty.experimentId,ws))?.revision);expect((await fresh.getPublicPage(emptyPreview!.slug))?.surveyQuestions).toEqual([]);
  expect((await fresh.submitLead(emptyPreview!.slug,{email:'empty@example.invalid',surveyResponses:{}})).success).toBe(true);
 }finally{await db.workspace.delete({where:{id:ws}});await db.$disconnect();}
});
