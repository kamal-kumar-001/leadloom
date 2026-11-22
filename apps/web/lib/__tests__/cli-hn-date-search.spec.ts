import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CLI_SCRIPT_CONTENT} from '../skills-bundle';
it('generated HN date CLI preserves offset regex, transports exact filters and refuses wrong coverage/date/order',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'leadloom-hn-date-cli-')),projectId='11111111-1111-4111-8111-111111111111',query='saved reels',postedAfter='2026-11-10T00:00:00+05:30';let requests=0,change:(data:any)=>void=()=>{};
 const item=(id:string,time:string)=>({source:'hackernews',externalId:id,title:'Public fixture',text:'Evidence only',author:'fixture',url:'https://news.ycombinator.com/item?id='+id,postedAt:time});
 const server=createServer(async(req,res)=>{requests++;let raw='';for await(const c of req)raw+=c;const input=JSON.parse(raw);expect(req.url).toBe('/api/agent/project/research/hn-search');expect(req.headers.authorization).toBe('Bearer synthetic-explicit-hn-token');expect(input).toEqual({query,postedAfter,sort:'recent'});const data={projectId,query,source:'hn_algolia_public_search',persisted:false,contentTrust:'untrusted_external_content',fetchedAt:'2026-11-23T00:00:00Z',filters:{postedAfter,sort:'recent'},coverage:{limit:10,normalizedReceived:2,returned:2,excludedInvalidOrDuplicate:0,excludedOlderThanCutoff:0,excludedUnknownDate:0,excludedFutureDate:0,complete:false},items:[item('1','2026-11-20T00:00:00Z'),item('2','2026-11-18T00:00:00Z')]};change(data);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));writeFileSync(join(dir,'cli.mjs'),CLI_SCRIPT_CONTENT);const inputPath=join(dir,'query.json');
 const run=(input:any)=>{writeFileSync(inputPath,JSON.stringify(input));return new Promise<{code:number,stdout:string,stderr:string}>(resolve=>execFile(process.execPath,['cli.mjs','project-hn','search-file',inputPath],{cwd:dir,env:{...process.env,LEADLOOM_API_URL:'http://127.0.0.1:'+(server.address()as any).port+'/api/agent',LEADLOOM_AGENT_TOKEN:'synthetic-explicit-hn-token',LEADLOOM_PROJECT_ID:projectId}},(error,stdout,stderr)=>resolve({code:error?1:0,stdout,stderr})));};
 const input={query,postedAfter,sort:'recent'};
 try{
  const good=await run(input);expect(good.code,good.stderr).toBe(0);expect(JSON.parse(good.stdout).items.map((i:any)=>i.externalId)).toEqual(['1','2']);expect(requests).toBe(1);
  for(const patch of [{query:'private\ncontrol'},{postedAfter:'2031-11-23T00:00:00Z'},{postedAfter:'2026-11-10T00:00:00'},{postedAfter:'invalid'},{sort:'all'},{projectId:'foreign'},{query:'x'.repeat(121)}])expect((await run({...input,...patch})).code).toBe(1);expect(requests).toBe(1);
  for(const mutate of [(d:any)=>d.filters.postedAfter=null,(d:any)=>d.filters.sort='relevance',(d:any)=>d.coverage.complete=true,(d:any)=>d.coverage.normalizedReceived=3,(d:any)=>d.coverage.returned=-1,(d:any)=>d.items.reverse(),(d:any)=>d.items[1].postedAt=null,(d:any)=>d.items[1].postedAt='2026-11-01T00:00:00Z',(d:any)=>d.items[0].postedAt='2026-11-24T00:00:00Z',(d:any)=>d.projectId='foreign']){change=mutate;const refused=await run(input);expect(refused.code,refused.stdout).toBe(1);expect(refused.stdout).toBe('');}
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
},30000);
