import {it,expect,vi,afterEach} from 'vitest';
import {safeFetch,validateAndResolveBaseUrl} from '../security';
import {DropcontactConnector} from '../dropcontact.connector';
import {TestConnectionService} from '../test-connection.service';
const live=process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;
afterEach(()=>{if(live===undefined)delete process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;else process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED=live;vi.unstubAllGlobals();});
it('bounds a transport that never resolves and aborts its signal without implicit retry',async()=>{
 let signal:AbortSignal|undefined;const fetch=vi.fn((_u:any,i:any)=>{signal=i.signal;return new Promise<Response>(()=>{});});
 const result=await Promise.race([safeFetch(fetch as any,'https://api.example.invalid',{},10).then(()=> 'accepted',e=>String(e)),new Promise<string>(r=>setTimeout(()=>r('unbounded'),100))]);expect(result).toMatch(/timed out/);expect(signal?.aborted).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
});
it('bounds a response body that never finishes and cancels its reader',async()=>{
 let canceled=false;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(Buffer.from('{'));},cancel(){canceled=true;}}),fetch=vi.fn(async()=>new Response(stream));
 const result=await Promise.race([safeFetch(fetch as any,'https://api.example.invalid',{},10).then(()=> 'accepted',e=>String(e)),new Promise<string>(r=>setTimeout(()=>r('unbounded'),100))]);expect(result).toMatch(/timed out/);expect(canceled).toBe(true);
});
it('refuses declared and streamed oversized bodies before connector JSON parsing',async()=>{
 await expect(safeFetch((async()=>new Response('{}',{headers:{'content-length':'1048577'}}))as any,'https://api.example.invalid',{})).rejects.toThrow('too large');
 await expect(safeFetch((async()=>new Response('x'.repeat(1048577)))as any,'https://api.example.invalid',{})).rejects.toThrow('too large');
});
it('keeps manual redirects and cancels error bodies without parsing or following them',async()=>{
 let canceled=false;const fetch=vi.fn(async(_u:any,_i:any)=>new Response(new ReadableStream({cancel(){canceled=true;}}),{status:302,headers:{location:'https://other.invalid'}}));
 const result=await safeFetch(fetch as any,'https://api.example.invalid',{});expect(result.status).toBe(302);expect(fetch.mock.calls[0][1].redirect).toBe('manual');expect(canceled).toBe(true);
});
it('preserves bounded JSON success and rejects invalid transport options',async()=>{
 const result=await safeFetch((async()=>new Response('{"ok":true}'))as any,'https://api.example.invalid',{},20);expect(await result.json()).toEqual({ok:true});
 await expect(safeFetch((async()=>new Response('{}'))as any,'https://api.example.invalid',{},NaN)).rejects.toThrow('timeout');
});
it('refuses credentialed URLs and nonstandard ports even on an allowed vendor host',()=>{
 expect(validateAndResolveBaseUrl('https://api.example.invalid','https://user:password@api.example.invalid').error).toBeTruthy();expect(validateAndResolveBaseUrl('https://api.example.invalid','https://api.example.invalid:444').error).toBeTruthy();
});
it('does not submit an unreceipted async Dropcontact job through global transport even with live flag on',async()=>{
 process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED='true';const fetch=vi.fn(async()=>new Response('{"success":true,"request_id":"synthetic-receipt","data":[]}'));vi.stubGlobal('fetch',fetch);
 const result=await new DropcontactConnector().run({email:'synthetic@example.invalid'},{apiKey:'synthetic-key'});expect(result.success).toBe(false);expect(result.error?.code).toBe('NOT_READY');expect(fetch).not.toHaveBeenCalled();
 const probe=await new TestConnectionService().testConnection({workspaceId:'synthetic-workspace',connectorId:'dropcontact',apiKey:'synthetic-key'});expect(probe.status).toBe('DISABLED');expect(fetch).not.toHaveBeenCalled();
});
it('propagates a connector timeout and marks an ambiguous network outcome non-retryable',async()=>{
 const {HunterConnector}=await import('../hunter.connector');let signal:AbortSignal|undefined;const fetch=vi.fn((_u:any,i:any)=>{signal=i.signal;return new Promise<Response>(()=>{});});
 const result=await new HunterConnector().run({domain:'example.invalid',firstName:'Synthetic',lastName:'Fixture'},{apiKey:'synthetic-key',fetch:fetch as any,timeoutMs:10});expect(result.success).toBe(false);expect(result.error?.retryable).toBe(false);expect(result.error?.message).toContain('outcome unconfirmed');expect(signal?.aborted).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
});
it('redacts a configured key in test-service connector exceptions and reported failures',async()=>{
 const {ConnectorRegistry}=await import('../registry');process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED='true';
 for(const throws of [false,true]){
  const registry=new ConnectorRegistry([{id:'synthetic',name:'Synthetic',capabilities:[],auth:{type:'api_key'},rateLimit:{},verification:'fixture-tested',run:async()=>{if(throws)throw Error('failure synthetic-secret-value');return{success:false,error:{code:'NETWORK_ERROR',message:'failure synthetic-secret-value'}};}}]);
  const result=await new TestConnectionService(registry).testConnection({workspaceId:'synthetic',connectorId:'synthetic',apiKey:'synthetic-secret-value',fetch:(async()=>new Response('{}'))as any});expect(JSON.stringify(result)).not.toContain('synthetic-secret-value');expect(result.message).toContain('[REDACTED]');
 }
});
