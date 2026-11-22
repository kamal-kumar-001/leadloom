import { describe,it,expect } from 'vitest';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ProjectHnResearchService,boundedHnFetch,HnResearchUnavailable,HnResearchLimited,HnResearchBusy,HN_SEARCH_MAX_BYTES,HN_SEARCH_SCOPE } from '../project-hn-research.service';
import { HnAlgoliaAdapter } from '../sources/hn-algolia.adapter';
import { createApplication } from '../../../main';
import { AgentTokenService,InMemoryAgentTokenStore } from '../../auth/agent-token.service';
import { ProjectRegistryService,InMemoryProjectRegistryStore } from '../../project-context/project-registry.service';
import { issueSession } from '../../auth/issuer';
const post={source:'hackernews' as const,externalId:'123',title:'Public fixture',text:'Problem observed in fixture',url:'https://news.ycombinator.com/item?id=123',author:'fixture',postedAt:'2026-11-01T00:00:00Z'};

describe('bounded public HN research',()=>{
 it('fixed upstream destination, no redirects/credentials, bounded bytes/shape and no retry',async()=>{
  let count=0;const safe=boundedHnFetch(async(url,options)=>{count++;expect(String(url)).toContain('https://hn.algolia.com/api/v1/search?');expect(options).toMatchObject({redirect:'error',credentials:'omit'});return new Response(JSON.stringify({hits:[]}),{headers:{'content-type':'application/json'}});});
  await expect(safe('https://127.0.0.1/api/v1/search')).rejects.toBeInstanceOf(HnResearchUnavailable);expect(count).toBe(0);
  expect(await (await safe('https://hn.algolia.com/api/v1/search?query=x')).json()).toEqual({hits:[]});expect(count).toBe(1);
  for(const body of ['{bad',JSON.stringify({hits:{}}),JSON.stringify({hits:Array(11).fill({})}),JSON.stringify({hits:[],padding:'x'.repeat(HN_SEARCH_MAX_BYTES)})])await expect(boundedHnFetch(async()=>new Response(body,{headers:{'content-type':'application/json'}}))('https://hn.algolia.com/api/v1/search')).rejects.toBeInstanceOf(HnResearchUnavailable);
  await expect(boundedHnFetch(async()=>new Response('<html>',{headers:{'content-type':'text/html'}}))('https://hn.algolia.com/api/v1/search')).rejects.toBeInstanceOf(HnResearchUnavailable);
 });
 it('uses a real local HTTP fixture response through the production reader and existing adapter',async()=>{
  let requests=0;const server=createServer((_req,res)=>{requests++;res.setHeader('content-type','application/json');res.end(JSON.stringify({hits:[{objectID:'123',story_title:'Public fixture',comment_text:'<p>Problem &amp; need</p>',author:'fixture',created_at:'2026-11-01T00:00:00Z'}]}));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const address=server.address() as any;const reader=boundedHnFetch(((_url:any,options:any)=>fetch('http://127.0.0.1:'+address.port,options)) as typeof fetch);const service=new ProjectHnResearchService(async()=> 'allow',new HnAlgoliaAdapter(reader));const result=await service.search('ws','project','public fixture');expect(result).toMatchObject({projectId:'project',persisted:false,contentTrust:'untrusted_external_content',items:[{externalId:'123',text:'Problem & need'}]});expect(requests).toBe(1);}
  finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
 });
 it('shared limiter failure/deny prevents upstream; no stale fallback',async()=>{
  let calls=0;const searcher={search:async()=>{calls++;return [post];}};
  await expect(new ProjectHnResearchService(async()=> 'deny',searcher).search('ws','p','query')).rejects.toBeInstanceOf(HnResearchLimited);
  await expect(new ProjectHnResearchService(async()=> 'error',searcher).search('ws','p','query')).rejects.toBeInstanceOf(HnResearchUnavailable);expect(calls).toBe(0);
 });
 it('workspace in-flight exclusion, bounded output and later release after failure',async()=>{
  let finish!:()=>void;let calls=0;const service=new ProjectHnResearchService(async()=> 'allow',{search:async()=>{calls++;await new Promise<void>(resolve=>{finish=resolve;});return [post,post,{...post,externalId:'4',url:'javascript:alert(1)'}];}});
  const first=service.search('ws','p','query');await new Promise(resolve=>setTimeout(resolve,0));await expect(service.search('ws','p','query')).rejects.toBeInstanceOf(HnResearchBusy);finish();expect((await first).items).toHaveLength(1);expect(calls).toBe(1);
  let failures=0;const retry=new ProjectHnResearchService(async()=> 'allow',{search:async()=>{if(!failures++)throw new Error('private upstream diagnostic');return [post];}});await expect(retry.search('ws','p','query')).rejects.toBeInstanceOf(HnResearchUnavailable);expect((await retry.search('ws','p','query')).items).toHaveLength(1);
 });
 it('requires explicit project scope, live project binding and opt-in; invalid inputs never fetch',async()=>{
  const workspace=randomUUID(),foreign=randomUUID(),user=randomUUID(),sessionKey=Buffer.alloc(32,4),store=new InMemoryAgentTokenStore(),tokens=new AgentTokenService(store),projects=new ProjectRegistryService(new InMemoryProjectRegistryStore());
  const a=await projects.create(workspace,user,{name:'Alpha',slug:'alpha'}),b=await projects.create(foreign,user,{name:'Beta',slug:'beta'});let calls=0;
  const scoped=await tokens.issue(workspace,user,{name:'HN only',projectId:a.id,scopes:[HN_SEARCH_SCOPE]}),context=await tokens.issue(workspace,user,{name:'Context',projectId:a.id,scopes:['context:read']}),stored=await tokens.issue(workspace,user,{name:'Stored',projectId:a.id,scopes:['project:research:read']}),star=await tokens.issue(workspace,user,{name:'Wildcard',projectId:a.id,scopes:['*']}),unbound=await tokens.issue(workspace,user,{name:'Unbound',scopes:[HN_SEARCH_SCOPE]}),other=await tokens.issue(workspace,user,{name:'Foreign',projectId:b.id,scopes:[HN_SEARCH_SCOPE]});
  const services:any={sessionKey,agentTokens:tokens,projectRegistry:projects,projectHnResearch:new ProjectHnResearchService(async()=> 'allow',{search:async()=>{calls++;return [post];}})};
  const app=await createApplication(services),server=app.getHttpAdapter().getInstance();const request=(token=scoped.token,payload:any={query:'public fixture'},suffix='')=>server.inject({method:'POST',url:'/agent/project/research/hn-search'+suffix,headers:{authorization:'Bearer '+token},payload});
  try{
   for(const token of [context.token,stored.token,star.token,unbound.token,issueSession({workspaceId:workspace,userId:user,role:'member'},sessionKey,3600).token])expect((await request(token)).statusCode).toBe(403);
   expect((await request(other.token)).statusCode).toBe(404);for(const payload of [{query:''},{query:'x'.repeat(121)},{query:'bad\nquery'},{query:'x',projectId:b.id}])expect((await request(scoped.token,payload)).statusCode).toBe(400);expect((await request(scoped.token,{query:'x'},'?projectId='+b.id)).statusCode).toBe(400);expect(calls).toBe(0);
   const result=await request();expect(result.statusCode).toBe(200);expect(result.headers['cache-control']).toBe('no-store');expect(result.json()).toMatchObject({projectId:a.id,persisted:false});expect(calls).toBe(1);
   services.entitlements={checkFeature:async()=>({allowed:false,reason:'feature_not_in_plan'})};expect((await request()).statusCode).toBe(403);expect(calls).toBe(1);services.entitlements=undefined;
   services.projectHnResearch=undefined;expect((await request()).statusCode).toBe(503);expect(calls).toBe(1);
   await tokens.revoke(workspace,scoped.id);expect((await request()).statusCode).toBe(401);
   const issued=await server.inject({method:'POST',url:'/agent-tokens',headers:{authorization:'Bearer '+issueSession({workspaceId:workspace,userId:user,role:'member'},sessionKey,3600).token},payload:{name:'Unbound HN',scopes:[HN_SEARCH_SCOPE]}});expect(issued.statusCode).toBe(400);
  }finally{await app.close();}
 });
});
