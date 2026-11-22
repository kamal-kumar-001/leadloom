import {createApplication} from '../../../main';
import {WebsiteSignalService} from '../website-signals.service';
import {issueSession} from '../../auth/issuer';
import {randomUUID} from 'node:crypto';
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {createServer as createTlsServer} from 'node:https';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SafeWebsiteFetcher} from '../website-fetcher';
async function fixture(handler:Parameters<typeof createServer>[0]){const server=createServer(handler as any);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address()as any).port;return{server,port,close:()=>new Promise<void>(r=>{server.close(()=>r());server.closeAllConnections();})};}
it('refuses private/mixed DNS, IP literals, credential/fragment/odd-port URLs before opening a socket, resolves only once for a pinned request',async()=>{
 let connections=0,resolutions=0;const local=await fixture((_req,res)=>{connections++;res.setHeader('Content-Type','text/html');res.end('<body>Public pinned synthetic Kubernetes</body>');});
 try{
  for(const addresses of [['127.0.0.1'],['93.184.216.34','10.0.0.1'],['::1'],['::ffff:127.0.0.1'],['169.254.169.254'],[]]){const service=new SafeWebsiteFetcher({fixture:{resolve:async()=>addresses,connectTo:()=>({host:'127.0.0.1',port:local.port})}});await expect(service.fetchText('https://public.example.com')).rejects.toThrow(/safely resolved/);}expect(connections).toBe(0);
  const service=new SafeWebsiteFetcher({fixture:{resolve:async()=>{resolutions++;return resolutions===1?['93.184.216.34']:['127.0.0.1'];},connectTo:pinned=>{expect(pinned).toBe('93.184.216.34');return{host:'127.0.0.1',port:local.port};}}});const result=await service.fetchText('http://public.example.com/');expect(result.text).toContain('Kubernetes');expect(resolutions).toBe(1);expect(connections).toBe(1);
  for(const url of ['http://127.0.0.1','http://2130706433','http://[::1]','http://user:password@public.example.com','http://public.example.com:8080','http://public.example.com/#fragment','file:///etc/passwd','http://metadata.google.internal'])await expect(new SafeWebsiteFetcher({fixture:{resolve:async()=>['127.0.0.1']}}).fetchText(url)).rejects.toThrow();expect(connections).toBe(1);
 }finally{await local.close();}
});
it('same-host redirect is re-resolved/pinned, has one deadline and a three-hop/loop bound; cross-host/private redirection is refused',async()=>{
 const requests:string[]=[];const local=await fixture((req,res)=>{requests.push(req.url!);res.setHeader('Location',req.url==='/once'?'/done':req.url==='/other'?'http://private.example.com/':req.url==='/loop'?'/loop':'/chain'+requests.length);if(req.url==='/done'){res.end('Completed plain text');}else{res.statusCode=302;res.end('ignored');}});
 try{
  const options={fixture:{resolve:async()=>['93.184.216.34'],connectTo:()=>({host:'127.0.0.1',port:local.port})}},service=new SafeWebsiteFetcher(options);
  expect((await service.fetchText('http://public.example.com/once')).finalUrl).toBe('http://public.example.com/done');expect(requests).toEqual(['/once','/done']);
  await expect(service.fetchText('http://public.example.com/other')).rejects.toThrow(/another host/);const before=requests.length;await expect(service.fetchText('http://public.example.com/loop')).rejects.toThrow(/loop/);expect(requests.length-before).toBe(1);const chain=requests.length;await expect(service.fetchText('http://public.example.com/start')).rejects.toThrow(/limit/);expect(requests.length-chain).toBe(4);
  let calls=0;await expect(new SafeWebsiteFetcher({fixture:{...options.fixture,resolve:async()=>++calls===1?['93.184.216.34']:['10.0.0.2']}}).fetchText('http://public.example.com/once')).rejects.toThrow(/safely resolved/);expect(calls).toBe(2);
 }finally{await local.close();}
});
it('streams only the allowed prefix, reports truncation, filters script/style, validates type/encoding and hides raw transport diagnostics',async()=>{
 const local=await fixture((req,res)=>{if(req.url==='/large'){res.write('A'.repeat(512*1024));res.end('B'.repeat(65536));}else if(req.url==='/binary'){res.setHeader('Content-Type','application/octet-stream');res.end('not text');}else if(req.url==='/compressed'){res.setHeader('Content-Encoding','gzip');res.end('not decoded');}else{res.setHeader('Content-Type','text/html');res.end('<style>invisible</style><h1>Visible text</h1><script>hidden()</script>');}});
 try{const service=new SafeWebsiteFetcher({fixture:{resolve:async()=>['93.184.216.34'],connectTo:()=>({host:'127.0.0.1',port:local.port})}});const large=await service.fetchText('http://public.example.com/large');expect(large.truncated).toBe(true);expect(large.text).toHaveLength(512*1024);expect(large.text).not.toContain('B');expect((await service.fetchText('http://public.example.com/')).text).toBe('Visible text');await expect(service.fetchText('http://public.example.com/binary')).rejects.toThrow(/not HTML/);await expect(service.fetchText('http://public.example.com/compressed')).rejects.toThrow(/not uncompressed/);
  await expect(new SafeWebsiteFetcher({},async()=>{throw Error('synthetic-password-and-query-diagnostics');}).fetchText('https://public.example.com')).rejects.toThrow('Website fetch failed. No page analysis was confirmed.');
 }finally{await local.close();}
});
it('full-operation deadline covers stalled DNS, response headers and body, not just connect',async()=>{
 const never=()=>new Promise<string[]>(()=>{});await expect(new SafeWebsiteFetcher({timeoutMs:30,fixture:{resolve:never}}).fetchText('http://public.example.com')).rejects.toThrow(/timed out/);
 const local=await fixture((req,res)=>{if(req.url==='/body'){res.writeHead(200,{'content-type':'text/html'});res.write('partial');}});
 try{for(const path of ['/headers','/body'])await expect(new SafeWebsiteFetcher({timeoutMs:35,fixture:{resolve:async()=>['93.184.216.34'],connectTo:()=>({host:'127.0.0.1',port:local.port})}}).fetchText('http://public.example.com'+path)).rejects.toThrow(/timed out/);}finally{await local.close();}
});
it('trusted injected fetch uses the same bounded prefix, cancellation, redirect and deadline rules',async()=>{
 let canceled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(512*1024+1).fill(65));},cancel(){canceled=true;}});const result=await new SafeWebsiteFetcher({allowPrivateHosts:true},async()=>new Response(body)).fetchText('http://localhost:4567/');expect(result.truncated).toBe(true);expect(canceled).toBe(true);
 await expect(new SafeWebsiteFetcher({timeoutMs:30},async()=>new Response(new ReadableStream({start(){},cancel(){}}))).fetchText('https://public.example.com')).rejects.toThrow(/timed out/);
});
it('native HTTPS pin retains hostname certificate verification and rejects untrusted server certificates',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'leadloom-research-tls-'));execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem'),'-days','2','-subj','/CN=mail.example.test','-addext','subjectAltName=DNS:mail.example.test'],{stdio:'pipe'});const cert=readFileSync(join(directory,'cert.pem'),'utf8'),key=readFileSync(join(directory,'key.pem'),'utf8');let requests=0;
 const server=createTlsServer({cert,key},(_req,res)=>{requests++;res.end('Synthetic strict TLS page');});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address()as any).port;
 try{const options={fixture:{resolve:async()=>['93.184.216.34'],connectTo:()=>({host:'127.0.0.1',port}),ca:cert}};expect((await new SafeWebsiteFetcher(options).fetchText('https://mail.example.test')).text).toBe('Synthetic strict TLS page');await expect(new SafeWebsiteFetcher({...options,fixture:{...options.fixture,ca:undefined}}).fetchText('https://mail.example.test')).rejects.toThrow(/fetch failed/);await expect(new SafeWebsiteFetcher(options).fetchText('https://other.example.test')).rejects.toThrow(/fetch failed/);expect(requests).toBe(1);}finally{await new Promise<void>(r=>{server.close(()=>r());server.closeAllConnections();});rmSync(directory,{recursive:true,force:true});}
});

