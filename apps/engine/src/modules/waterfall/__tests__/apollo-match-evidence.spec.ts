import {it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {ApolloAdapter} from '../adapters/apollo.adapter';
import {ApolloConnector} from '../connectors/apollo.connector';
import {DAGRunnerService} from '../dag-runner.service';
import {DomainCacheService} from '../domain-cache.service';

const input={domain:'example.invalid',firstName:'Synthetic',lastName:'Fixture'};
const key='synthetic-apollo-fixture-not-a-secret';
const fixture=(person:any)=>vi.fn(async()=>new Response(JSON.stringify({person}))) as any;
const nodes=[{id:'apollo',provider:'apollo' as const,tier:1}];

it('Apollo verified email alone never proves a high-confidence person match',async()=>{
 for(const match_confidence of ['high','medium','low','none','future',undefined,null,42]){
  const person={email:'candidate@example.invalid',email_status:'verified',match_confidence};
  const runner=new DAGRunnerService();runner.registerAdapter(new ApolloAdapter({fetch:fixture(person)}));
  const result=await runner.executeRow(input,nodes,{apollo:key});
  expect(result.status,String(match_confidence)).toBe(match_confidence==='high'?'success':'exhausted');
  expect(result.value).toBe(match_confidence==='high'?person.email:null);
  const connected=await new ApolloConnector().run(input,{apiKey:key,fetch:fixture(person)});
  expect(connected.success).toBe(true);
  expect(connected.data?.matchConfidence).toBe(['high','medium','low','none'].includes(String(match_confidence))?match_confidence:'unknown');
  expect(connected.data!.confidence>=0.8).toBe(match_confidence==='high');
 }
});

it('Apollo high person confidence never upgrades unverified email deliverability',async()=>{
 for(const email_status of ['verified','extrapolated','unavailable','catchall',undefined]){
  const runner=new DAGRunnerService();runner.registerAdapter(new ApolloAdapter({fetch:fixture({email:'candidate@example.invalid',email_status,match_confidence:'high'})}));
  expect((await runner.executeRow(input,nodes,{apollo:key})).status).toBe(email_status==='verified'?'success':'exhausted');
 }
});

it('Apollo needs a bounded person identifier before any potentially charged lookup',async()=>{
 for(const bad of [{domain:input.domain},{...input,firstName:' '},{...input,lastName:''},{...input,firstName:'x'.repeat(256)}]){
  const fetch=fixture(null);
  expect((await new ApolloAdapter({fetch}).execute(bad,key)).status).toBe('error');
  expect((await new ApolloConnector().run(bad,{apiKey:key,fetch})).error?.code).toBe('INVALID_INPUT');
  expect(fetch).not.toHaveBeenCalled();
 }
 const fetch=fixture(null);
 expect((await new ApolloConnector().run({email:'known@example.invalid'},{apiKey:key,fetch})).success).toBe(true);
 expect(fetch).toHaveBeenCalledOnce();
});

it('Apollo explicitly disables personal email, phone and asynchronous provider waterfall options',async()=>{
 for(const call of [async(fetch:any)=>new ApolloAdapter({fetch}).execute(input,key),async(fetch:any)=>new ApolloConnector().run(input,{apiKey:key,fetch})]){
  const fetch=fixture(null);await call(fetch);
  const [url,options]=fetch.mock.calls[0];
  expect(url).toBe('https://api.apollo.io/api/v1/people/match');
  expect(JSON.parse(options.body)).toMatchObject({reveal_personal_emails:false,reveal_phone_number:false,run_waterfall_email:false,run_waterfall_phone:false});
  expect(String(url)).not.toContain(key);
  expect(options.redirect).toBe('manual');
 }
});

it('Apollo connector rejects malformed provider evidence rather than claiming a completed match',async()=>{
 for(const data of [{},[],{person:[]},{person:'invalid'},{person:{email:123}},{person:{email:'invalid'}},{person:{email:'x@example.invalid\r\nBcc:y@example.invalid'}}]){
  const fetch=vi.fn(async()=>new Response(JSON.stringify(data))) as any;
  const result=await new ApolloConnector().run(input,{apiKey:key,fetch});
  expect(result.success).toBe(false);expect(result.error?.code).toBe('PROVIDER_ERROR');
  expect(result.data).toBeUndefined();expect(JSON.stringify(result)).not.toContain(key);
 }
 for(const person of [null,{email:null},{first_name:'Synthetic'}])expect((await new ApolloConnector().run(input,{apiKey:key,fetch:fixture(person)})).success).toBe(true);
});

it('prior Apollo deliverability-only cache cannot bypass current identity evidence',async()=>{
 const cache=new DomainCacheService();
 const oldScope=createHash('sha256').update(JSON.stringify(['verified-provider-boundary-v2','tenant','synthetic','fixture','',''])).digest('hex');
 await cache.set('apollo',input.domain,{email:'old@example.invalid',confidence:0.95,status:'hit',verification:'deliverable',latencyMs:1,costMicrocents:100},100,undefined,oldScope);
 const fetch=fixture({email:'candidate@example.invalid',email_status:'verified',match_confidence:'low'});
 const runner=new DAGRunnerService(cache);runner.registerAdapter(new ApolloAdapter({fetch}));
 const result=await runner.executeRow({...input,workspaceId:'tenant'},nodes,{apollo:key});
 expect(fetch).toHaveBeenCalledOnce();expect(result.status).toBe('exhausted');expect(result.value).toBeNull();
});

it('current-policy Apollo cache retains only the current acceptance decision, never a prior-policy upgrade',async()=>{
 const fetch=fixture({email:'candidate@example.invalid',email_status:'verified',match_confidence:'high'});
 const runner=new DAGRunnerService(new DomainCacheService());runner.registerAdapter(new ApolloAdapter({fetch}));
 for(let i=0;i<2;i++){
  const result=await runner.executeRow({...input,workspaceId:'current-policy-tenant'},nodes,{apollo:key});
  expect(result.status).toBe('success');expect(result.value).toBe('candidate@example.invalid');
  expect(result.telemetry?.cost_microcents).toBe(i===0?100:0);
 }
 expect(fetch).toHaveBeenCalledOnce();
});

it('unsupported identifiers and misplaced confidence cannot silently change the request target',async()=>{
 const fetch=fixture(null);
 for(const bad of [{firstName:'Synthetic',lastName:'Fixture',companyName:'Ignored Company'},{email:'not-an-email'},{...input,organizationName:'bad\nname'}]){
  expect((await new ApolloConnector().run(bad as any,{apiKey:key,fetch})).error?.code).toBe('INVALID_INPUT');
 }
 expect((await new ApolloAdapter({fetch}).execute({domain:input.domain,email:'known@example.invalid'} as any,key)).status).toBe('error');
 expect(fetch).not.toHaveBeenCalled();
 const misplaced=vi.fn(async()=>new Response(JSON.stringify({match_confidence:'high',person:{email:'candidate@example.invalid',email_status:'verified'}}))) as any;
 const result=await new ApolloConnector().run(input,{apiKey:key,fetch:misplaced});
 expect(result.success).toBe(true);expect(result.data?.matchConfidence).toBe('unknown');expect(result.data?.confidence).toBe(0);
});
