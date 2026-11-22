import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {PrismaClient} from '@leadloom/database';
import {PrismaCredentialRepository} from '../../engine/src/modules/vault/prisma-credential.repository';
import {gunzipSync} from 'node:zlib';
import puppeteer from 'puppeteer-core';
import {encode} from 'next-auth/jwt';
import {issueSession} from '../../engine/src/modules/auth/issuer';
assert.equal(process.env.LEADLOOM_SYNTHETIC_PROVIDER_KEYS,'1');
const root=new URL('../../../',import.meta.url).pathname,url=new URL(readFileSync('/tmp/leadloom-native-db-url.txt','utf8'));
assert.equal(url.hostname,'localhost');assert(url.pathname.startsWith('/leadloom_whole_'));assert((url.searchParams.get('host')??'').startsWith('/tmp/leadloom-'));
const db=new pg.Client({connectionString:url.href}),ids=Array.from({length:27},()=>randomUUID()),uid=randomUUID(),other=randomUUID(),project=randomUUID();
const tag='QA operator '+randomUUID().slice(0,8),email='operator-'+uid+'@example.invalid',otherEmail='other-'+other+'@example.invalid';
const key=Buffer.alloc(32,49),bridge=Buffer.alloc(32,51),secret='local-platform-overview-secret-not-a-live-account';
const base='http://127.0.0.1:3198',api='http://127.0.0.1:4058';let engine:any,web:any,browser:any,nativePrisma:any;const created:string[]=[];
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
 const human=issueSession({userId:uid,workspaceId:ids[0],role:'admin'},key,3600).token,headers={Authorization:'Bearer '+human,'Content-Type':'application/json'};
 const create=async(label:string,ending:string)=>{const response=await fetch(api+'/vault/credentials',{method:'POST',headers,body:JSON.stringify({provider:'openai',apiKey:'native-only-fixture-'+randomUUID()+ending,label})});assert.equal(response.status,200);return await response.json();};
 const old=await create('Older saved fixture','OLD1'),newest=await create('Newest saved fixture','NEW2');
 await db.query("UPDATE byok_credentials SET created_at='2026-11-20T00:00:00Z',updated_at='2026-11-22T00:00:00Z',is_valid=true,last_verified_at='2026-11-20T01:00:00Z' WHERE id=$1 AND workspace_id=$2",[old.id,ids[0]]);
 await db.query("UPDATE byok_credentials SET created_at='2026-11-21T00:00:00Z',updated_at='2026-11-21T00:00:00Z',is_valid=false,last_verified_at=NULL WHERE id=$1 AND workspace_id=$2",[newest.id,ids[0]]);
 nativePrisma=new PrismaClient({datasources:{db:{url:url.href}}});const repository=new PrismaCredentialRepository(nativePrisma),chosen=await repository.findLatestByProvider(ids[0],'openai');assert.equal(chosen?.id,newest.id);assert.equal(chosen?.isValid,false);
 const listed=await(await fetch(api+'/vault/credentials',{headers})).json();assert.equal(listed[0].id,newest.id);assert.equal(listed[1].id,old.id);
 const registry=await(await fetch(api+'/waterfall/connectors',{headers})).json();const status=registry.connectors.find((c:any)=>c.id==='openai');assert(status);
 const cookie=await encode({secret,salt:'authjs.session-token',token:{sub:uid,email,idp:'google',email_verified:true,authTime:Math.floor(Date.now()/1000)-60}});
 browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});const page=await browser.newPage();await page.setViewport({width:1440,height:1100});let external=0,mode='normal',browserSaves=0,otherMutations=0;
 await page.setRequestInterception(true);page.on('request',(request:any)=>{const u=request.url();if(!u.startsWith(base)&&!u.startsWith('data:')&&!u.startsWith('blob:')){external++;void request.abort();return;}
 if(u.startsWith(base)&&new URL(u).pathname.startsWith('/api/engine')&&request.method()!=='GET'){if(new URL(u).pathname==='/api/engine/vault/credentials'&&request.method()==='POST')browserSaves++;else{otherMutations++;void request.abort();return;}}
 if(request.method()==='GET'&&u.startsWith(base)&&new URL(u).pathname==='/api/engine/vault/credentials'){
 if(mode==='failed'){void request.respond({status:503,contentType:'application/json',body:'{}'});return;}
 if(mode==='malformed'){void request.respond({status:200,contentType:'application/json',body:JSON.stringify([{id:'invalid'}])});return;}
 }void request.continue();});
 await page.setCookie({name:'authjs.session-token',value:cookie,url:base});
 const card=()=>page.evaluate(()=>Array.from(document.querySelectorAll('h3')).find(h=>h.textContent?.trim()==='OpenAI')?.closest('.group')?.textContent??'');
 const reload=()=>page.goto(base+'/app/connectors',{waitUntil:'networkidle0'});
 await reload();let text=await card();assert(text.includes('NEW2'));assert(text.includes('Key saved (unverified)'));assert(!text.includes('OLD1'));assert(!text.includes('Connected'));assert.equal(status.maskedKey,newest.maskedKey);assert.equal(status.verified,false);
 console.log(JSON.stringify({case:'current-native-selection-matches-list-registry-and-card',newestUnverifiedSelected:true,olderUpdatedVerifiedCannotOverride:true,externalRequests:external}));
 for(const failure of ['failed','malformed']){mode=failure;await reload();text=await card();assert(text.includes('Key metadata unavailable'));assert(!text.includes('Not Configured'));assert(!text.includes('NEW2'));assert(!text.includes('OLD1'));const disabled=await page.evaluate(()=>Array.from(document.querySelectorAll('h3')).find(h=>h.textContent?.trim()==='OpenAI')?.closest('.group')?.querySelector('button')?.disabled);assert(disabled);console.log(JSON.stringify({case:failure+'-metadata-is-unavailable-not-empty',oldKeysCleared:true,keyChangesDisabled:true}));if(failure==='failed'){await page.screenshot({path:'/downloads/leadloom-v83-keys-unavailable.png'});const target=await page.evaluateHandle(()=>Array.from(document.querySelectorAll('h3')).find(h=>h.textContent?.trim()==='OpenAI')?.closest('.group'));await target.asElement()!.screenshot({path:'/downloads/leadloom-v83-keys-unavailable-card.png'});}}
 mode='normal';await page.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Reload metadata')as HTMLButtonElement;if(b)b.click();});await page.waitForFunction(()=>document.body.innerText.includes('NEW2'));assert((await card()).includes('Key saved (unverified)'));
 const high=old.id>newest.id?old:newest,low=old.id>newest.id?newest:old;
 await db.query("UPDATE byok_credentials SET created_at='2026-11-22T00:00:00.000111Z',is_valid=false,last_verified_at=NULL WHERE id=$1",[high.id]);
 await db.query("UPDATE byok_credentials SET created_at='2026-11-22T00:00:00.000222Z',is_valid=false,last_verified_at=NULL WHERE id=$1",[low.id]);
 const check=async(expected:any)=>{assert.equal((await repository.findLatestByProvider(ids[0],'openai'))?.id,expected.id);const rows=await(await fetch(api+'/vault/credentials',{headers})).json();assert.equal(rows[0].id,expected.id);const reg=await(await fetch(api+'/waterfall/connectors',{headers})).json();assert.equal(reg.connectors.find((c:any)=>c.id==='openai').maskedKey,expected.maskedKey);await reload();assert((await card()).includes(expected.maskedKey));return rows;};
 const micros=await check(low);assert.equal(micros[0].createdAt,micros[1].createdAt);console.log(JSON.stringify({case:'submillisecond-native-order-survives-identical-serialized-times',selectedLowerIdNewerNativeTimestamp:true}));
 await db.query("UPDATE byok_credentials SET created_at='2026-11-22T00:00:00.000222Z' WHERE id=ANY($1::uuid[])",[[high.id,low.id]]);await check(high);console.log(JSON.stringify({case:'exact-native-timestamp-tie',repositoryListRegistryCardAgree:true,nativeIdDescending:true}));
 await db.query("UPDATE byok_credentials SET created_at='2026-12-31T00:00:00Z' WHERE id=$1",[high.id]);await check(high);
 await page.evaluate(()=>{const root=Array.from(document.querySelectorAll('h3')).find(h=>h.textContent?.trim()==='OpenAI')?.closest('.group');(root?.querySelector('button')as HTMLButtonElement)?.click();});await page.waitForSelector('[role=dialog] input[type=password]');await page.type('[role=dialog] input[type=password]','native-ui-only-'+randomUUID()+'SAVE');await page.click('[role=dialog] button[type=submit]');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));await page.waitForFunction(mask=>Array.from(document.querySelectorAll('h3')).find(h=>h.textContent?.trim()==='OpenAI')?.closest('.group')?.textContent?.includes(mask),{},high.maskedKey);assert.equal(browserSaves,1);assert.equal((await db.query('SELECT count(*)::int AS n FROM byok_credentials WHERE workspace_id=$1',[ids[0]])).rows[0].n,3);
 console.log(JSON.stringify({case:'save-refetches-authoritative-current-selection',newStoredRowNotBlindlyPromoted:true,browserFixtureSaves:browserSaves}));
 await db.query("UPDATE byok_credentials SET is_valid=true,last_verified_at='2026-11-20T01:00:00Z' WHERE id=$1",[high.id]);await check(high);text=await card();assert(text.includes('Last test passed'));assert(text.includes('Not a live connection check'));assert(!text.includes('Connected'));await page.screenshot({path:'/downloads/leadloom-v83-key-records.png'});const target=await page.evaluateHandle(()=>Array.from(document.querySelectorAll('h3')).find(h=>h.textContent?.trim()==='OpenAI')?.closest('.group'));await target.asElement()!.screenshot({path:'/downloads/leadloom-v83-key-records-card.png'});assert.equal(external,0);assert.equal(otherMutations,0);
 writeFileSync('/downloads/leadloom-v83-key-selection-after.json',JSON.stringify({scope:'actual compiled native PostgreSQL/API/browser, encrypted fake fixture keys only; providers disabled',currentSelectionMatches:true,failedAndMalformedUnavailable:true,nativeSubmillisecondOrder:true,deterministicExactTies:true,saveRefetchesCanonical:true,historicalTestNotLiveConnection:true,browserFixtureSaves:browserSaves,otherBrowserMutations:otherMutations,externalRequests:external},null,2)+'\n');
}finally{if(browser)await browser.close();if(nativePrisma)await nativePrisma.$disconnect();await stop(web);await stop(engine);if(created.length)await db.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[created]);await db.end();}
