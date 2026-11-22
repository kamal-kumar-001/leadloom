import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import puppeteer from 'puppeteer-core';
import {encode} from 'next-auth/jwt';
import {issueSession} from '../../engine/src/modules/auth/issuer';
assert.equal(process.env.LEADLOOM_SYNTHETIC_DASHBOARD_RECORDS,'1');
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
 await db.query('INSERT INTO projects(id,workspace_id,slug,name)VALUES($1,$2,$3,$4)',[project,ids[0],'operator-proof','Private project must stay absent from operator metadata']);
 const common={...process.env,NODE_ENV:'production',LEADLOOM_PLATFORM_ADMIN_EMAIL:email,LEADLOOM_NEXTAUTH_BRIDGE_SECRET:bridge.toString('base64'),LEADLOOM_WORKER_ENABLED:'false',LEADLOOM_OUTBOUND_SENDING_ENABLED:'false',LEADLOOM_GROWTH_WATCHES_ENABLED:'false',LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED:'false',LEADLOOM_RESEARCH_FETCH_ENABLED:'false',LEADLOOM_CONNECTORS_LIVE_ENABLED:'false'};
 engine=spawn(process.execPath,[root+'apps/engine/dist/main.js'],{cwd:root+'apps/engine',env:{...common,DATABASE_URL:url.href,HOST:'127.0.0.1',PORT:'4058',LEADLOOM_MASTER_KEY:Buffer.alloc(32,53).toString('base64'),LEADLOOM_SESSION_KEY:key.toString('base64'),LEADLOOM_NEXTAUTH_BRIDGE_ENABLED:'true'},stdio:['ignore','pipe','pipe']});await ready(api+'/health',engine);
 web=spawn(process.execPath,[root+'apps/web/.next/standalone/apps/web/server.js'],{cwd:root+'apps/web',env:{...common,PORT:'3198',HOSTNAME:'127.0.0.1',ENGINE_URL:api,AUTH_SECRET:secret,NEXTAUTH_SECRET:secret,AUTH_URL:base,NEXTAUTH_URL:base,AUTH_TRUST_HOST:'true'},stdio:['ignore','pipe','pipe']});await ready(base+'/api/health',web);
 browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage();await page.setViewport({width:1440,height:1100});
 let mode='normal',held:any,external=0;
 await page.setRequestInterception(true);page.on('request',(r:any)=>{
  const u=r.url();if(!u.startsWith(base)&&!u.startsWith('data:')&&!u.startsWith('blob:')){external++;void r.abort();return;}
  if(mode==='projects-fail'&&new URL(u).pathname==='/api/engine/projects'){void r.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Local project read failure'})});return;}
  if(u.includes('/api/engine/workspace/summary')){
   if(mode==='summary-fail'){void r.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Local summary read failure'})});return;}
   if(mode==='summary-malformed'){void r.respond({status:200,contentType:'application/json',body:JSON.stringify({tables:-1,mailboxes:0,campaigns:0,suppressions:0,experiments:0,providerKeys:0})});return;}
   if(mode==='hold-summary'){mode='normal';held=r;return;}
  }void r.continue();
 });
 const cookie=await encode({secret,salt:'authjs.session-token',token:{sub:uid,email,idp:'google',email_verified:true,authTime:Math.floor(Date.now()/1000)-60}});await page.setCookie({name:'authjs.session-token',value:cookie,url:base});
 const fixture=(await db.query('SELECT (SELECT count(*)::int FROM projects WHERE workspace_id=$1) AS projects,(SELECT count(*)::int FROM agent_tokens WHERE workspace_id=$1) AS tokens',[ids[0]])).rows[0];assert.deepEqual(fixture,{projects:1,tokens:0});
 await page.goto(base+'/app',{waitUntil:'domcontentloaded'});
 const status=async(id:string,text:string)=>page.waitForFunction((id,text)=>document.querySelector('[data-testid="setup-'+id+'"]')?.textContent?.includes(text),{},id,text);
 const refresh=async()=>{await page.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Refresh workspace records');if(!b)throw Error('No records refresh');b.click();});};
 await status('projects','Saved record');await status('keys','No saved record');assert((await page.$eval('[data-testid="setup-record-progress"]',e=>e.textContent??'')).includes('1 of 4'));assert.equal(await page.$eval('[role="progressbar"]',e=>e.getAttribute('aria-valuenow')),'25');assert((await page.$eval('[data-testid="setup-projects"]',e=>e.textContent??'')).includes('not agent access'));
 await page.screenshot({path:'/downloads/leadloom-v79-dashboard-records.png',fullPage:true});
 console.log('PASS actual compiled dashboard: one native project, zero native agent tokens, only project record present; no agent-token readiness claim');
 mode='projects-fail';await refresh();await status('projects','Unavailable');await status('keys','No saved record');assert.equal(await page.$('[role="progressbar"]'),null);assert((await page.$eval('[data-testid="setup-record-progress"]',e=>e.textContent??'')).includes('1 unconfirmed'));
 console.log('PASS failed project read is unavailable, not no project, while valid independent summary still reports actual stored zeroes');
 mode='summary-fail';await refresh();await status('projects','Saved record');await status('keys','Unavailable');assert.equal(await page.$('[role="progressbar"]'),null);assert(!(await page.evaluate(()=>document.body.innerText)).includes('No provider keys saved'));assert((await page.$eval('[data-testid="setup-record-progress"]',e=>e.textContent??'')).includes('3 unconfirmed'));
 await page.screenshot({path:'/downloads/leadloom-v79-dashboard-unavailable.png',fullPage:true});
 mode='summary-malformed';const malformedResponse=page.waitForResponse(r=>r.url().includes('/api/engine/workspace/summary'));await refresh();await malformedResponse;await new Promise(r=>setTimeout(r,50));await status('projects','Saved record');await status('keys','Unavailable');assert.equal(await page.$('[role="progressbar"]'),null);assert.equal(await page.$$eval('[data-testid="workspace-record-checklist"] [aria-valuenow]',e=>e.length),0);
 mode='normal';await refresh();await status('keys','No saved record');await status('projects','Saved record');
 mode='hold-summary';await refresh();for(let i=0;i<100&&!held;i++)await new Promise(r=>setTimeout(r,10));assert(held);await status('keys','Loading');assert.equal(await page.$('[role="progressbar"]'),null);
 await refresh();await status('keys','No saved record');await status('projects','Saved record');await held.respond({status:200,contentType:'application/json',body:JSON.stringify({tables:99,mailboxes:99,campaigns:99,suppressions:99,experiments:99,providerKeys:99})});await new Promise(r=>setTimeout(r,200));await status('keys','No saved record');assert.equal(await page.$eval('[role="progressbar"]',e=>e.getAttribute('aria-valuenow')),'25');assert.equal(external,0);
 console.log('PASS failed/malformed summary removes prior statuses, zero-state CTA and completion percentage; loading is unconfirmed; delayed old response cannot overwrite newer native zeroes');
 writeFileSync('/downloads/leadloom-v79-dashboard-native.json',JSON.stringify({scope:'actual compiled dashboard with disposable local native records and browser-only read fault injection',nativeFixture:fixture,proof:['project presence never proves agent token','independent project/summary failures stay unconfirmed','malformed negative count rejected','loading removes previous completion state','stale prior response cannot overwrite fresh snapshot','optional records are not a readiness score'],externalRequests:external,readOnlyDashboard:true},null,2)+'\n');
}finally{if(browser)await browser.close();await stop(web);await stop(engine);if(created.length)await db.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[created]);await db.end();}
