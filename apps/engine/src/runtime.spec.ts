import {describe,it,expect} from 'vitest';
import {createApplication} from './main';
describe('Actual NestJS Fastify runtime',()=>{
 it('boots and serves health, but fails readiness honestly without mounted services',async()=>{
  const app=await createApplication();
  try {
   const fastify=app.getHttpAdapter().getInstance();
   const health=await fastify.inject({method:'GET',url:'/health'});
   expect(health.statusCode).toBe(200);expect(health.json().mutationsEnabled).toBe(false);
   expect(health.json().routes).toEqual({provisioning:'unmounted',entitlements:'not_enforced',mutations:'unmounted',loginIssuer:'unmounted',unsubscribe:'unmounted',waterfall:'unmounted',validator:'unmounted',research:'unmounted'});
   const ready=await fastify.inject({method:'GET',url:'/ready'});expect(ready.statusCode).toBe(503);
   const mutation=await fastify.inject({method:'POST',url:'/outbound/send',payload:{}});expect(mutation.statusCode).toBe(404);
  } finally {await app.close();}
 });
 it('starts a provided worker after init, reports ready, and stops it on close',async()=>{
  let started=0,stopped=0;
  const worker={start:()=>{started++;},stop:()=>{stopped++;}};
  const sessionKey=Buffer.alloc(32,9);
  const app=await createApplication({sessionKey,credentials:{} as any,outbound:{} as any,outboundWorker:worker,outboundSendingEnabled:false});
  try {
   expect(started).toBe(1);
   const fastify=app.getHttpAdapter().getInstance();
   const ready=await fastify.inject({method:'GET',url:'/ready'});
   expect(ready.statusCode).toBe(200);
   expect(ready.json()).toEqual({status:'ready',workers:'mounted',sendingEnabled:false});
   const health=await fastify.inject({method:'GET',url:'/health'});
   expect(health.json().worker).toBe('mounted');
   expect(health.json().outboundSendingEnabled).toBe(false);
  } finally {await app.close();}
  expect(stopped).toBe(1);
 });
});
