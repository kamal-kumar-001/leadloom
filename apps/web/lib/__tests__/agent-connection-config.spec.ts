import {describe,it,expect,vi,afterEach} from 'vitest';
import {configuredAgentApiUrl,credentialScopeRecord} from '../agent-connection-config';
import {CLI_SCRIPT_CONTENT} from '../skills-bundle';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

describe('trusted customer connection configuration',()=>{
 it('honors actual Compose AUTH_URL and explicit gateway precedence',()=>{
  expect(configuredAgentApiUrl({AUTH_URL:'http://127.0.0.1:3198'})).toBe('http://127.0.0.1:3198/api/agent');
  expect(configuredAgentApiUrl({AUTH_URL:'https://app.example',LEADLOOM_PUBLIC_API_URL:'https://engine.example/'})).toBe('https://engine.example');
  expect(configuredAgentApiUrl({AUTH_URL:'https://app.example',NEXTAUTH_URL:'https://old.example'})).toBe('https://app.example/api/agent');
  expect(configuredAgentApiUrl({NEXTAUTH_URL:'https://old.example'})).toBe('https://old.example/api/agent');
 });
 it.each(['javascript:alert(1)','https://user:secret@example.invalid','https://host.invalid/?a=1','https://host.invalid/#fragment','https://host.invalid/?','https://host.invalid/#','https://host.invalid/$(id)','https://host.invalid/\n/api/agent','https:example.invalid'])('rejects unsafe explicit destination without falling back: %s',raw=>{
  expect(configuredAgentApiUrl({AUTH_URL:'https://safe.example',LEADLOOM_PUBLIC_API_URL:raw})).toBeNull();
 });
 it('does not infer a destination when trusted configuration is missing or the application base contains a path',()=>{
  expect(configuredAgentApiUrl({})).toBeNull();expect(configuredAgentApiUrl({AUTH_URL:'https://app.example/private'})).toBeNull();
 });
 it('requires matching saved scopes, binding, expiry and nonrevoked status',()=>{
  const token={projectId:'project-a',revoked:false,expiresAt:null,scopes:['context:read','context:write']};
  const check=(tokens:typeof token[],id:string|null='project-a')=>credentialScopeRecord(tokens,id,['context:read','context:write'],1000);
  expect(check([token])).toBe(true);expect(check([{...token,scopes:['project:assets:read']}])).toBe(false);
  expect(check([{...token,revoked:true}])).toBe(false);expect(check([{...token,projectId:'project-b'}])).toBe(false);
  expect(check([{...token,expiresAt:'invalid'}] as any)).toBe(false);expect(check([{...token,expiresAt:new Date(999).toISOString()}] as any)).toBe(false);
  expect(check([{...token,scopes:['*']}])).toBe(true);expect(check([],null)).toBe(false);
 });
 it('generated CLI refuses missing or unsafe destinations before fetch and accepts an explicit local endpoint',()=>{
  const dir=mkdtempSync(join(tmpdir(),'leadloom-connection-cli-'));
  try{
   const cli=join(dir,'cli.mjs'),guard=join(dir,'guard.mjs'),marker=join(dir,'request-state');
   writeFileSync(cli,CLI_SCRIPT_CONTENT);
   writeFileSync(guard,`import{writeFileSync}from'node:fs';globalThis.fetch=async(url)=>{writeFileSync(${JSON.stringify(marker)},String(url));return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});};`);
   for(const endpoint of ['', 'javascript:alert(1)','https://u:p@host.invalid','https://host.invalid/?','https://host.invalid/#','https:host.invalid','https://host.invalid/path$bad']){
    writeFileSync(marker,'none');const result=spawnSync(process.execPath,['--import',guard,cli,'entries','brief'],{cwd:dir,encoding:'utf8',env:{...process.env,LEADLOOM_API_URL:endpoint,LEADLOOM_AGENT_TOKEN:'synthetic-local-credential',LEADLOOM_PROJECT_ID:'11111111-1111-4111-8111-111111111111'}});
    expect(result.status,endpoint+result.stderr).toBe(1);expect(readFileSync(marker,'utf8')).toBe('none');
   }
   const result=spawnSync(process.execPath,['--import',guard,cli,'entries','brief'],{cwd:dir,encoding:'utf8',env:{...process.env,LEADLOOM_API_URL:'http://127.0.0.1:3198/api/agent',LEADLOOM_AGENT_TOKEN:'synthetic-local-credential',LEADLOOM_PROJECT_ID:'11111111-1111-4111-8111-111111111111'}});
   expect(result.status,result.stderr).toBe(0);expect(readFileSync(marker,'utf8')).toBe('http://127.0.0.1:3198/api/agent/context/entries/brief');
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
