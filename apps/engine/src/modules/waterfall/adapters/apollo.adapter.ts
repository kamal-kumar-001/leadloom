import {BaseProviderAdapter,ProviderExecutionInput,ProviderExecutionOutput,ProviderOutcomeUnknownError} from './base-provider.adapter';
import {failure,validInput,providerJson,ProviderTransportOptions} from './provider-transport';
import {APOLLO_BASIC_LOOKUP_OPTIONS,parseApolloEvidence,validApolloLookup} from '../apollo-evidence';
export class ApolloAdapter extends BaseProviderAdapter{
 readonly provider='apollo' as const;
 /** Legacy internal weight, not a current merchant quote or actual charge. */
 readonly nominalCostMicrocents=100;
 constructor(private readonly transport:ProviderTransportOptions={}){super();}
 async execute(input:ProviderExecutionInput,apiKey?:string):Promise<ProviderExecutionOutput>{
  if(!apiKey)return failure('Provider credential required; no enrichment performed');
  if(!validInput(input)||!validApolloLookup({domain:input.domain,firstName:input.firstName,lastName:input.lastName,organizationName:input.companyName}))return failure('Bounded person names and employer required; no enrichment performed');
  const result=await providerJson({...this.transport,nominalCostMicrocents:this.nominalCostMicrocents},'https://api.apollo.io/api/v1/people/match',{
   method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','X-Api-Key':apiKey},
   body:JSON.stringify({domain:input.domain,first_name:input.firstName,last_name:input.lastName,organization_name:input.companyName,...APOLLO_BASIC_LOOKUP_OPTIONS}),
  });
  if('error'in result)return result.error;
  const {data,latencyMs}=result,evidence=parseApolloEvidence(data);
  if(!evidence)throw new ProviderOutcomeUnknownError('Invalid provider response; outcome unconfirmed');
  if(!evidence.email)return{email:null,confidence:0,status:'miss',latencyMs,costMicrocents:this.nominalCostMicrocents,costAssumed:true};
  return{email:evidence.email,confidence:evidence.confidence,status:'hit',verification:evidence.emailStatus==='verified'?'deliverable':'risky',latencyMs,costMicrocents:this.nominalCostMicrocents,costAssumed:true};
 }
}
