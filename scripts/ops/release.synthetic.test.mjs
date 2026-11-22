import {test} from 'node:test';
import assert from 'node:assert/strict';
import {release,parseArgs,inspectConfig,checkProbe,fetchHealth,withReleaseLock} from './release.mjs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const env={DATABASE_URL:'synthetic-db-value',LEADLOOM_MASTER_KEY:'synthetic-master-value',LEADLOOM_SESSION_KEY:'synthetic-session-value',APP_BASE_URL:'https://fixture.example.invalid'};
const config=()=>({services:{postgres:{},redis:{},api:{environment:{...env},ports:[{host_ip:'127.0.0.1',published:'4010',target:4000}]},web:{environment:{AUTH_SECRET:'synthetic-web-value'},ports:[{host_ip:'127.0.0.1',published:'3000',target:3000}]}}});
const buildId='a'.repeat(64);
const options={buildId,execute:true,worker:'unmounted',sending:false,backupReference:'synthetic independently verified backup reference'};
const probe=async url=>url.endsWith('/ready')?{status:503,body:{status:'not-ready',workers:'not-mounted'}}:url.includes(':4010/')?{status:200,body:{status:'ok',service:'leadloom-engine',buildId,mutationsEnabled:true,worker:'unmounted',outboundSendingEnabled:false}}:{status:200,body:{status:'ok',service:'leadloom-web',buildId,engineReachable:true}};
function fixture({failAt,configuration=config(),health=probe}={}){const calls=[],logs=[];return{calls,logs,dependencies:{identify:()=>buildId,run:(cmd,args)=>{calls.push([cmd,...args]);if(failAt&&args.join(' ').includes(failAt))throw Error('synthetic-private-secret-diagnostics');return args.includes('config')?JSON.stringify(configuration):'';},probe:health,wait:async()=>{},log:s=>logs.push(s)}};}
test('default CLI and function are plan-only with no command, file, git, Docker or network effect',async()=>{
 const f=fixture();assert.equal((await release(parseArgs([]),f.dependencies)).executed,false);assert.deepEqual(f.calls,[]);const text=execFileSync('bash',['update.sh'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});assert.match(text,/PLAN ONLY/);assert.doesNotMatch(text,/Successfully Updated/);
 assert.throws(()=>parseArgs(['--execute']),/backup/);assert.throws(()=>parseArgs(['--force']),/Unknown/);assert.throws(()=>parseArgs(['--expect-worker','anything']),/mounted/);assert.throws(()=>parseArgs(['--expect-sending','yes']),/true or false/);
});
test('resolved config validates posture, required runtime settings, bridge/email settings and loopback/origin without outputting secrets',()=>{
 const good=inspectConfig(config(),options);assert.equal(good.worker,'unmounted');
 for(const change of [c=>c.services.api.environment.LEADLOOM_WORKER_ENABLED='true',c=>c.services.api.environment.LEADLOOM_OUTBOUND_SENDING_ENABLED='true',c=>delete c.services.api.environment.DATABASE_URL,c=>c.services.web.environment.AUTH_SECRET='',c=>c.services.api.ports[0].host_ip='0.0.0.0',c=>c.services.api.ports[0].published='90000',c=>c.services.api.environment.APP_BASE_URL='http://unsafe.invalid',c=>c.services.api.environment.APP_BASE_URL='https://user:password@fixture.invalid',c=>c.services.api.environment.LEADLOOM_PASSWORD_AUTH_ENABLED='true',c=>{c.services.api.environment.LEADLOOM_NEXTAUTH_BRIDGE_ENABLED='true';c.services.api.environment.LEADLOOM_NEXTAUTH_BRIDGE_SECRET='different';}]){const c=config();change(c);assert.throws(()=>inspectConfig(c,options));}
});
test('execute sequence stops before application replacement unless migrations/status/schema all pass; no git/prune/log/reset side effects',async()=>{
 const f=fixture();const result=await release(options,f.dependencies);assert.equal(result.replaced,true);assert.equal(result.migrated,true);
 const calls=f.calls.map(x=>x.join(' '));assert.equal(calls.length,7);assert.match(calls[1],/build api web$/);assert.match(calls[2],/up -d --wait --wait-timeout 120 postgres redis$/);assert.match(calls[3],/prisma migrate deploy/);assert.match(calls[4],/prisma migrate status/);assert.match(calls[5],/db-schema-preflight/);assert.match(calls[6],/up -d api web$/);assert(calls.every(c=>!c.includes('git')&&!c.includes('prune')&&!c.includes('logs')&&!c.includes('reset')));assert(!f.logs.join('\n').includes('synthetic-db-value'));assert.match(f.logs.join('\n'),/intentionally not ready/);
 for(const failAt of ['config','build api','up -d --wait','migrate deploy','migrate status','db-schema-preflight']){const broken=fixture({failAt});await assert.rejects(()=>release(options,broken.dependencies));assert(!broken.calls.some(c=>c.join(' ').endsWith('up -d api web')));assert.match(broken.logs.join('\n'),/RELEASE NOT VERIFIED/);assert(!broken.logs.join('\n').includes('diagnostics'));}
});
test('wrong local/public body, redirects, unavailable engine and mismatched send posture cannot pass as a deployment',async()=>{
 for(const health of [async url=>{const r=await probe(url);return{...r,body:{...r.body,buildId:'b'.repeat(64)}};},async()=>({status:200,body:{html:'homepage'}}),async()=>({status:302,body:{status:'ok'}}),async url=>url.startsWith('https:')?{status:503,body:{}}:probe(url),async url=>url.includes(':4010/health')?{status:200,body:{status:'ok',service:'leadloom-engine',buildId,mutationsEnabled:true,worker:'unmounted',outboundSendingEnabled:true}}:probe(url)]){
  const f=fixture({health});await assert.rejects(()=>release(options,f.dependencies));assert(!f.logs.some(l=>l.includes('probes passed')));assert.match(f.logs.join('\n'),/No automatic rollback/);
 }
 assert.equal(checkProbe('worker',{status:503,body:{status:'not-ready',workers:'not-mounted'}},options),true);assert.equal(checkProbe('worker',{status:200,body:{status:'ready',workers:'mounted',sendingEnabled:false}},options),false);
 const c=config();c.services.api.environment.LEADLOOM_WORKER_ENABLED='true';c.services.api.environment.LEADLOOM_OUTBOUND_SENDING_ENABLED='true';const live={...options,worker:'mounted',sending:true};assert.equal(inspectConfig(c,live).sending,true);assert.equal(checkProbe('worker',{status:200,body:{status:'ready',workers:'mounted',sendingEnabled:true}},live),true);
});
test('bounded no-redirect JSON probe refuses oversized/error data and cancels its reader',async()=>{
 assert.deepEqual(await fetchHealth('https://fixture.invalid',async()=>new Response(JSON.stringify({status:'ok'}))),{status:200,body:{status:'ok'}});
 await assert.rejects(()=>fetchHealth('https://fixture.invalid',async()=>new Response('x'.repeat(16385))));await assert.rejects(()=>fetchHealth('https://fixture.invalid',async()=>new Response('<html>not health</html>')));
 let canceled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(16385));},cancel(){canceled=true;}});await assert.rejects(()=>fetchHealth('https://fixture.invalid',async(_url,init)=>{assert.equal(init.redirect,'manual');return new Response(body);}));assert.equal(canceled,true);
});

test('concurrent release lock refuses another run, cleans own lock on failure, never steals an interrupted lock',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'leadloom-release-test-')),lock=path.join(dir,'lock');
 try{await assert.rejects(()=>withReleaseLock(lock,async()=>{assert(existsSync(lock));await assert.rejects(()=>withReleaseLock(lock,async()=>assert.fail('Must not run concurrent release')));throw Error('synthetic release failure');}));assert(!existsSync(lock));assert.equal(await withReleaseLock(lock,async()=>true),true);}finally{rmSync(dir,{recursive:true,force:true});}
});

test('source mutation during image build refuses replacement even if runtime probes would pass',async()=>{
 const f=fixture();let n=0;f.dependencies.identify=()=>++n===1?buildId:'b'.repeat(64);await assert.rejects(()=>release(options,f.dependencies));assert.equal(f.calls.length,2);assert(!f.calls.some(c=>c.includes('up')));
});
