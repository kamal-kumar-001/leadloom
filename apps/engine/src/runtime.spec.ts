import {describe,it,expect} from 'vitest';
import {createApplication} from './main';
describe('Actual NestJS Fastify runtime',()=>{
 it('boots and serves health, but fails readiness honestly without mounted services',async()=>{
  const app=await createApplication();
  try {
   const fastify=app.getHttpAdapter().getInstance();
   const health=await fastify.inject({method:'GET',url:'/health'});
   expect(health.statusCode).toBe(200);expect(health.json().mutationsEnabled).toBe(false);
   expect(health.json().routes).toEqual({mutations:'unmounted',loginIssuer:'unmounted',unsubscribe:'unmounted',waterfall:'unmounted',validator:'unmounted'});
   const ready=await fastify.inject({method:'GET',url:'/ready'});expect(ready.statusCode).toBe(503);
   const mutation=await fastify.inject({method:'POST',url:'/outbound/send',payload:{}});expect(mutation.statusCode).toBe(404);
  } finally {await app.close();}
 });
});
