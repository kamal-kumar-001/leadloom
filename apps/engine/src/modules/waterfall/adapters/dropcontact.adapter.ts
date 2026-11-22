import {BaseProviderAdapter,ProviderExecutionInput,ProviderExecutionOutput,ProviderOutcomeUnknownError} from './base-provider.adapter';
import {failure,validEmail,validInput,providerJson,ProviderTransportOptions} from './provider-transport';
export class DropcontactAdapter extends BaseProviderAdapter{
 readonly provider='dropcontact' as const;
 /** Legacy internal weight, not a current merchant quote or actual charge. */
 readonly nominalCostMicrocents=2000;
 constructor(private readonly transport:ProviderTransportOptions={}){super();}
 async execute(input:ProviderExecutionInput,apiKey?:string):Promise<ProviderExecutionOutput>{
  if(!apiKey)return failure('Provider credential required; no enrichment performed');if(!validInput(input))return failure('Invalid provider input; no enrichment performed');
  if(!this.transport.fetch)return failure('Asynchronous provider persistence is not configured; no request submitted');
  const result=await providerJson({...this.transport,nominalCostMicrocents:this.nominalCostMicrocents},'https://api.dropcontact.io/v1/enrich/all',{method:'POST',headers:{'Content-Type':'application/json','X-Access-Token':apiKey},body:JSON.stringify({data:[{first_name:input.firstName,last_name:input.lastName,website:input.domain,company:input.companyName}]})});if('error'in result)return result.error;const {data,latencyMs}=result;
  // A request ID is asynchronous acceptance, not an empty completed lookup.
  if(data.request_id&&!Array.isArray(data.data))throw new ProviderOutcomeUnknownError('Provider result pending; no completed lookup established');
  if(data.success===false||data.status==='in_progress')throw new ProviderOutcomeUnknownError('Provider result pending or failed; no completed lookup established');if(!Array.isArray(data.data))throw new ProviderOutcomeUnknownError('Invalid provider response; outcome unconfirmed');
  const email=data.data?.[0]?.email?.[0];if(email?.email!=null&&!validEmail(email.email))throw new ProviderOutcomeUnknownError('Invalid provider email response; outcome unconfirmed');
  if(!email?.email)return{email:null,confidence:0,status:'miss',latencyMs,costMicrocents:this.nominalCostMicrocents,costAssumed:true};
  // Nominative describes address identity, not verified deliverability. No delivery claim is inferred.
  return{email:email.email,confidence:email.qualification==='nominative'?0.95:0.8,status:'hit',verification:'risky',latencyMs,costMicrocents:this.nominalCostMicrocents,costAssumed:true};
 }
}
