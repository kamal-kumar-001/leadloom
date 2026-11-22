import { it, expect } from 'vitest';
import { DraftSurveyQuestionsSchema, GenerateValidationRequestSchema } from '@leadloom/contracts';
import { ValidatorService } from '../validator.service';
import { ValidatorController } from '../validator.controller';
const questions=[{id:'need',text:'What slows your workshop?',type:'text' as const},{id:'size',text:'Workshop size?',type:'choice' as const,options:['Solo','Small team']}];
it('retains exact caller questions and explicit empty surveys, with templates only when omitted',async()=>{
 const svc=new ValidatorService(),controller=new ValidatorController(svc);
 const result=await controller.generate('ws',{rawHypothesis:'AI agent for local craftspeople',surveyQuestions:questions});
 expect((await svc.getOwnerPage(result.experimentId,'ws'))?.surveyQuestions).toEqual(questions);
 expect(await svc.getPublicPage((await svc.getOwnerPage(result.experimentId,'ws'))!.slug)).toBeUndefined();
 expect(await svc.getOwnerPage(result.experimentId,'other')).toBeUndefined();
 await svc.setPublishStatus(result.experimentId,'ws',true,(await svc.getOwnerPage(result.experimentId,'ws'))?.revision);
 expect((await svc.getPublicPage((await svc.getOwnerPage(result.experimentId,'ws'))!.slug))?.surveyQuestions).toEqual(questions);
 const empty=await controller.generate('ws',{rawHypothesis:'Contact details only research',surveyQuestions:[]});
 expect((await svc.getOwnerPage(empty.experimentId,'ws'))?.surveyQuestions).toEqual([]);
 const omitted=await controller.generate('ws',{rawHypothesis:'AI reliability tooling'});
 expect((await svc.getOwnerPage(omitted.experimentId,'ws'))?.surveyQuestions).toHaveLength(2);
});
it('bounds questions and options and refuses ambiguous answer keys and unsupported configs',()=>{
 const valid=DraftSurveyQuestionsSchema.parse(questions);expect(valid).toEqual(questions);
 for(const bad of [[...questions,...questions],[{...questions[0],id:'bad id'}],[{...questions[0],text:''}],[{...questions[0],text:'x'.repeat(301)}],[{...questions[0],script:'x'}],[{...questions[0],options:['A','B']}],[{...questions[1],options:undefined}],[{...questions[1],options:['A']}],[{...questions[1],options:['A',' A ']}],[{...questions[1],options:['A','x'.repeat(161)]}],Array.from({length:9},(_,i)=>({id:'q'+i,text:'Q'+i,type:'text'})),[{...questions[0]},{...questions[0],id:'other'}]])expect(DraftSurveyQuestionsSchema.safeParse(bad).success,JSON.stringify(bad)).toBe(false);
 expect(GenerateValidationRequestSchema.parse({rawHypothesis:'Synthetic survey contract',surveyQuestions:[]}).surveyQuestions).toEqual([]);
});
