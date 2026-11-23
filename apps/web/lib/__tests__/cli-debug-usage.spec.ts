import {describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CLI_SCRIPT_CONTENT} from '../skills-bundle';

describe('generated CLI opt-in usage indicator',()=>{
 it('measures actual JSON body bytes, separates estimates and excludes credentials/content with no default telemetry',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'leadloom-usage-'));let calls=0;
  const body=JSON.stringify({items:[{title:'hypothetical Hindi नमस्ते 🧪',body:'private-content-not-for-debug'}]});
  const server=createServer((req,res)=>{calls++;res.writeHead(200,{'content-type':'application/json'});res.end(body);});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const port=(server.address() as any).port;
  const run=(debug:string)=>new Promise<{stdout:string,stderr:string}>((resolve,reject)=>execFile(process.execPath,[join(dir,'cli.mjs'),'entries','brief'],{cwd:dir,env:{...process.env,LEADLOOM_API_URL:'http://127.0.0.1:'+port,LEADLOOM_PROJECT_ID:'11111111-1111-4111-8111-111111111111',LEADLOOM_AGENT_TOKEN:'synthetic-local-secret-do-not-log',LEADLOOM_DEBUG_USAGE:debug}},(e,stdout,stderr)=>e?reject(e):resolve({stdout,stderr})));
  try{
   writeFileSync(join(dir,'cli.mjs'),CLI_SCRIPT_CONTENT);
   const normal=await run('0');expect(JSON.parse(normal.stdout)).toEqual(JSON.parse(body));expect(normal.stderr).toBe('');
   const observed=await run('1');expect(JSON.parse(observed.stdout)).toEqual(JSON.parse(body));
   const data=JSON.parse(observed.stderr.replace('[Leadloom debug usage] ',''));
   expect(data.measured).toEqual({requests:1,failures:0,requestBodyUtf8Bytes:0,responseJsonUtf8Bytes:Buffer.byteLength(body),responseJsonCharacters:Array.from(body).length,jsonResponsesRead:1});
   expect(data.estimated.responseContextTokens).toBe(Math.ceil(Array.from(body).length/4));expect(data.antigravityProviderTokens).toBeNull();
   expect(observed.stderr).not.toContain('synthetic-local-secret');expect(observed.stderr).not.toContain('private-content-not-for-debug');expect(observed.stderr).not.toContain('127.0.0.1');expect(calls).toBe(2);
  }finally{await new Promise<void>(r=>server.close(()=>r()));rmSync(dir,{recursive:true,force:true});}
 });
});
