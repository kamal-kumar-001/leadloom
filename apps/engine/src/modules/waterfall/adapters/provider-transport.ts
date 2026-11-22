import {ProviderOutcomeUnknownError,type ProviderExecutionOutput} from './base-provider.adapter';
export interface ProviderTransportOptions {fetch?:typeof fetch;timeoutMs?:number;nominalCostMicrocents?:number}
export const failure=(message:string,latencyMs=0,status:'error'|'rate_limited'='error'):ProviderExecutionOutput=>({email:null,confidence:0,status,latencyMs,costMicrocents:0,errorMessage:message});
export const validEmail=(value:unknown):value is string=>typeof value==='string'&&value.length<=320&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export const validInput=(input:any)=>typeof input?.domain==='string'&&input.domain.length<=253&&/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(input.domain)&&['firstName','lastName','companyName','title'].every(k=>input[k]===undefined||(typeof input[k]==='string'&&input[k].length<=255));
/** Fixed vendor URLs only. Injected transports are a test seam, never request input.
 * Once submitted, an unknown outcome must reach the durable worker as uncertain.
 * An answered error has unverified billing, never a measured zero-charge claim.
 */
export async function providerJson(options:ProviderTransportOptions,url:string,init:RequestInit):Promise<{data:any;latencyMs:number}|{error:ProviderExecutionOutput}>{
 if(!options.fetch&&process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED!=='true')return{error:failure('Live provider calls disabled; no enrichment performed')};
 const start=Date.now(),controller=new AbortController(),timeout=Math.max(1,Math.min(options.timeoutMs??10000,30000));const timer=setTimeout(()=>controller.abort(),timeout);
 const answeredFailure=(message:string,status:'error'|'rate_limited'='error')=>({error:{...failure(message,Date.now()-start,status),costMicrocents:options.nominalCostMicrocents??0,costAssumed:true}});
 try{
  const response=await(options.fetch??globalThis.fetch)(url,{...init,redirect:'manual',signal:controller.signal});const latencyMs=Date.now()-start;
  if(response.type==='opaqueredirect'||response.status>=300&&response.status<400){await response.body?.cancel();return answeredFailure('Provider redirect blocked; no redirect followed');}
  if(!response.ok){await response.body?.cancel();return answeredFailure(response.status===429?'Provider rate limit reached':'Provider HTTP '+response.status,response.status===429?'rate_limited':'error');}
  if(Number(response.headers.get('content-length'))>1048576){await response.body?.cancel();throw new ProviderOutcomeUnknownError('Provider response too large; outcome unconfirmed');}
  const reader=response.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader){try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1048576){await reader.cancel();throw new ProviderOutcomeUnknownError('Provider response too large; outcome unconfirmed');}chunks.push(part.value);}}finally{reader.releaseLock();}}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new ProviderOutcomeUnknownError('Invalid provider response; outcome unconfirmed');return{data,latencyMs:Date.now()-start};
 }catch(err){if(err instanceof ProviderOutcomeUnknownError)throw err;throw new ProviderOutcomeUnknownError(controller.signal.aborted?'Provider request timed out; outcome unconfirmed':'Provider response failed; outcome unconfirmed');}finally{clearTimeout(timer);}
}
