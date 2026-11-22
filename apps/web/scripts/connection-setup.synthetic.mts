import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {gunzipSync} from 'node:zlib';
import puppeteer from 'puppeteer-core';
import {encode} from 'next-auth/jwt';
import {issueSession} from '../../engine/src/modules/auth/issuer';
assert.equal(process.env.LEADLOOM_SYNTHETIC_CONNECTION_SETUP,'1');
const root=new URL('../../../',import.meta.url).pathname,url=new URL(readFileSync('/tmp/leadloom-native-db-url.txt','utf8'));
assert.equal(url.hostname,'localhost');assert(url.pathname.startsWith('/leadloom_whole_'));assert((url.searchParams.get('host')??'').startsWith('/tmp/leadloom-'));
const db=new pg.Client({connectionString:url.href}),ids=Array.from({length:27},()=>randomUUID()),uid=randomUUID(),other=randomUUID(),project=randomUUID();
const tag='QA operator '+randomUUID().slice(0,8),email='operator-'+uid+'@example.invalid',otherEmail='other-'+other+'@example.invalid';
const key=Buffer.alloc(32,49),bridge=Buffer.alloc(32,51),secret='local-platform-overview-secret-not-a-live-account';
const base='http://127.0.0.1:3198',api='http://127.0.0.1:4058';let engine:any,web:any,browser:any;const created:string[]=[];
async function stop(c:any){if(c&&c.exitCode===null)await new Promise<void>(r=>{c.once('exit',()=>r());c.kill('SIGTERM');});}
async function ready(url:string,c:any){for(let i=0;i<150;i++){if(c.exitCode!==null)throw Error('Compiled runtime exited');try{if((await fetch(url)).status===200)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Readiness timeout');}
try{
 await db.connect();assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)/10000),16);
 for(const[i,id]of ids.entries()){await db.query("INSERT INTO workspaces(id,name,is_active,created_at,updated_at)VALUES($1,$2,$3,'2026-11-22T01:02:03.654321Z',now())",[id,tag+' '+String(i+1).padStart(2,'0'),i!==26]);created.push(id);}
 for(const[id,address]of [[uid,email],[other,otherEmail]])await db.query("INSERT INTO users(id,workspace_id,email,name,role,email_verified_at,updated_at)VALUES($1,$2,$3,'Local operator fixture','admin',now(),now())",[id,ids[0],address]);
 await db.query('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1,$2,$3,$4)',[project,ids[0],'operator-proof','Concurrency Alpha']);
 const common={...process.env,NODE_ENV:'production',LEADLOOM_PLATFORM_ADMIN_EMAIL:email,LEADLOOM_NEXTAUTH_BRIDGE_SECRET:bridge.toString('base64'),LEADLOOM_WORKER_ENABLED:'false',LEADLOOM_OUTBOUND_SENDING_ENABLED:'false',LEADLOOM_GROWTH_WATCHES_ENABLED:'false',LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED:'false',LEADLOOM_RESEARCH_FETCH_ENABLED:'false',LEADLOOM_CONNECTORS_LIVE_ENABLED:'false'};
 engine=spawn(process.execPath,[root+'apps/engine/dist/main.js'],{cwd:root+'apps/engine',env:{...common,DATABASE_URL:url.href,HOST:'127.0.0.1',PORT:'4058',LEADLOOM_MASTER_KEY:Buffer.alloc(32,53).toString('base64'),LEADLOOM_SESSION_KEY:key.toString('base64'),LEADLOOM_NEXTAUTH_BRIDGE_ENABLED:'true'},stdio:['ignore','pipe','pipe']});await ready(api+'/health',engine);
 web=spawn(process.execPath,[root+'apps/web/.next/standalone/apps/web/server.js'],{cwd:root+'apps/web',env:{...common,PORT:'3198',HOSTNAME:'127.0.0.1',ENGINE_URL:api,AUTH_SECRET:secret,NEXTAUTH_SECRET:secret,AUTH_URL:base,NEXTAUTH_URL:'',NEXT_PUBLIC_APP_URL:'',LEADLOOM_PUBLIC_API_URL:'',AUTH_TRUST_HOST:'true'},stdio:['ignore','pipe','pipe']});await ready(base+'/api/health',web);
 const cookie=await encode({secret,salt:'authjs.session-token',token:{sub:uid,email,idp:'google',email_verified:true,authTime:Math.floor(Date.now()/1000)-60}});
 const result=await fetch(base+'/api/projects/'+project+'/bundle',{headers:{Cookie:'authjs.session-token='+cookie}});assert.equal(result.status,200);const tar=gunzipSync(Buffer.from(await result.arrayBuffer()));let env='',cli='';
 for(let at=0;at+512<=tar.length;){const name=tar.subarray(at,at+100).toString().split('\0')[0],size=parseInt(tar.subarray(at+124,at+136).toString().replace(/\0.*$/,''),8)||0;at+=512;if(name==='.env.local')env=tar.subarray(at,at+size).toString();if(name==='cli.mjs')cli=tar.subarray(at,at+size).toString();at+=Math.ceil(size/512)*512;}
 assert(env);const bundleUrl=/^LEADLOOM_API_URL="([^"]*)"/m.exec(env)?.[1];assert(bundleUrl);
 browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});const page=await browser.newPage();await page.setViewport({width:1440,height:1100});let external=0;await page.setRequestInterception(true);page.on('request',(r:any)=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')){external++;void r.abort();}else void r.continue();});await page.setCookie({name:'authjs.session-token',value:cookie,url:base});await page.goto(base+'/app/projects',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.innerText.includes('LEADLOOM_API_URL'));
 const expected=base+'/api/agent',uiMatchesConfigured=await page.evaluate(expected=>Array.from(document.querySelectorAll('pre')).some(e=>e.textContent?.includes('LEADLOOM_API_URL="'+expected+'"')),expected),bundleMatchesConfigured=bundleUrl===expected;
 const text=await page.evaluate(()=>document.body.innerText),recommendsUnsafeReplacement=text.includes('node cli.mjs context set'),claimsSixAutonomousSkills=text.includes('6 autonomous GTM skills');
 console.log(JSON.stringify({case:'AUTH_URL-only-public-gateway',expected,bundleUrl,uiMatchesConfigured,bundleMatchesConfigured,recommendsUnsafeReplacement,claimsSixAutonomousSkills,externalRequests:external}));assert.equal(external,0);
 if(process.env.LEADLOOM_EXPECT_CONNECTION_FIXED==='1'){assert(uiMatchesConfigured);assert(bundleMatchesConfigured);assert.equal(recommendsUnsafeReplacement,false);assert.equal(claimsSixAutonomousSkills,false);}else{assert.equal(uiMatchesConfigured,false);assert.equal(bundleMatchesConfigured,false);assert(recommendsUnsafeReplacement);assert(claimsSixAutonomousSkills);}
 if(process.env.LEADLOOM_EXPECT_CONNECTION_FIXED==='1'){
  const token=issueSession({userId:uid,workspaceId:ids[0],role:'admin'},key,3600).token;
  const issuedResponse=await fetch(api+'/agent-tokens',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name:'Local connection proof',projectId:project,scopes:['context:read','context:write'],expiresInDays:1})});assert.equal(issuedResponse.status,201);const issued=await issuedResponse.json();assert.equal(typeof issued.token,'string');assert(cli);
  const dir=mkdtempSync('/tmp/leadloom-connection-proof-');
  try{
   writeFileSync(dir+'/cli.mjs',cli);writeFileSync(dir+'/.env.local',env.replace('lld_agt_YOUR_PROJECT_BOUND_TOKEN',issued.token));
   writeFileSync(dir+'/local-only.mjs',`const native=globalThis.fetch;globalThis.fetch=(url,options)=>{if(!String(url).startsWith(${JSON.stringify(base+'/api/agent/')}))throw Error('Non-local request denied');return native(url,options);};`);
   const command=(args:string[])=>spawnSync(process.execPath,['--import',dir+'/local-only.mjs',dir+'/cli.mjs',...args],{cwd:dir,encoding:'utf8',env:{...process.env,LEADLOOM_API_URL:'',LEADLOOM_AGENT_TOKEN:'',LEADLOOM_TOOL_TOKEN:'',LEADLOOM_PROJECT_ID:''}});
   const history=command(['entries','brief']);assert.equal(history.status,0);const unsaved=command(['context','get']);assert.equal(unsaved.status,1);
   assert.equal((await fetch(base+'/api/agent/context',{headers:{Authorization:'Bearer '+issued.token}})).status,404);
   console.log(JSON.stringify({case:'actual-downloaded-cli-project-only-fresh-history',historyExit:history.status,unsavedSnapshotExit:unsaved.status,unsavedSnapshotStatus:404,workspaceToolToken:false,requestBoundary:'native local gateway only'}));
  }finally{issued.token='';rmSync(dir,{recursive:true,force:true});}
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.trim().startsWith('Concurrency Alpha')));await page.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim().startsWith('Concurrency Alpha'))as HTMLButtonElement;b.click();});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.trim()==='Download Skills Bundle'&&!b.disabled));const blocks=await page.$$('pre');assert(blocks[1]);await blocks[1].screenshot({path:'/downloads/leadloom-v81-connection-config.png'});
  const safeSnapshot=await page.evaluateHandle(()=>{const heading=Array.from(document.querySelectorAll('h2')).find(h=>h.textContent?.includes('Agent Integration & Local Setup'));return heading?.parentElement?.parentElement;});const element=safeSnapshot.asElement();assert(element);await element.screenshot({path:'/downloads/leadloom-v81-connection-header.png'});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM agent_tokens WHERE workspace_id=$1',[ids[0]])).rows[0].n,1);assert.equal(external,0);
 }
 writeFileSync('/downloads/leadloom-v81-connection-'+(process.env.LEADLOOM_EXPECT_CONNECTION_FIXED==='1'?'after':'before')+'.json',JSON.stringify({scope:'actual compiled local UI and downloaded bundle; AUTH_URL-only fixture; fixed branch additionally uses one disposable project-only credential',uiMatchesConfigured,bundleMatchesConfigured,recommendsUnsafeReplacement,claimsSixAutonomousSkills,externalRequests:external},null,2)+'\n');
}finally{if(browser)await browser.close();await stop(web);await stop(engine);if(created.length)await db.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[created]);await db.end();}
