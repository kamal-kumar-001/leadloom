import {RELEASE_BUILD_ID} from '../release-identity.generated';
import {it,expect,vi} from 'vitest';
import {runtimeHealth} from '../runtime-health';
vi.mock('server-only',()=>({}));
vi.mock('../engine-server',()=>({engineBase:()=> 'http://engine.invalid'}));
it('web-to-engine health validates identity/mounted runtime; no redirects, private errors or cached success',async()=>{
 let requested:any;
 const good=async(url:any,init:any)=>{requested={url,init};return new Response(JSON.stringify({status:'ok',service:'leadloom-engine',buildId:RELEASE_BUILD_ID,mutationsEnabled:true}));};
 expect(await runtimeHealth('http://engine.invalid/',good as any)).toBe(true);expect(requested.url).toBe('http://engine.invalid/health');expect(requested.init.redirect).toBe('manual');expect(requested.init.cache).toBe('no-store');expect(requested.init.signal).toBeInstanceOf(AbortSignal);
 for(const response of [new Response('{}'),new Response(JSON.stringify({status:'ok',service:'leadloom-engine',mutationsEnabled:true,buildId:'old-build'})),new Response('<html>homepage</html>'),new Response(JSON.stringify({status:'ok',service:'another-service',mutationsEnabled:true})),new Response(JSON.stringify({status:'ok',service:'leadloom-engine',buildId:RELEASE_BUILD_ID,mutationsEnabled:false})),new Response('{}',{status:302}),new Response('x'.repeat(16385))])expect(await runtimeHealth('http://engine.invalid',async()=>response)).toBe(false);
 expect(await runtimeHealth('http://engine.invalid',async()=>{throw Error('synthetic-private-diagnostics');})).toBe(false);
});
it('health route returns a minimal no-store503on engine failure, never environment or backend diagnostics',async()=>{
 const original=global.fetch;try{
  const {GET}=await import('../../app/api/health/route');
  global.fetch=vi.fn(async()=>new Response(JSON.stringify({status:'ok',service:'leadloom-engine',buildId:RELEASE_BUILD_ID,mutationsEnabled:true})))as any;let response=await GET();expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(await response.json()).toEqual({status:'ok',service:'leadloom-web',buildId:RELEASE_BUILD_ID,engineReachable:true});
  global.fetch=vi.fn(async()=>{throw Error('synthetic-private-diagnostics');})as any;response=await GET();expect(response.status).toBe(503);expect(await response.json()).toEqual({status:'unavailable',service:'leadloom-web',buildId:RELEASE_BUILD_ID,engineReachable:false});
 }finally{global.fetch=original;}
});
it('full body deadline aborts stalled streams, not just response headers',async()=>{
 vi.useFakeTimers();let canceled=false;
 try{const result=runtimeHealth('http://engine.invalid',async(_url,init)=>new Response(new ReadableStream({start(controller){init?.signal?.addEventListener('abort',()=>controller.error(Error('aborted')));},cancel(){canceled=true;}})));await vi.advanceTimersByTimeAsync(2100);expect(await result).toBe(false);}finally{vi.useRealTimers();}
});