it('authenticated actual research route composes pinned transport and heuristic analysis, failed private resolution returns no analysis/storage receipt',async()=>{
 let calls=0;const local=await fixture((_req,res)=>{calls++;res.setHeader('Content-Type','text/html');res.end('<body>Kubernetes careers Docker</body>');}),key=Buffer.alloc(32,8),token=issueSession({workspaceId:randomUUID(),userId:randomUUID(),role:'read_only'},key,3600).token;
 let privateDns=false;const fetcher=new SafeWebsiteFetcher({fixture:{resolve:async()=>privateDns?['127.0.0.1']:['93.184.216.34'],connectTo:()=>({host:'127.0.0.1',port:local.port})}}),app=await createApplication({sessionKey:key,websiteSignals:new WebsiteSignalService(),websiteFetcher:fetcher}as any);
 try{const server=app.getHttpAdapter().getInstance(),request=()=>server.inject({method:'POST',url:'/research/website-signals',headers:{authorization:'Bearer '+token},payload:{url:'http://public.example.com/'}});const ok=await request();expect(ok.statusCode).toBe(200);expect(ok.json().signals.techKeywords).toEqual(['Kubernetes','Docker']);expect(ok.json().input).toBe('fetched_url');expect(ok.json().signals.summary).toBeNull();expect(ok.json().signals.confidence).toBeNull();privateDns=true;const blocked=await request();expect(blocked.statusCode).toBe(422);expect(blocked.json().status).toBe('FETCH_FAILED');expect(blocked.json().signals).toBeUndefined();expect(blocked.json().rowId).toBeUndefined();expect(calls).toBe(1);}finally{await app.close();await local.close();}
});
