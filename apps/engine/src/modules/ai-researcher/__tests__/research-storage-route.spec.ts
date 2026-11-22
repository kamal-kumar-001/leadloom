import {it,expect} from 'vitest';
import {createApplication} from '../../../main';
import {AgentTokenService,InMemoryAgentTokenStore} from '../../auth/agent-token.service';
import {ResearchTableConflict} from '../research-row-store';
import {randomUUID} from 'node:crypto';
it('research storage failures are not acknowledged or echoed, conflicts are actionable and intent reads accept only matching workspace scope',async()=>{
 const ws=randomUUID(),uid=randomUUID(),store=new InMemoryAgentTokenStore(),tokens=new AgentTokenService(store);store.users.set(uid,{role:'member',disabledAt:null});store.workspaces.set(ws,{active:true});const token=await tokens.issue(ws,uid,{name:'Research',scopes:['research:read','research:write']}),wrong=await tokens.issue(ws,uid,{name:'Wrong',scopes:['experiments:read']}),project=await tokens.issue(ws,uid,{name:'Project',projectId:randomUUID(),scopes:['*']});let conflict=false;
 const fail=async()=>{throw conflict?new ResearchTableConflict('Research table columns changed; reload and repair before saving'):new Error('synthetic private storage diagnostic');};
 const app=await createApplication({sessionKey:Buffer.alloc(32,1),agentTokens:tokens,researchLeads:{saveAnalysis:fail,listAnalyses:fail},intentFixture:{saveAnalysis:fail,listAnalyses:async()=>[{rowId:'fixture',values:{Source:'fixture_hiring_board_sample'}}]}} as any),server=app.getHttpAdapter().getInstance();
 const req=(method:any,url:string,payload?:any,raw=token.token)=>server.inject({method,url,payload,headers:{authorization:'Bearer '+raw}});
 try{
  for(const [path,body]of [['/research/website-signals/save',{domain:'synthetic.invalid',pageText:'Synthetic research text'}],['/research/intent-fixture/save',{fixture:{}}]] as const){const r=await req('POST',path,body);expect(r.statusCode).toBe(503);expect(r.body).not.toContain('SAVED');expect(r.body).not.toContain('private storage diagnostic');}
  conflict=true;expect((await req('POST','/research/website-signals/save',{domain:'synthetic.invalid',pageText:'Synthetic research text'})).statusCode).toBe(409);expect((await req('GET','/research/leads')).statusCode).toBe(409);
  expect((await req('GET','/research/intent-signals')).statusCode).toBe(200);for(const raw of [wrong.token,project.token])expect((await req('GET','/research/intent-signals',undefined,raw)).statusCode).toBe(403);
 }finally{await app.close();}
});
