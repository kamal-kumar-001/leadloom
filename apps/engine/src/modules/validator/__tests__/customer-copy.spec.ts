import { it, expect } from 'vitest';
import { DraftPageCopySchema, GenerateValidationRequestSchema } from '@leadloom/contracts';
import { ValidatorService } from '../validator.service';
import { ValidatorController } from '../validator.controller';
import { createApplication } from '../../../main';
import { issueSession } from '../../auth/issuer';
import { randomUUID } from 'node:crypto';
const copy={title:'Customer words',headline:'Build tools for local craftspeople',subheadline:'Our exact idea is not an LLM reliability product.',heroCtaText:'Join our research'};
it('preserves customer copy despite AI keywords and keeps the generated page private until publish',async()=>{
 const svc=new ValidatorService(),gen=await svc.generate('ws',{rawHypothesis:'AI agent for local craftspeople',pageCopy:copy});
 expect(await svc.getPublicPage(gen.decomposed.slug)).toBeUndefined();
 const preview=await svc.getOwnerPage(gen.experimentId,'ws');for(const key of Object.keys(copy) as Array<keyof typeof copy>)expect(preview![key]).toBe(copy[key]);
 await svc.setPublishStatus(gen.experimentId,'ws',true,(await svc.getOwnerPage(gen.experimentId,'ws'))?.revision);const pub=await svc.getPublicPage(gen.decomposed.slug);for(const key of Object.keys(copy) as Array<keyof typeof copy>)expect(pub![key]).toBe(copy[key]);
});
it('bounds complete plain-text copy, rejects unknown executable/config fields and retains backward-compatible template generation',async()=>{
 expect(DraftPageCopySchema.safeParse({...copy,title:''}).success).toBe(false);expect(DraftPageCopySchema.safeParse({...copy,headline:'x'.repeat(301)}).success).toBe(false);expect(DraftPageCopySchema.safeParse({...copy,html:'<script>synthetic</script>'}).success).toBe(false);
 expect(GenerateValidationRequestSchema.parse({rawHypothesis:'AI reliability tooling'}).pageCopy).toBeUndefined();
 expect((await new ValidatorService().generate('ws',{rawHypothesis:'AI reliability tooling'})).decomposed.smokePage.headline).toContain('AI reliability tooling');
});
it('real route requires write role, accepts bounded caller copy and never publishes on creation',async()=>{
 const key=Buffer.alloc(32,8),ws=randomUUID(),svc=new ValidatorService(),app=await createApplication({sessionKey:key,validator:new ValidatorController(svc)} as any),server=app.getHttpAdapter().getInstance();
 const call=(role:any,body:any)=>server.inject({method:'POST',url:'/validator/experiments',headers:{authorization:'Bearer '+issueSession({workspaceId:ws,userId:randomUUID(),role},key,3600).token},payload:body});
 try{expect((await call('read_only',{rawHypothesis:'AI for local craftsmen',pageCopy:copy})).statusCode).toBe(403);expect((await call('member',{rawHypothesis:'AI for local craftsmen',pageCopy:{...copy,title:''}})).statusCode).toBe(400);const r=await call('member',{rawHypothesis:'AI for local craftsmen',pageCopy:copy});expect(r.statusCode).toBe(200);const preview=await svc.getOwnerPage(r.json().experimentId,ws);expect(preview?.headline).toBe(copy.headline);expect(await svc.getPublicPage(preview!.slug)).toBeUndefined();}finally{await app.close();}
});
