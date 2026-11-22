import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {encode} from 'next-auth/jwt';
import {issueSession} from '../../engine/src/modules/auth/issuer';
assert.equal(process.env.LEADLOOM_SYNTHETIC_ADMIN_CONFIG,'1');
const root=new URL('../../../',import.meta.url).pathname,url=new URL(readFileSync('/tmp/leadloom-native-db-url.txt','utf8'));
assert.equal(url.hostname,'localhost');assert(url.pathname.startsWith('/leadloom_whole_'));assert((url.searchParams.get('host')??'').startsWith('/tmp/leadloom-'));
const db=new pg.Client({connectionString:url.href}),ws=randomUUID(),uid=randomUUID(),other=randomUUID();
const email='admin-config-'+uid+'@example.invalid',otherEmail='other-config-'+other+'@example.invalid',key=Buffer.alloc(32,39),bridge=Buffer.alloc(32,41),secret='synthetic-admin-config-secret-not-a-real-account';
const base='http://127.0.0.1:3197',api='http://127.0.0.1:4057';let engine:any,web:any;
async function stop(c:any){if(c&&c.exitCode===null)await new Promise<void>(r=>{c.once('exit',()=>r());c.kill('SIGTERM');});}
async function ready(url:string,c:any){for(let i=0;i<100;i++){if(c.exitCode!==null)throw Error('Compiled runtime exited');try{if((await fetch(url)).status===200)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Readiness timeout');}
try{
 await db.connect();assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)/10000),16);
 await db.query('INSERT INTO workspaces(id,name,updated_at)VALUES($1,$2,now())',[ws,'Disposable admin configuration proof']);
 for(const[id,address]of [[uid,email],[other,otherEmail]])await db.query("INSERT INTO users(id,workspace_id,email,name,role,email_verified_at,updated_at)VALUES($1,$2,$3,'Synthetic local administrator','admin',now(),now())",[id,ws,address]);
 for(const configured of ['',email]){
  const common={...process.env,NODE_ENV:'production',LEADLOOM_PLATFORM_ADMIN_EMAIL:configured,LEADLOOM_NEXTAUTH_BRIDGE_SECRET:bridge.toString('base64'),LEADLOOM_WORKER_ENABLED:'false',LEADLOOM_OUTBOUND_SENDING_ENABLED:'false',LEADLOOM_GROWTH_WATCHES_ENABLED:'false',LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED:'false',LEADLOOM_RESEARCH_FETCH_ENABLED:'false',LEADLOOM_CONNECTORS_LIVE_ENABLED:'false'};
  engine=spawn(process.execPath,[root+'apps/engine/dist/main.js'],{cwd:root+'apps/engine',env:{...common,DATABASE_URL:url.href,HOST:'127.0.0.1',PORT:'4057',LEADLOOM_MASTER_KEY:Buffer.alloc(32,43).toString('base64'),LEADLOOM_SESSION_KEY:key.toString('base64'),LEADLOOM_NEXTAUTH_BRIDGE_ENABLED:'true'},stdio:['ignore','pipe','pipe']});await ready(api+'/health',engine);
  web=spawn(process.execPath,[root+'apps/web/.next/standalone/apps/web/server.js'],{cwd:root+'apps/web',env:{...common,PORT:'3197',HOSTNAME:'127.0.0.1',ENGINE_URL:api,AUTH_SECRET:secret,NEXTAUTH_SECRET:secret,AUTH_URL:base,NEXTAUTH_URL:base,AUTH_TRUST_HOST:'true'},stdio:['ignore','pipe','pipe']});await ready(base+'/api/health',web);
  for(const[id,address]of [[uid,email],[other,otherEmail]]){
   const expected=Boolean(configured&&address===configured),token=issueSession({userId:id,workspaceId:ws,role:'admin'},key,3600).token;
   const r=await fetch(api+'/admin/verify',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,expected?200:403);
   const cookie=await encode({secret,salt:'authjs.session-token',token:{sub:id,email:address,idp:'google',email_verified:true,authTime:Math.floor(Date.now()/1000)-60}});
   const page=await fetch(base+'/admin',{redirect:'manual',headers:{Cookie:'authjs.session-token='+cookie}});const html=await page.text();
   if(expected){assert.equal(page.status,200);assert(html.includes('PLATFORM OPERATOR CONSOLE'));}else assert(!html.includes('PLATFORM OPERATOR CONSOLE'));
   console.log(JSON.stringify({case:configured?'explicit-identity':'empty-default',caller:id===uid?'designated-synthetic':'different-synthetic',engineStatus:r.status,webStatus:page.status,operatorHtml:html.includes('PLATFORM OPERATOR CONSOLE'),pass:true}));
  }
  await stop(web);await stop(engine);web=engine=undefined;
 }
 console.log('PASS actual compiled API+web empty/default and explicit/matching/different identities. Synthetic local verified sessions only; no OAuth delivery, Docker interpolation, admin-feature readiness or live identity configured. Identity gate proof only; operator overview data and unsupported controls are checked separately.');
}finally{await stop(web);await stop(engine);await db.query('DELETE FROM workspaces WHERE id=$1',[ws]);await db.end();}
