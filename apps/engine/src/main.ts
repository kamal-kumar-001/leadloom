import 'reflect-metadata';
import { PrismaClient } from '@leadloom/database';
import { verifySession } from './modules/auth/session';
import { canWrite } from './modules/auth/rbac';
import { issueSession } from './modules/auth/issuer';
import { verifyPassword } from './modules/auth/password';
import type { UserDirectory } from './modules/auth/user-directory';
import { PrismaUserDirectory } from './modules/auth/user-directory';
import { verifyUnsubscribeToken } from './modules/outbound/transport/unsubscribe';
import { CredentialService } from './modules/vault/credential.service';
import { VaultService } from './modules/vault/vault.service';
import { PrismaCredentialRepository } from './modules/vault/prisma-credential.repository';
import { AtomicDispatchRepository } from './modules/outbound/atomic-dispatch.repository';
import { PrismaDispatchDatabase } from './modules/outbound/prisma-database';
import { z } from 'zod';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

class RuntimeModule {}
Module({})(RuntimeModule);

/**
 * Minimal real Nest/Fastify runtime, no mock-success mutation endpoints.
 * Auth, persistence and queue lifecycle must be mounted before those endpoints
 * can be exposed. Health explicitly reports dependency state as unconfigured.
 */
export interface RuntimeServices {
 credentials: Pick<CredentialService,'save'|'list'|'delete'>;
 outbound: Pick<AtomicDispatchRepository,'enqueue'|'suppress'>;
 sessionKey: Buffer;
 userDirectory?: UserDirectory;
 unsubscribeKey?: Buffer;
}
export async function createApplication(services?:RuntimeServices) {
 const app=await NestFactory.create<NestFastifyApplication>(RuntimeModule,new FastifyAdapter({bodyLimit:65536}),{logger:['error','warn']});
 const fastify=app.getHttpAdapter().getInstance();
 if(services) {
  const authorize=(request:any,reply:any,write=false)=>{
   try {
    const token=String(request.headers.authorization??'').replace(/^Bearer /,'');
    const claims=verifySession(token,services.sessionKey);
    if(write && !canWrite(claims)) {reply.code(403).send({error:'Read-only workspace role'});return null;}
    return claims;
   } catch {reply.code(401).send({error:'Authentication required'});return null;}
  };
  fastify.get('/vault/credentials',async(request:any,reply:any)=>{
   const session=authorize(request,reply);if(!session)return;
   return services.credentials.list(session.workspaceId);
  });
  fastify.post('/vault/credentials',async(request:any,reply:any)=>{
   const session=authorize(request,reply,true);if(!session)return;
   try{return await services.credentials.save(session.workspaceId,request.body);}
   catch{return reply.code(400).send({error:'Credential could not be saved'});}
  });
  fastify.delete('/vault/credentials/:id',async(request:any,reply:any)=>{
   const session=authorize(request,reply,true);if(!session)return;
   const id=z.string().uuid().safeParse(request.params.id);
   if(!id.success)return reply.code(400).send({error:'Invalid credential ID'});
   return {deleted:await services.credentials.delete(session.workspaceId,id.data)};
  });
  const Enqueue=z.object({campaignId:z.string().uuid(),recipientEmail:z.string().email(),idempotencyKey:z.string().min(1).max(255),stepNumber:z.number().int().positive(),scheduledAt:z.iso.datetime()}).strict();
  fastify.post('/outbound/jobs',async(request:any,reply:any)=>{
   const session=authorize(request,reply,true);if(!session)return;
   const parsed=Enqueue.safeParse(request.body);
   if(!parsed.success)return reply.code(400).send({error:'Invalid job request'});
   try {
    const id=await services.outbound.enqueue({...parsed.data,workspaceId:session.workspaceId,scheduledAt:new Date(parsed.data.scheduledAt)});
    return reply.code(202).send({id,status:'pending',sendingEnabled:false});
   } catch {return reply.code(400).send({error:'Job could not be queued'});}
  });
  fastify.post('/outbound/suppressions',async(request:any,reply:any)=>{
   const session=authorize(request,reply,true);if(!session)return;
   const email=z.object({email:z.string().email()}).strict().safeParse(request.body);
   if(!email.success)return reply.code(400).send({error:'Invalid suppression request'});
   await services.outbound.suppress(session.workspaceId,email.data.email);return {suppressed:true};
  });
  // RFC 8058 one-click unsubscribe. Public by design: no session, no cookies,
  // no redirect, secured only by the HMAC token in the signed link. Mounted
  // only when an unsubscribe signing key is configured. GET never mutates
  // (link-scanner/prefetch safe); POST performs the suppression.
  if(services.unsubscribeKey) {
   const UQuery=z.object({w:z.string().uuid(),c:z.string().uuid(),e:z.string().email().max(320),t:z.string().min(10).max(256)}).strict();
   const verifyU=(q:{w:string;c:string;e:string;t:string})=>verifyUnsubscribeToken({workspaceId:q.w,campaignId:q.c,recipientEmail:q.e,signingKey:services.unsubscribeKey!},q.t);
   fastify.get('/outbound/unsubscribe',async(request:any,reply:any)=>{
    const parsed=UQuery.safeParse(request.query);
    if(!parsed.success||!verifyU(parsed.data)) return reply.code(400).type('text/plain').send('Invalid unsubscribe link');
    return reply.type('text/html').send('<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding:3rem"><p>Confirm unsubscribe for '+parsed.data.e.replace(/[<>&"]/g,'')+'</p><form method="post"><button type="submit" style="padding:.75rem 2rem">Unsubscribe</button></form></body></html>');
   });
   fastify.post('/outbound/unsubscribe',async(request:any,reply:any)=>{
    const parsed=UQuery.safeParse(request.query);
    if(!parsed.success||!verifyU(parsed.data)) return reply.code(400).type('text/plain').send('Invalid unsubscribe link');
    await services.outbound.suppress(parsed.data.w,parsed.data.e);
    return reply.code(200).type('text/plain').send('Unsubscribed');
   });
  }
  // Planned login issuer (PRD users.password_hash). Mounted ONLY when a user
  // directory is provided AND the issuer is explicitly enabled via env, so the
  // public deployment posture never changes silently. No other login method is
  // mounted; OAuth/magic-link methods plug into the UserDirectory port later.
  if(services.userDirectory && process.env.LEADLOOM_AUTH_ISSUER_ENABLED==='true') {
   const attempts=new Map<string,number[]>();
   const WINDOW_MS=5*60*1000,MAX_ATTEMPTS=5;
   const Login=z.object({email:z.string().email().max(320),password:z.string().min(1).max(256)}).strict();
   // Precomputed dummy keeps unknown-user timing close to wrong-password timing.
   const DUMMY_HASH='scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
   fastify.post('/auth/login',async(request:any,reply:any)=>{
    const ip=String(request.ip??'unknown');
    const now=Date.now();
    const recent=(attempts.get(ip)??[]).filter((t:number)=>now-t<WINDOW_MS);
    if(recent.length>=MAX_ATTEMPTS) return reply.code(429).send({error:'Too many login attempts'});
    attempts.set(ip,[...recent,now]);
    const parsed=Login.safeParse(request.body);
    if(!parsed.success) return reply.code(400).send({error:'Invalid login request'});
    const user=await services.userDirectory!.findByEmail(parsed.data.email);
    if(!user || !user.passwordHash) {
      await verifyPassword(parsed.data.password,DUMMY_HASH); // timing normalization
      return reply.code(401).send({error:'Invalid credentials'});
    }
    const ok=await verifyPassword(parsed.data.password,user.passwordHash);
    if(!ok) return reply.code(401).send({error:'Invalid credentials'});
    const {token,claims}=issueSession({userId:user.id,workspaceId:user.workspaceId,role:user.role},services.sessionKey,12*60*60);
    return {token,expiresAt:new Date(claims.exp*1000).toISOString()};
   });
  }
 }
 // Coarse Boolean(services) alone was easy to misread as "open mutations";
 // report per-route mount state so health checks show exactly what exists.
 // Every mounted mutation route still requires a session + write role, and
 // sessions can only be minted when the login issuer itself is mounted.
 fastify.get('/health',async()=>({status:'ok',service:'leadloom-engine',mutationsEnabled:Boolean(services),outboundSendingEnabled:false,routes:{mutations:services?'mounted:session+write-role-required':'unmounted',loginIssuer:services?.userDirectory&&process.env.LEADLOOM_AUTH_ISSUER_ENABLED==='true'?'mounted':'unmounted',unsubscribe:services?.unsubscribeKey?'mounted':'unmounted'}}));
 fastify.get('/ready',async(_request:any,reply:any)=>reply.code(503).send({status:'not-ready',reason:'Database/auth/provider workers are not mounted'}));
 await app.init();
 return app;
}

if(require.main===module) {
 (async()=>{
  let services:RuntimeServices|undefined;
  let prisma:PrismaClient|undefined,vault:VaultService|undefined;
  if(process.env.DATABASE_URL || process.env.LEADLOOM_MASTER_KEY || process.env.LEADLOOM_SESSION_KEY) {
   if(!process.env.DATABASE_URL || !process.env.LEADLOOM_MASTER_KEY || !process.env.LEADLOOM_SESSION_KEY) throw new Error('Incomplete runtime configuration');
   const key=Buffer.from(process.env.LEADLOOM_SESSION_KEY,'base64');
   if(key.length<32)throw new Error('Invalid session signing key');
   prisma=new PrismaClient();await prisma.$connect();vault=VaultService.fromEnv();
   const unsubscribeKey=process.env.LEADLOOM_UNSUBSCRIBE_KEY?Buffer.from(process.env.LEADLOOM_UNSUBSCRIBE_KEY,'base64'):undefined;
   if(unsubscribeKey&&unsubscribeKey.length<16)throw new Error('Invalid unsubscribe signing key');
   services={credentials:new CredentialService(new PrismaCredentialRepository(prisma),vault),outbound:new AtomicDispatchRepository(new PrismaDispatchDatabase(prisma)),sessionKey:key,userDirectory:new PrismaUserDirectory(prisma),...(unsubscribeKey?{unsubscribeKey}:{})};
  }
  const app=await createApplication(services);
  const close=async()=>{await app.close();await prisma?.$disconnect();vault?.destroy();};
  process.once('SIGTERM',()=>{void close();});process.once('SIGINT',()=>{void close();});
  await app.listen(Number(process.env.PORT??4000),process.env.HOST??'127.0.0.1');
 })().catch(()=>{console.error('Engine startup failed');process.exitCode=1;});
}
