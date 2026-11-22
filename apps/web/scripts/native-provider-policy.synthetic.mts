import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const root=new URL('../../../',import.meta.url).pathname,base='http://127.0.0.1:3184',dir=mkdtempSync('/tmp/leadloom-provider-policy-');
const baseline=process.argv.includes('--baseline');let browser:any,child:any;
writeFileSync(dir+'/no-external.mjs',`const real=globalThis.fetch;globalThis.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input.url??String(input));if(u.hostname==='127.0.0.1')return real(input,init);process.stderr.write('BLOCKED_EXTERNAL_AUTH_REQUEST\\n');throw Error('Synthetic provider policy blocks external network');};`);
const credentials={AUTH_GOOGLE_ID:'synthetic-google',AUTH_GOOGLE_SECRET:'synthetic-google-secret',AUTH_GITHUB_ID:'synthetic-github',AUTH_GITHUB_SECRET:'synthetic-github-secret'};
const cases=[
 {name:'disabled-with-credentials',env:{},expected:[]},
 {name:'google-only',env:{LEADLOOM_OAUTH_GOOGLE_ENABLED:'true'},expected:['google']},
 {name:'github-only',env:{LEADLOOM_OAUTH_GITHUB_ENABLED:'true'},expected:['github']},
 {name:'enabled-missing-credentials',env:{AUTH_GOOGLE_SECRET:'',AUTH_GITHUB_ID:'',LEADLOOM_OAUTH_GOOGLE_ENABLED:'true',LEADLOOM_OAUTH_GITHUB_ENABLED:'true'},expected:[]},
 {name:'password-only',env:{LEADLOOM_PASSWORD_AUTH_ENABLED:'true'},expected:['credentials']},
 {name:'both-oauth',env:{LEADLOOM_OAUTH_GOOGLE_ENABLED:'true',LEADLOOM_OAUTH_GITHUB_ENABLED:'true'},expected:['github','google']},
];
async function stop(){if(child?.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}child=undefined;}
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 for(const test of baseline?cases.slice(0,1):cases){
  let logs='';child=spawn(process.execPath,['--import',dir+'/no-external.mjs',root+'apps/web/.next/standalone/apps/web/server.js'],{cwd:root+'apps/web',env:{...process.env,...credentials,NODE_ENV:'production',PORT:'3184',HOSTNAME:'127.0.0.1',AUTH_URL:base,NEXTAUTH_URL:base,AUTH_TRUST_HOST:'true',AUTH_SECRET:'synthetic-provider-policy-secret-at-least32',ENGINE_URL:'http://127.0.0.1:4999',LEADLOOM_OAUTH_GOOGLE_ENABLED:'false',LEADLOOM_OAUTH_GITHUB_ENABLED:'false',LEADLOOM_PASSWORD_AUTH_ENABLED:'false',...test.env},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  let ready=false;for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error('Standalone exited');try{if((await fetch(base+'/api/auth/providers')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);
  const actual=Object.keys(await (await fetch(base+'/api/auth/providers')).json()).sort();
  assert.deepEqual(actual,baseline?['github','google']:test.expected.sort(),test.name+' actual registered providers');
  const page=await browser.newPage();await page.setViewport({width:1280,height:900});await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());await page.goto(base+'/login',{waitUntil:'networkidle0'});
  const buttons=await page.evaluate(()=>Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled).map(b=>b.textContent?.trim()||''));
  assert.equal(buttons.some(b=>b.includes('GitHub')),test.expected.includes('github'));assert.equal(buttons.some(b=>b.includes('Google')),test.expected.includes('google'));
  if(test.name==='disabled-with-credentials'){
   if(!baseline)for(const provider of ['google','github']){
    const result=await page.evaluate(async provider=>{const csrf=await (await fetch('/api/auth/csrf')).json();const response=await fetch('/api/auth/signin/'+provider,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'},body:new URLSearchParams({csrfToken:csrf.csrfToken,callbackUrl:location.origin+'/app'})});return {status:response.status,result:await response.json()};},provider);
    assert.equal(result.status,200);const destination=new URL(result.result.url);assert(['127.0.0.1','localhost'].includes(destination.hostname)&&destination.port==='3184','Disabled provider signin cannot redirect externally');assert(['/api/auth/signin','/login','/api/auth/error'].includes(destination.pathname),'Disabled provider signin returns only a local sign-in/error destination');console.log('PASS disabled direct '+provider+' signin -> '+destination.pathname);
   }
   await page.screenshot({path:'/downloads/leadloom-v57-provider-'+(baseline?'baseline':'disabled')+'.png',fullPage:false});
  }
  assert(!logs.includes('BLOCKED_EXTERNAL_AUTH_REQUEST'),'No external provider requests');
  console.log((baseline?'BASELINE DEFECT REPRODUCED':'PASS')+' '+test.name+': actual registered='+actual.join(',')+'; visible enabled OAuth controls match explicit policy; no external provider request');
  await page.close();await stop();
 }
}finally{await stop();await browser?.close();rmSync(dir,{recursive:true,force:true});}
