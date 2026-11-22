import type {Connector,ConnectorCapability,ConnectorContext,ConnectorResult} from './connector.interface';
import {validateAndResolveBaseUrl,resolveFetch,redactSecrets,safeFetch,checkRedirectResponse} from './security';
import {APOLLO_BASIC_LOOKUP_OPTIONS,parseApolloEvidence,validApolloLookup,type ApolloPersonEvidence} from '../apollo-evidence';

export interface ApolloInput{
 domain?:string;firstName?:string;lastName?:string;organizationName?:string;email?:string;
}
export interface ApolloPersonOutput extends ApolloPersonEvidence{}
const DEFAULT_BASE_URL='https://api.apollo.io';

/** Official people/match contract, fixture-tested only. No live execution claim. */
export class ApolloConnector implements Connector<ApolloInput,ApolloPersonOutput>{
 readonly id='apollo';readonly name='Apollo.io';
 readonly capabilities:ConnectorCapability[]=['person_enrich','company_enrich'];
 readonly auth={type:'custom_header' as const,headerName:'X-Api-Key',description:'Apollo API key'};
 readonly rateLimit={requestsPerMinute:600,concurrency:10};
 readonly verification='fixture-tested' as const;
 async run(input:ApolloInput,ctx:ConnectorContext):Promise<ConnectorResult<ApolloPersonOutput>>{
  if(!ctx.apiKey)return{success:false,error:{code:'MISSING_CREDENTIAL',message:'Apollo API key not configured',retryable:false}};
  if(!validApolloLookup(input))return{success:false,error:{code:'INVALID_INPUT',message:'Provide a bounded email address or first and last names plus employer',retryable:false}};
  const baseCheck=validateAndResolveBaseUrl(DEFAULT_BASE_URL,ctx.baseUrl);
  if(baseCheck.error)return{success:false,error:baseCheck.error};
  const fetchCheck=resolveFetch(ctx);
  if(fetchCheck.error||!fetchCheck.fetchFn)return{success:false,error:fetchCheck.error};
  const start=Date.now();
  try{
   const response=await safeFetch(fetchCheck.fetchFn,baseCheck.url+'/api/v1/people/match',{
    method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','X-Api-Key':ctx.apiKey},
    body:JSON.stringify({domain:input.domain,first_name:input.firstName,last_name:input.lastName,organization_name:input.organizationName,email:input.email,...APOLLO_BASIC_LOOKUP_OPTIONS}),
   },ctx.timeoutMs);
   const latencyMs=Date.now()-start,redirectErr=checkRedirectResponse(response);
   if(redirectErr)return{success:false,latencyMs,error:redirectErr};
   if(!response.ok)return{success:false,latencyMs,error:{code:response.status===429?'RATE_LIMITED':'PROVIDER_ERROR',status:response.status,message:response.status===429?'Apollo rate limit reached':'Apollo HTTP '+response.status,retryable:response.status===429||response.status>=500}};
   const evidence=parseApolloEvidence(await response.json());
   if(!evidence)return{success:false,latencyMs,error:{code:'PROVIDER_ERROR',message:'Invalid Apollo person response',retryable:false}};
   return{success:true,latencyMs,data:evidence,raw:{emailStatus:evidence.emailStatus,matchConfidence:evidence.matchConfidence,confidence:evidence.confidence}};
  }catch(err){
   return{success:false,latencyMs:Date.now()-start,error:{code:'NETWORK_ERROR',message:redactSecrets(err instanceof Error?err.message:'Unknown network failure',[ctx.apiKey]),retryable:false}};
  }
 }
}
