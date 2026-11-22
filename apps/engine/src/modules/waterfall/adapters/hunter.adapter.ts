import {BaseProviderAdapter,ProviderExecutionInput,ProviderExecutionOutput,ProviderOutcomeUnknownError} from './base-provider.adapter';
import {failure,validEmail,validInput,providerJson,ProviderTransportOptions} from './provider-transport';
export class HunterAdapter extends BaseProviderAdapter{
 readonly provider='hunter' as const;
 /** Legacy internal weight, not a current merchant quote or actual charge. */
 readonly nominalCostMicrocents=300;
 constructor(private readonly transport:ProviderTransportOptions={}){super();}
 async execute(input:ProviderExecutionInput,apiKey?:string):Promise<ProviderExecutionOutput>{
  if(!apiKey)return failure('Provider credential required; no enrichment performed');if(!validInput(input)||!input.firstName?.trim()||!input.lastName?.trim())return failure('Invalid provider input; no enrichment performed');
  const url=new URL('https://api.hunter.io/v2/email-finder');url.searchParams.set('domain',input.domain);if(input.firstName)url.searchParams.set('first_name',input.firstName);if(input.lastName)url.searchParams.set('last_name',input.lastName);
  const result=await providerJson({...this.transport,nominalCostMicrocents:this.nominalCostMicrocents},url.toString(),{method:'GET',headers:{Accept:'application/json','X-API-KEY':apiKey}});if('error'in result)return result.error;const {data,latencyMs}=result;if(!data.data||typeof data.data!=='object'||Array.isArray(data.data))throw new ProviderOutcomeUnknownError('Invalid provider response; outcome unconfirmed');const found=data.data;
  if(found?.email!=null&&!validEmail(found.email))throw new ProviderOutcomeUnknownError('Invalid provider email response; outcome unconfirmed');
  if(!found?.email)return{email:null,confidence:0,status:'miss',latencyMs,costMicrocents:this.nominalCostMicrocents,costAssumed:true};
  const score=typeof found.score==='number'&&Number.isFinite(found.score)&&found.score>=0&&found.score<=100?found.score/100:0;
  const status=found.verification?.status,verification=status==='valid'?'deliverable':status==='accept_all'?'catch_all':status==='invalid'?'undeliverable':'risky';
  return{email:found.email,confidence:score,status:'hit',verification,latencyMs,costMicrocents:this.nominalCostMicrocents,costAssumed:true};
 }
}
