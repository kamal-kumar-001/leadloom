import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import puppeteer from 'puppeteer-core';
import {encode} from 'next-auth/jwt';
import {issueSession} from '../../engine/src/modules/auth/issuer';
assert.equal(process.env.LEADLOOM_SYNTHETIC_PROJECT_CONCURRENCY,'1');
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
 web=spawn(process.execPath,[root+'apps/web/.next/standalone/apps/web/server.js'],{cwd:root+'apps/web',env:{...common,PORT:'3198',HOSTNAME:'127.0.0.1',ENGINE_URL:api,AUTH_SECRET:secret,NEXTAUTH_SECRET:secret,AUTH_URL:base,NEXTAUTH_URL:base,AUTH_TRUST_HOST:'true'},stdio:['ignore','pipe','pipe']});await ready(base+'/api/health',web);
 const sessionToken=issueSession({userId:uid,workspaceId:ids[0],role:'admin'},key,3600).token;
 const headers={Authorization:'Bearer '+sessionToken,'Content-Type':'application/json'};
 const nativeProjects=await(await fetch(api+'/projects',{headers})).json();assert.equal(nativeProjects.length,1);
 const alpha=nativeProjects[0].name,beta='Concurrency Beta '+randomUUID().slice(0,5);
 browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});const page=await browser.newPage();await page.setViewport({width:1440,height:1100});
 let holdProjects=false,holdIssue=false,heldProject:any,heldIssue:any,external=0,handlerError:unknown;
 await page.setRequestInterception(true);page.on('request',(r:any)=>{void(async()=>{try{
  const u=r.url();if(!u.startsWith(base)&&!u.startsWith('data:')&&!u.startsWith('blob:')){external++;await r.abort();return;}
  const path=new URL(u).pathname;
  if(holdProjects&&r.method()==='GET'&&path==='/api/engine/projects'){holdProjects=false;heldProject=r;return;}
  if(holdIssue&&r.method()==='POST'&&path==='/api/engine/agent-tokens'){holdIssue=false;const response=await fetch(api+'/agent-tokens',{method:'POST',headers,body:r.postData()});assert.equal(response.status,201);heldIssue={request:r,status:response.status,data:await response.json()};return;}
  await r.continue();
 }catch(error){handlerError=error;try{await r.abort();}catch{}}})();});
 const cookie=await encode({secret,salt:'authjs.session-token',token:{sub:uid,email,idp:'google',email_verified:true,authTime:Math.floor(Date.now()/1000)-60}});await page.setCookie({name:'authjs.session-token',value:cookie,url:base});
 const click=async(label:string,prefix=false)=>{await page.waitForFunction((label,prefix)=>Array.from(document.querySelectorAll('button')).some((b:any)=>(prefix?b.textContent?.trim().startsWith(label):b.textContent?.trim()===label)&&!b.disabled),{},label,prefix);await page.evaluate((label,prefix)=>{const b=Array.from(document.querySelectorAll('button')).find(b=>prefix?b.textContent?.trim().startsWith(label):b.textContent?.trim()===label)as HTMLButtonElement;if(!b)throw Error('Button absent');b.click();},label,prefix);};
 const selected=()=>page.evaluate((names:string[])=>{const text=document.querySelector('[data-testid="project-work-record"] p')?.textContent??'';return names.filter(n=>text.startsWith(n+':'));},[alpha,beta]);
 await page.goto(base+'/app/projects',{waitUntil:'domcontentloaded'});await click(alpha,true);await click('Refresh');
 // Allow this ordinary refresh to settle, then hold the next real response at the network boundary.
 await page.waitForFunction(alpha=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.trim().startsWith(alpha)),{},alpha);
 holdProjects=true;await click('Refresh');for(let i=0;i<100&&!heldProject;i++)await new Promise(r=>setTimeout(r,10));assert(heldProject);
 await click('New Project');await page.type('#new-project-name',beta);await click('Create Project');await page.waitForFunction(beta=>document.querySelector('[data-testid="project-work-record"] p')?.textContent?.startsWith(beta+':'),{},beta);
 const before=await selected();assert(before.some(n=>n?.startsWith(beta)));
 const unsaved='Private unsaved Beta entry retained through older refresh';await page.type('[aria-label="Entry detail"]',unsaved);
 await heldProject.respond({status:200,contentType:'application/json',body:JSON.stringify(nativeProjects)});await new Promise(r=>setTimeout(r,150));
 const after=await selected(),keptCreatedProject=after.some(n=>n?.startsWith(beta));const unsavedEditorRetained=await page.$eval('[aria-label="Entry detail"]',(e:any,text)=>e.value===text,unsaved).catch(()=>false);
 await page.screenshot({path:'/downloads/leadloom-v80-project-refresh-'+(process.env.LEADLOOM_EXPECT_CONCURRENCY_FIXED==='1'?'after':'before')+'.png',fullPage:false});
 console.log(JSON.stringify({case:'older-project-refresh-after-real-create',nativeCreated:(await db.query('SELECT count(*)::int AS n FROM projects WHERE workspace_id=$1 AND name=$2',[ids[0],beta])).rows[0].n,keptCreatedProject,selectedReturnedToAlpha:after.some(n=>n?.startsWith(alpha))}));
 // Fresh page, then actually issue an Alpha credential while delaying only its browser response.
 await page.goto(base+'/app/projects',{waitUntil:'domcontentloaded'});await click(alpha,true);await click('Issue Token');await page.waitForSelector('#token-name');await page.click('#token-name',{clickCount:3});await page.keyboard.type('Concurrency Alpha credential');
 holdIssue=true;await click('Issue Context Credential');for(let i=0;i<150&&!heldIssue&&!handlerError;i++)await new Promise(r=>setTimeout(r,10));if(handlerError)throw handlerError;assert(heldIssue);
 await click(beta,true);assert.equal(await page.$('[data-testid="token-reveal-card"]'),null);const switchedRaw=heldIssue.data.token;
 await heldIssue.request.respond({status:heldIssue.status,contentType:'application/json',body:JSON.stringify(heldIssue.data)});heldIssue.data.token='';await new Promise(r=>setTimeout(r,150));
 const lateRevealAfterSwitch=Boolean(await page.$('[data-testid="token-reveal-card"]')),switchedSecretRendered=await page.evaluate(raw=>document.body.innerText.includes(raw),switchedRaw);const nativeTokenCount=(await db.query('SELECT count(*)::int AS n FROM agent_tokens WHERE workspace_id=$1',[ids[0]])).rows[0].n;assert.equal(nativeTokenCount,1);assert.equal(external,0);
 // Never screenshot a raw credential. The boolean is enough for this before/after proof.
 console.log(JSON.stringify({case:'real-token-issued-then-project-switched-before-response',nativeTokenCount,lateRevealAfterSwitch,externalRequests:external}));
 if(process.env.LEADLOOM_EXPECT_CONCURRENCY_FIXED==='1'){assert.equal(keptCreatedProject,true);assert.equal(unsavedEditorRetained,true);assert.equal(lateRevealAfterSwitch,false);assert.equal(switchedSecretRendered,false);await page.screenshot({path:'/downloads/leadloom-v80-project-token-scope.png',fullPage:false});const notice=await page.$('[data-testid="credential-scope-notice"]');assert(notice);await notice.screenshot({path:'/downloads/leadloom-v80-token-scope-notice.png'});}
 else{assert.equal(keptCreatedProject,false);assert.equal(lateRevealAfterSwitch,true);}
 // Issue another real credential, learn its metadata through a fresh read, then revoke before its old creation response arrives.
 if(await page.$('[data-testid="token-reveal-card"]'))await click('Dismiss & Hide');
 await page.goto(base+'/app/projects',{waitUntil:'domcontentloaded'});await click(alpha,true);await click('Issue Agent Token');await page.waitForSelector('#token-name');await page.click('#token-name',{clickCount:3});const revokedName='Concurrency revoked credential';await page.keyboard.type(revokedName);
 heldIssue=null;holdIssue=true;await click('Issue Context Credential');for(let i=0;i<150&&!heldIssue&&!handlerError;i++)await new Promise(r=>setTimeout(r,10));if(handlerError)throw handlerError;assert(heldIssue);
 await click('Refresh');await page.waitForFunction(name=>Array.from(document.querySelectorAll('tbody tr')).some(r=>r.textContent?.includes(name)),{},revokedName);
 await page.evaluate(name=>{const row=Array.from(document.querySelectorAll('tbody tr')).find(r=>r.textContent?.includes(name));const button=Array.from(row?.querySelectorAll('button')??[]).find(b=>b.textContent?.trim()==='Revoke');if(!button)throw Error('Missing owned revoke target');button.click();},revokedName);await click('Revoke Token');
 await page.waitForFunction(name=>Array.from(document.querySelectorAll('tbody tr')).some(r=>r.textContent?.includes(name)&&r.textContent?.includes('Revoked')),{},revokedName);
 const nativeRevoked=Boolean((await db.query('SELECT revoked_at FROM agent_tokens WHERE id=$1 AND workspace_id=$2',[heldIssue.data.id,ids[0]])).rows[0].revoked_at);assert(nativeRevoked);
 await heldIssue.request.respond({status:heldIssue.status,contentType:'application/json',body:JSON.stringify(heldIssue.data)});heldIssue.data.token='';await new Promise(r=>setTimeout(r,150));
 const lateRevealAfterRevocation=Boolean(await page.$('[data-testid="token-reveal-card"]')),metadataStillRevoked=await page.evaluate(name=>{const rows=Array.from(document.querySelectorAll('tbody tr')).filter(r=>r.textContent?.includes(name));return rows.length===1&&rows.every(r=>r.textContent?.includes('Revoked'));},revokedName);
 console.log(JSON.stringify({case:'creation-response-after-confirmed-native-revocation',nativeRevoked,lateRevealAfterRevocation,metadataStillRevoked}));
 if(process.env.LEADLOOM_EXPECT_CONCURRENCY_FIXED==='1'){assert.equal(lateRevealAfterRevocation,false);assert.equal(metadataStillRevoked,true);await page.waitForSelector('[data-testid="credential-scope-notice"]');await page.screenshot({path:'/downloads/leadloom-v80-token-revoked-race.png',fullPage:false});const notice=await page.$('[data-testid="credential-scope-notice"]');assert(notice);await notice.screenshot({path:'/downloads/leadloom-v80-token-revoked-notice.png'});}else{assert.equal(lateRevealAfterRevocation,true);assert.equal(metadataStillRevoked,false);}
 // Positive control: unchanged selection still reveals the one-time credential, then explicit hide/revoke clears it.
 if(await page.$('[data-testid="token-reveal-card"]'))await click('Dismiss & Hide');
 await click('Issue Agent Token');await page.waitForSelector('#token-name');await page.click('#token-name',{clickCount:3});const normalName='Concurrency normal credential';await page.keyboard.type(normalName);
 const normalResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/engine/agent-tokens'&&r.request().method()==='POST');await click('Issue Context Credential');const normalPayload=await(await normalResponse).json();assert.equal(typeof normalPayload.token,'string');await page.waitForSelector('[data-testid="token-reveal-card"]');
 assert((await page.$eval('[data-testid="token-reveal-card"]',e=>e.textContent??'')).includes(normalName));
 const normalAccepted=(await fetch(api+'/agent/context/entries',{headers:{Authorization:'Bearer '+normalPayload.token}})).status;assert.equal(normalAccepted,200);
 const secretInBrowserStorage=await page.evaluate(raw=>[window.localStorage,window.sessionStorage].some(store=>Object.keys(store).some(k=>(store.getItem(k)??'').includes(raw))),normalPayload.token);assert.equal(secretInBrowserStorage,false);
 await click('Dismiss & Hide');assert.equal(await page.$('[data-testid="token-reveal-card"]'),null);assert.equal(await page.evaluate(raw=>document.body.innerText.includes(raw),normalPayload.token),false);
 await page.evaluate(name=>{const row=Array.from(document.querySelectorAll('tbody tr')).find(r=>r.textContent?.includes(name));const button=Array.from(row?.querySelectorAll('button')??[]).find(b=>b.textContent?.trim()==='Revoke');if(!button)throw Error('Missing normal revoke target');button.click();},normalName);await click('Revoke Token');await page.waitForFunction(name=>Array.from(document.querySelectorAll('tbody tr')).some(r=>r.textContent?.includes(name)&&r.textContent?.includes('Revoked')),{},normalName);
 const normalRevoked=(await fetch(api+'/agent/context/entries',{headers:{Authorization:'Bearer '+normalPayload.token}})).status;assert.equal(normalRevoked,401);normalPayload.token='';assert.equal(external,0);
 console.log(JSON.stringify({case:'normal-current-selection-positive-control',normalAccepted,secretInBrowserStorage,dismissCleared:true,normalRevoked}));
 const effects=(await db.query('SELECT (SELECT count(*)::int FROM agent_tokens WHERE workspace_id=$1) AS tokens,(SELECT count(*)::int FROM agent_tokens WHERE workspace_id=$1 AND revoked_at IS NOT NULL) AS revoked_tokens,(SELECT count(*)::int FROM campaigns WHERE workspace_id=$1) AS campaigns,(SELECT count(*)::int FROM outbound_jobs WHERE workspace_id=$1) AS jobs',[ids[0]])).rows[0];assert.deepEqual(effects,{tokens:3,revoked_tokens:2,campaigns:0,jobs:0});
 writeFileSync('/downloads/leadloom-v80-project-concurrency'+(process.env.LEADLOOM_EXPECT_CONCURRENCY_FIXED==='1'?'-after':'-before')+'.json',JSON.stringify({scope:'actual compiled local API/web with owned native fixtures and delayed actual response delivery',keptCreatedProject,unsavedEditorRetained,lateRevealAfterSwitch,switchedSecretRendered,firstIssuedTokenCount:nativeTokenCount,nativeRevoked,lateRevealAfterRevocation,metadataStillRevoked,normalAccepted,secretInBrowserStorage,dismissCleared:true,normalRevoked,effects,externalRequests:external,rawTokensLoggedOrArchived:false},null,2)+'\n');
}finally{if(browser)await browser.close();await stop(web);await stop(engine);if(created.length)await db.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[created]);await db.end();}
