import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {CLI_SCRIPT_CONTENT} from '../skills-bundle';
import {createApplication} from '../../../engine/src/main';
import {ProjectHnResearchService,HN_SEARCH_SCOPE} from '../../../engine/src/modules/signals-ingest/project-hn-research.service';
import {AgentTokenService,InMemoryAgentTokenStore} from '../../../engine/src/modules/auth/agent-token.service';
import {ProjectRegistryService,InMemoryProjectRegistryStore} from '../../../engine/src/modules/project-context/project-registry.service';
vi.mock('server-only',()=>({}));
it('actual generated CLI -> actual gateway handler -> HTTP Nest engine, with strict receipt and scope refusal',async()=>{
 const ws=randomUUID(),uid=randomUUID(),tokens=new AgentTokenService(new InMemoryAgentTokenStore()),projects=new ProjectRegistryService(new InMemoryProjectRegistryStore()),project=await projects.create(ws,uid,{name:'HN Alpha',slug:'hn-alpha'});let calls=0,corrupt=false,limitMode=false;
 const scoped=await tokens.issue(ws,uid,{name:'Public HN fixture',projectId:project.id,scopes:[HN_SEARCH_SCOPE]}),context=await tokens.issue(ws,uid,{name:'Context only',projectId:project.id,scopes:['context:read']});
 const app=await createApplication({sessionKey:Buffer.alloc(32,3),agentTokens:tokens,projectRegistry:projects,projectHnResearch:new ProjectHnResearchService(async()=> limitMode?'deny':'allow',{search:async()=>{calls++;return [{source:'hackernews',externalId:'123',title:'Fixture',text:'Public fixture problem',url:'https://news.ycombinator.com/item?id=123',author:'fixture',postedAt:'2026-11-01T00:00:00Z'}];}})} as any);
 const folder=mkdtempSync(join(tmpdir(),'leadloom-hn-cli-'));let proxy:any;const prior=process.env.ENGINE_URL;
 try{
  await app.listen(0,'127.0.0.1');process.env.ENGINE_URL='http://127.0.0.1:'+(app.getHttpServer().address() as any).port;
  const {POST}=await import('../../app/api/agent/[...path]/route');
  proxy=createServer(async(req,res)=>{try{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks);const response=await POST(new Request('http://127.0.0.1'+req.url,{method:req.method,headers:{authorization:req.headers.authorization??'','content-type':'application/json'},body:body.length?body:undefined}),{params:Promise.resolve({path:['project','research','hn-search']})});let text=await response.text();if(corrupt&&response.ok)text=JSON.stringify({...JSON.parse(text),projectId:randomUUID()});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(text);}catch{res.writeHead(500);res.end('{}');}});
  await new Promise<void>(resolve=>proxy.listen(0,'127.0.0.1',resolve));writeFileSync(join(folder,'cli.mjs'),CLI_SCRIPT_CONTENT);
  const run=(token:string,query='public fixture')=>new Promise<{code:number|null,text:string}>(resolve=>{const child=spawn(process.execPath,['cli.mjs','project-hn','search',query],{cwd:folder,env:{...process.env,LEADLOOM_PROJECT_ID:project.id,LEADLOOM_AGENT_TOKEN:token,LEADLOOM_API_URL:'http://127.0.0.1:'+proxy.address().port+'/api/agent'},stdio:['ignore','pipe','pipe']});let text='';child.stdout.on('data',d=>text+=d);child.stderr.on('data',d=>text+=d);child.on('exit',code=>resolve({code,text}));});
  const good=await run(scoped.token);expect(good.code,good.text).toBe(0);expect(JSON.parse(good.text)).toMatchObject({projectId:project.id,persisted:false,items:[{text:'Public fixture problem'}]});expect(calls).toBe(1);
  const denied=await run(context.token);expect(denied.code).toBe(1);expect(calls).toBe(1);
  const invalid=await run(scoped.token,'bad\nquery');expect(invalid.code).toBe(1);expect(calls).toBe(1);
  limitMode=true;const limited=await fetch('http://127.0.0.1:'+proxy.address().port+'/api/agent/project/research/hn-search',{method:'POST',headers:{Authorization:'Bearer '+scoped.token,'Content-Type':'application/json'},body:JSON.stringify({query:'public fixture'})});expect(limited.status).toBe(429);expect(limited.headers.get('retry-after')).toBe('60');limitMode=false;
  corrupt=true;const bad=await run(scoped.token);expect(bad.code).toBe(1);expect(bad.text).toContain('does not confirm this project');expect(bad.text).not.toContain('Public fixture problem');expect(calls).toBe(2);
  await tokens.revoke(ws,scoped.id);expect((await run(scoped.token)).code).toBe(1);expect(calls).toBe(2);
 }finally{if(prior===undefined)delete process.env.ENGINE_URL;else process.env.ENGINE_URL=prior;await new Promise<void>(resolve=>proxy?proxy.close(()=>resolve()):resolve());await app.close();rmSync(folder,{recursive:true,force:true});}
},15000);
