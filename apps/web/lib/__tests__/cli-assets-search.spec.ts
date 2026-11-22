import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CLI_SCRIPT_CONTENT} from '../skills-bundle';
it('generated asset CLI transports exact typed search/paging with bound credential and rejects ignored arguments before network',async()=>{
 const requests:Array<{url:string;auth:string}>=[],dir=mkdtempSync(join(tmpdir(),'leadloom-asset-cli-'));let status=200;
 const server=createServer((req,res)=>{requests.push({url:req.url||'',auth:String(req.headers.authorization||'')});res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(status===200?{items:[{id:'selected',kind:'investor_pitch',title:'Short summary',excerpt:'Bounded words',version:2}],nextOffset:20}:{error:'Unavailable, not empty'}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address()as any,path=join(dir,'cli.mjs');writeFileSync(path,CLI_SCRIPT_CONTENT);
 const run=(args:string[])=>new Promise<{code:number;stdout:string;stderr:string}>(resolve=>execFile(process.execPath,[path,...args],{cwd:dir,env:{...process.env,LEADLOOM_API_URL:'http://127.0.0.1:'+address.port+'/api/agent',LEADLOOM_AGENT_TOKEN:'synthetic-project-read-token',LEADLOOM_TOOL_TOKEN:'synthetic-unrelated-tool-token'}},(error,stdout,stderr)=>resolve({code:error?1:0,stdout,stderr})));
 try{
  const q='orchard & $ literal';const searched=await run(['assets','search','investor_pitch',q,'10']);expect(searched.code).toBe(0);expect(JSON.parse(searched.stdout).nextOffset).toBe(20);let u=new URL(requests.at(-1)!.url,'http://localhost');expect(u.pathname).toBe('/api/agent/project/assets');expect(Object.fromEntries(u.searchParams)).toEqual({limit:'10',offset:'10',kind:'investor_pitch',q});expect(requests.at(-1)!.auth).toBe('Bearer synthetic-project-read-token');
  expect((await run(['assets','search','all'])).code).toBe(0);u=new URL(requests.at(-1)!.url,'http://localhost');expect(Object.fromEntries(u.searchParams)).toEqual({limit:'10',offset:'0'});
  expect((await run(['assets','list','legacy text'])).code).toBe(0);expect(Object.fromEntries(new URL(requests.at(-1)!.url,'http://localhost').searchParams)).toEqual({q:'legacy text'});const before=requests.length,uuid='11111111-1111-4111-8111-111111111111';
  for(const args of[['search'],['search','unknown'],['search','all','x','-1'],['search','all','x','1.5'],['search','all','x','10001'],['search','all','x','abc'],['search','all','x'.repeat(201)],['search','all','x','0','ignored'],['list','x','ignored'],['get',uuid,'1','ignored'],['revise',uuid,'unused.json','ignored'],['create','unused.json','ignored']])expect((await run(['assets',...args])).code).toBe(1);expect(requests).toHaveLength(before);
  status=503;const unavailable=await run(['assets','search','research']);expect(unavailable.code).toBe(1);expect(JSON.parse(unavailable.stdout)).toEqual({error:'Unavailable, not empty'});
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
},30000);
