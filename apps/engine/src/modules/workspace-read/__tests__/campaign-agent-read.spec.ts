import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../../../main';
import { AgentTokenService, InMemoryAgentTokenStore } from '../../auth/agent-token.service';
it('campaign read scope exposes observations only, enforces workspace/project boundaries and immediately respects revocation',async()=>{
 const store=new InMemoryAgentTokenStore(),tokens=new AgentTokenService(store),ws=randomUUID(),user=randomUUID(),campaign=randomUUID(),foreign=randomUUID(),project=randomUUID();
 store.users.set(user,{role:'read_only',disabledAt:null});store.workspaces.set(ws,{active:true});
 const token=await tokens.issue(ws,user,{name:'Read observations',scopes:['campaigns:read']}),wrong=await tokens.issue(ws,user,{name:'Wrong',scopes:['experiments:read']}),bound=await tokens.issue(ws,user,{name:'Project wildcard',projectId:project,scopes:['*']});
 const reads:any={listCampaigns:async(workspace:string)=>[{id:campaign,workspace}],listCampaignJobs:async(workspace:string,id:string)=>workspace===ws&&id===campaign?{campaign:{id},jobs:[]}:null};
 const app=await createApplication({sessionKey:Buffer.alloc(32,1),agentTokens:tokens,reads} as any),server=app.getHttpAdapter().getInstance();
 const get=(url:string,raw=token.token)=>server.inject({method:'GET',url,headers:{authorization:'Bearer '+raw}});
 try{
  expect((await get('/workspace/campaigns')).json()).toEqual([{id:campaign,workspace:ws}]);
  expect((await get('/workspace/campaigns?workspaceId='+foreign)).statusCode).toBe(400);
  expect((await get('/campaigns/'+campaign+'/jobs')).statusCode).toBe(200);
  expect((await get('/campaigns/'+foreign+'/jobs')).statusCode).toBe(404);
  expect((await get('/campaigns/not-uuid/jobs')).statusCode).toBe(400);
  for(const url of ['/workspace/campaigns','/campaigns/'+campaign+'/jobs']){
   expect((await get(url,wrong.token)).statusCode).toBe(403);expect((await get(url,bound.token)).statusCode).toBe(403);
  }
  for(const [method,url] of [['POST','/workspace/campaigns'],['PUT','/campaigns/'+campaign+'/status'],['POST','/outbound/jobs'],['POST','/outbound/release']])expect((await server.inject({method:method as any,url,headers:{authorization:'Bearer '+token.token},payload:{}})).statusCode).toBe(403);
  await tokens.revoke(ws,token.id);expect((await get('/workspace/campaigns')).statusCode).toBe(401);
 }finally{await app.close();}
});
