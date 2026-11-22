import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
import {resolvePublic} from '../mailbox-connect/host-policy';
export interface FetchResult{finalUrl:string;text:string;truncated:boolean}
const MAX_BYTES=512*1024;
type Options={allowPrivateHosts?:boolean;timeoutMs?:number;fixture?:{resolve?:(host:string)=>Promise<string[]>;connectTo?:(pinned:string)=>{host:string;port:number};ca?:string}};
/** Arbitrary URL research is opt-in at runtime. Production connects only to a validated pinned public address. */
export class SafeWebsiteFetcher{
 constructor(private readonly opts:Options={},private readonly fixtureFetch?:typeof fetch){}
 private parse(raw:string){
  let url:URL;try{url=new URL(raw);}catch{throw Error('Invalid website URL');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||url.toString().length>2048)throw Error('Use an http(s) website URL without credentials or fragment');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if(!this.opts.allowPrivateHosts&&(isIP(host)!==0||url.port&&url.port!==(url.protocol==='https:'?'443':'80')))throw Error('Website must use a public DNS hostname on its standard HTTP(S) port');
  return url;
 }
 async fetchText(rawUrl:string):Promise<FetchResult>{
  const controller=new AbortController(),timeout=Math.max(1,Math.min(this.opts.timeoutMs??10000,30000)),timer=setTimeout(()=>controller.abort(),timeout);
  const deadline=<T>(operation:Promise<T>)=>new Promise<T>((resolve,reject)=>{const abort=()=>reject(Error('Website fetch timed out'));if(controller.signal.aborted)return abort();controller.signal.addEventListener('abort',abort,{once:true});operation.then(resolve,reject).finally(()=>controller.signal.removeEventListener('abort',abort));});
  try{
   let url=this.parse(rawUrl);const initial=url,seen=new Set<string>();
   for(let redirect=0;redirect<=3;redirect++){
    if(seen.has(url.href))throw Error('Website redirect loop blocked');seen.add(url.href);
    let response:{status:number;location?:string;body:Buffer;truncated:boolean;contentType:string};
    if(this.fixtureFetch){
     // Trusted constructor injection only. Never selected by an HTTP request or production main.
     const res=await deadline(this.fixtureFetch(url.href,{redirect:'manual',signal:controller.signal,headers:{accept:'text/html,text/plain;q=0.8','accept-encoding':'identity'}}));
     const location=res.headers.get('location')??undefined,contentType=res.headers.get('content-type')??'';
     if(res.status>=300&&res.status<400||!res.ok){await res.body?.cancel();response={status:res.status,location,body:Buffer.alloc(0),truncated:false,contentType};}
     else{
      const reader=res.body?.getReader(),chunks:Buffer[]=[];let size=0,truncated=false;
      if(reader)try{while(true){const part=await deadline(reader.read());if(part.done)break;const available=MAX_BYTES-size;if(part.value.byteLength>available){chunks.push(Buffer.from(part.value.subarray(0,available)));truncated=true;break;}chunks.push(Buffer.from(part.value));size+=part.value.byteLength;}}finally{await reader.cancel().catch(()=>{});}
      response={status:res.status,location,body:Buffer.concat(chunks),truncated,contentType};
     }
    }else{
     const host=url.hostname.replace(/^\[|\]$/g,'');
     const pinned=this.opts.allowPrivateHosts?host:await deadline(resolvePublic(host,this.opts.fixture?.resolve));
     if(!pinned)throw Error('Website host could not be safely resolved');
     response=await deadline(this.request(url,pinned,controller.signal));
    }
    if(response.status>=300&&response.status<400){
     if(redirect===3||!response.location)throw Error('Website redirect limit reached');
     const next=this.parse(new URL(response.location,url).href);
     if(next.hostname!==initial.hostname||initial.protocol==='https:'&&next.protocol!=='https:')throw Error('Website redirects to another host or insecure protocol are blocked');
     url=next;continue;
    }
    if(response.status<200||response.status>=300)throw Error('Website HTTP response was not successful');
    if(response.contentType&&!/^(text\/(html|plain)|application\/xhtml\+xml)(?:;|$)/i.test(response.contentType))throw Error('Website response is not HTML or plain text');
    const text=response.body.toString('utf8').replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/gi,' ').replace(/\s+/g,' ').trim();
    return{finalUrl:url.href,text,truncated:response.truncated};
   }
   throw Error('Website redirect limit reached');
  }catch(error){
   if(controller.signal.aborted)throw Error('Website fetch timed out');
   const message=error instanceof Error?error.message:'';
   if(/^(Invalid website|Use an http|Website (must|redirect|host could|HTTP response|response is))/.test(message))throw Error(message);
   throw Error('Website fetch failed. No page analysis was confirmed.');
  }finally{clearTimeout(timer);controller.abort();}
 }
 private request(url:URL,pinned:string,signal:AbortSignal):Promise<{status:number;location?:string;body:Buffer;truncated:boolean;contentType:string}>{
  return new Promise((resolve,reject)=>{
   const fixture=this.opts.fixture?.connectTo?.(pinned),host=url.hostname.replace(/^\[|\]$/g,'');
   const request=(url.protocol==='https:'?httpsRequest:httpRequest)({protocol:url.protocol,hostname:fixture?.host??pinned,port:fixture?.port??(url.port||undefined),method:'GET',path:url.pathname+url.search,agent:false,signal,headers:{Host:url.host,Accept:'text/html,text/plain;q=0.8','Accept-Encoding':'identity'},...(url.protocol==='https:'?{servername:host,rejectUnauthorized:true,minVersion:'TLSv1.2' as const,...(this.opts.fixture?.ca?{ca:this.opts.fixture.ca}:{})}:{}),maxHeaderSize:16384},res=>{
    const status=res.statusCode??0,location=res.headers.location,contentType=String(res.headers['content-type']??''),chunks:Buffer[]=[];let size=0,settled=false;
    const done=(truncated=false)=>{if(settled)return;settled=true;resolve({status,location,contentType,body:Buffer.concat(chunks),truncated});};
    res.on('error',error=>{if(!settled)reject(error);});
    if(status<200||status>=300){done();res.destroy();return;}
    if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();reject(Error('Website response is not uncompressed HTML or plain text'));return;}
    res.on('data',(chunk:Buffer)=>{const available=MAX_BYTES-size;if(chunk.length>available){chunks.push(chunk.subarray(0,available));done(true);res.destroy();request.destroy();return;}chunks.push(chunk);size+=chunk.length;});
    res.on('end',()=>done());
    res.on('aborted',()=>{if(!settled)reject(Error('Website response interrupted'));});
   });
   request.on('error',reject);request.end();
  });
 }
}
