#!/usr/bin/env node
import {sourceIdentity} from './build-identity.mjs';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,rmdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const plan=[
 'Inspect resolved Compose configuration without printing environment values.',
 'Build api and web images. No automatic git pull or checkout.',
 'Start configured database/cache services, apply migrations with the new api image, then verify migration status and schema presence.',
 'Replace api/web services, then check engine liveness, exact worker/send posture, worker readiness, web-to-engine connectivity and the public health route.',
 'Stop on failure. No automatic rollback, data reset, image prune or send-gate change.',
];
export function parseArgs(args){
 const result={execute:false,worker:'unmounted',sending:false,backupReference:''};
 for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==='--execute')result.execute=true;
  else if(a==='--expect-worker'){const v=args[++i];if(!['mounted','unmounted'].includes(v))throw Error('Use --expect-worker mounted or unmounted');result.worker=v;}
  else if(a==='--expect-sending'){const v=args[++i];if(!['true','false'].includes(v))throw Error('Use --expect-sending true or false');result.sending=v==='true';}
  else if(a==='--backup-reference'){result.backupReference=args[++i]??'';if(!/^[^\x00-\x1f]{1,500}$/.test(result.backupReference))throw Error('Supply a nonempty backup reference without control characters');}
  else if(a==='--help')return {...result,help:true};
  else throw Error('Unknown option. Use --help.');
 }
 if(result.execute&&!result.backupReference)throw Error('Execute requires --backup-reference for an independently verified recoverable backup. This script cannot verify that backup.');
 return result;
}
export function inspectConfig(config,expected){
 const services=config?.services,api=services?.api,web=services?.web;
 if(!api||!web||!services?.postgres||!services?.redis)throw Error('Required Compose application services missing');
 const env=api.environment??{},webEnv=web.environment??{};
 const enabled=v=>v==='true'||v===true;
 const worker=enabled(env.LEADLOOM_WORKER_ENABLED)?'mounted':'unmounted',sending=enabled(env.LEADLOOM_OUTBOUND_SENDING_ENABLED);
 if(worker!==expected.worker||sending!==expected.sending)throw Error('Configured worker/send posture differs from the explicit expected state. No gate was changed.');
 if(sending&&worker!=='mounted')throw Error('Sending is configured without a worker. Refusing ambiguous release posture.');
 for(const name of ['DATABASE_URL','LEADLOOM_MASTER_KEY','LEADLOOM_SESSION_KEY'])if(typeof env[name]!=='string'||!env[name])throw Error('Engine runtime settings incomplete; values are never printed.');
 if(!webEnv.AUTH_SECRET)throw Error('Web session secret is missing');
 if(enabled(env.LEADLOOM_PASSWORD_AUTH_ENABLED)&&(!enabled(env.LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED)||!env.LEADLOOM_RESEND_API_KEY||!env.LEADLOOM_EMAIL_FROM))throw Error('Password authentication requires configured transactional email. Delivery is not verified by this check.');
 if(enabled(env.LEADLOOM_NEXTAUTH_BRIDGE_ENABLED)&&(!env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET||webEnv.LEADLOOM_NEXTAUTH_BRIDGE_SECRET!==env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET))throw Error('Web/engine bridge configuration does not match');
 const port=(service,target)=>{
  const ports=service.ports??[],match=ports.filter(p=>typeof p==='object'&&Number(p.target)===target&&['127.0.0.1','::1'].includes(p.host_ip));
  if(match.length!==1||!/^\d{1,5}$/.test(String(match[0].published)))throw Error('Application health probes require one explicit loopback published port per service');
  const n=Number(match[0].published);if(n<1||n>65535)throw Error('Invalid published application port');
  return 'http://'+(match[0].host_ip==='::1'?'[::1]':'127.0.0.1')+':'+n;
 };
 const origin=new URL(env.APP_BASE_URL??'');
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('APP_BASE_URL must be an HTTPS origin without credentials, path, query or fragment');
 return{engine:port(api,4000),web:port(web,3000),public:origin.origin,worker,sending};
}
export async function fetchHealth(url,fetcher=fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
 try{
  const response=await fetcher(url,{signal:controller.signal,redirect:'manual',cache:'no-store'});
  if(!response.body)throw Error('Missing response body');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384)throw Error('Health response too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return{status:response.status,body};
 }finally{clearTimeout(timer);}
}
export function checkProbe(kind,result,posture){
 if(kind==='worker'){
  if(posture.worker==='mounted')return result.status===200&&result.body?.status==='ready'&&result.body?.workers==='mounted'&&result.body?.sendingEnabled===posture.sending;
  return result.status===503&&result.body?.status==='not-ready'&&result.body?.workers==='not-mounted';
 }
 if(result.status!==200||!posture.buildId||result.body?.buildId!==posture.buildId)return false;
 if(kind==='engine')return result.body?.status==='ok'&&result.body?.service==='leadloom-engine'&&result.body?.mutationsEnabled===true&&result.body?.worker===posture.worker&&result.body?.outboundSendingEnabled===posture.sending;
 return result.body?.status==='ok'&&result.body?.service==='leadloom-web'&&result.body?.engineReachable===true;
}
export async function release(options,{run,identify=()=>sourceIdentity(root).buildId,probe=fetchHealth,wait=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}={}){
 if(!options.execute){log('PLAN ONLY. No command, network request or file change was performed.');for(const p of plan)log(p);return{executed:false};}
 if(!options.backupReference)throw Error('Independently verified backup reference required before execute');
 if(!run)throw Error('Command executor required');
 let phase='configuration',migrated=false,replaced=false;
 const compose=['compose','--profile','application'];
 const command=(args,timeout=120000)=>run('docker',[...compose,...args],timeout);
 try{
  const configured=command(['config','--format','json']);let config;try{config=JSON.parse(configured);}catch{throw Error('Compose configuration was not valid JSON');}
  const posture={...inspectConfig(config,options),buildId:identify()};if(!/^[a-f0-9]{64}$/.test(posture.buildId))throw Error('Source identity unavailable');log('Configuration checked. Credentials are not printed.');
  phase='image build';command(['build','api','web'],900000);if(identify()!==posture.buildId)throw Error('Source changed during image build');log('Images built. Running application services are not yet replaced.');
  phase='database/cache startup';command(['up','-d','--wait','--wait-timeout','120','postgres','redis'],150000);
  phase='migration';command(['run','--rm','--no-deps','-T','api','npx','prisma','migrate','deploy','--schema','packages/database/prisma/schema.prisma']);migrated=true;
  phase='migration verification';command(['run','--rm','--no-deps','-T','api','npx','prisma','migrate','status','--schema','packages/database/prisma/schema.prisma']);
  phase='schema verification';command(['run','--rm','--no-deps','-T','api','node','scripts/ops/db-schema-preflight.mjs']);log('Migration history and schema column presence checked. This does not prove data or constraint compatibility.');
  phase='application replacement';command(['up','-d','api','web']);replaced=true;
  const checks=[['engine',posture.engine+'/health'],['worker',posture.engine+'/ready'],['web',posture.web+'/api/health'],['public',posture.public+'/api/health']];
  for(const [kind,url]of checks){phase=kind+' health verification';let ok=false;for(let n=0;n<30;n++){try{if(checkProbe(kind,await probe(url),posture)){ok=true;break;}}catch{}if(n<29)await wait(2000);}if(!ok)throw Error('Health state was not confirmed');log(kind+' probe matched the expected state.');}
  log('Application release probes passed for source build '+posture.buildId+'. Worker: '+posture.worker+'. Sending enabled: '+posture.sending+'.');
  if(posture.worker==='unmounted')log('The send worker is intentionally not ready; no send-readiness claim is made.');
  log('Login/OAuth/email delivery, provider budgets/consent, real sends and production recovery are not verified. No automatic cleanup was performed.');
  return{executed:true,migrated,replaced,posture};
 }catch{
  // Commands may partly take effect even on failure. Never imply automatic rollback.
  log('RELEASE NOT VERIFIED. Failed during '+phase+'. '+(migrated?'Migrations were applied; ':'Migration state may require inspection; ')+(replaced?'application replacement was requested.':'application replacement was not confirmed.'));
  log('No automatic rollback, reset, gate change or cleanup was attempted. Inspect the current state and the independently verified backup before another release.');
  throw Error('Release stopped; verification incomplete');
 }
}
function run(command,args,timeout){
 const result=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:8*1024*1024});
 // Tool output can contain credentials. It is never forwarded to a terminal or report.
 if(result.status!==0||result.error)throw Error('Command failed');return result.stdout;
}
export async function withReleaseLock(directory,action){
 try{mkdirSync(directory,{mode:0o700});}catch{throw Error('Release lock already exists or cannot be acquired. Inspect any active/interrupted release before retrying.');}
 try{return await action();}finally{rmdirSync(directory);}
}
export async function main(args=process.argv.slice(2)){
 try{
  const options=parseArgs(args);
  if(options.help){console.log('Usage: bash update.sh [--execute --backup-reference REFERENCE] [--expect-worker mounted|unmounted] [--expect-sending true|false]\nDefault is a plan only. Execute only for an independently approved release and verified backup. Defaults expect an unmounted worker and sending disabled. Existing environment values are never changed.');return;}
  if(options.execute&&!existsSync(path.join(root,'.env')))throw Error('Missing .env. Nothing was created or changed.');
  if(options.execute)await withReleaseLock(path.join(root,'.leadloom-release.lock'),()=>release(options,{run}));else await release(options,{run});
 }catch(error){console.error(error instanceof Error?error.message:'Release failed');process.exitCode=1;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
