import {connectorStatuses} from './modules/connectors/connector-registry';
import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@leadloom/database';
import { verifySession } from './modules/auth/session';
import { PrismaAccessGuard } from './modules/auth/access-guard';
import type { AccessGuard } from './modules/auth/access-guard';
import { AccountSuspendedError, SignupLimitedError } from './modules/provisioning/provisioning.service';
import { BYOKProviderEnum } from '@leadloom/contracts';
import { SlidingWindowLimiter } from './modules/auth/rate-limiter';
import type { ProvisioningService } from './modules/provisioning/provisioning.service';
import type { EntitlementService } from './modules/entitlements/entitlements.service';
import type { FeatureKey } from '@leadloom/contracts';
import { verifyBridgeToken } from './modules/auth/nextauth-bridge';
import { canWrite, isAdmin } from './modules/auth/rbac';
import { issueSession } from './modules/auth/issuer';
import { verifyPassword } from './modules/auth/password';
import { PasswordAccountService, MailUnavailableError, SignupLimitedError as PwSignupLimitedError, InvalidCodeError, WeakPasswordError, InvalidCredentialsError, EmailNotVerifiedError, AccountInactiveError } from './modules/password-auth/password-account.service';
import type { UserDirectory } from './modules/auth/user-directory';
import { PrismaUserDirectory } from './modules/auth/user-directory';
import { verifyUnsubscribeToken } from './modules/outbound/transport/unsubscribe';
import { CredentialService } from './modules/vault/credential.service';
import { VaultService } from './modules/vault/vault.service';
import { PrismaCredentialRepository } from './modules/vault/prisma-credential.repository';
import { AtomicDispatchRepository } from './modules/outbound/atomic-dispatch.repository';
import { CampaignRecipientsRepository } from './modules/outbound/campaign-recipients.repository';
import { PrismaDispatchDatabase } from './modules/outbound/prisma-database';
import type { WaterfallController } from './modules/waterfall/waterfall.controller';
import type { ValidatorController } from './modules/validator/validator.controller';
import { WorkspaceReadService } from './modules/workspace-read/workspace-read.service';
import type { MemberService } from './modules/invitations/members';
import type { InvitationService } from './modules/invitations/invitation.service';
import type { MailboxConnectService } from './modules/mailbox-connect/mailbox-connect.service';
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
 credentials: Pick<CredentialService,'save'|'list'|'delete'|'use'|'markTestResult'|'findLatestByProvider'>;
 outbound: Pick<AtomicDispatchRepository,'enqueue'|'suppress'|'listPendingApprovals'|'approve'|'reject'|'getApprovalStats'|'listInboundReplies'|'releaseApproved'|'setSenderMailbox'>;
 recipients?: import('./modules/outbound/campaign-recipients.repository').CampaignRecipientsRepository;
 sessionKey: Buffer;
 /** Optional: accept web-minted NextAuth bridge JWTs (default off). */
 nextAuthBridgeKey?: Buffer;
 /** Optional: deny suspended users and deactivated workspaces on every authenticated request. */
 accessGuard?: AccessGuard;
 /** Optional: first sign-in provisioning (default off; needs the bridge key). */
 provisioning?: Pick<ProvisioningService,'provision'>;
 userDirectory?: UserDirectory;
 /** Optional: email+password accounts with verified email (default off; main gates it behind LEADLOOM_PASSWORD_AUTH_ENABLED). */
 passwordAccounts?: PasswordAccountService;
 unsubscribeKey?: Buffer;
 /** Optional: read-only tenant-scoped views of persisted data (mounted when provided). */
 reads?: Pick<WorkspaceReadService,'summary'|'listTables'|'listTableRows'|'listMailboxes'|'listCampaigns'|'listSuppressions'|'listExperiments'>;
 /** Optional: admin-only workspace invitations (default off; LEADLOOM_TEAM_INVITES_ENABLED). Sends no mail. */
 invitations?: Pick<InvitationService,'invite'|'list'|'revoke'|'mine'|'accept'>;
 members?: Pick<MemberService,'list'|'setRole'|'remove'>;
 /** Optional: admin-only mailbox connect by IMAP/SMTP password (default off; LEADLOOM_MAILBOX_CONNECT_ENABLED). Sends no mail. */
 mailboxConnect?: Pick<MailboxConnectService,'connect'|'test'|'remove'>;
 /** Optional: mounted only when provided (main gates them behind explicit env flags). */
 waterfall?: Pick<WaterfallController,'getPreFlightEstimate'|'dispatch'>;
 /** Optional: read-only waterfall connector registry reconciled with stored BYOK credentials (masked only). */
 waterfallConnectors?: { list(workspaceId: string): Promise<unknown> };
 connectorTest?: import('./modules/waterfall/connectors/test-connection.service.js').TestConnectionService;
 validator?: Pick<ValidatorController,'generate'|'recordOutreach'|'getOwnerPage'|'setPublishStatus'|'getScorecard'|'submitLead'|'getPublicPage'>;
 /** Optional: shared-store rate limit for public routes (Postgres-backed, holds across replicas/restarts). Wired by main when the validator runs on a real DB; absent in tests, which keep a per-process fallback. 'error' means the store failed - callers fail closed (503), never open. */
 publicRateLimit?: (key: string, max: number) => Promise<import('./modules/auth/rate-limiter.js').LimitVerdict>;
 /** Optional: G4 website research (default off; LEADLOOM_RESEARCH_API_ENABLED). Heuristic keyword analysis only - no LLM call, no fabricated claims. */
 websiteSignals?: import('./modules/ai-researcher/website-signals.service.js').WebsiteSignalService;
 /** Optional: URL fetch boundary for research (default off; LEADLOOM_RESEARCH_FETCH_ENABLED). Without it, only pasted page text is analyzed and no egress exists. */
 websiteFetcher?: import('./modules/ai-researcher/website-fetcher.js').SafeWebsiteFetcher;
 /** Optional: persist analyses as rows in the research leads table (mounted with the research API). Values always come from the engine's own heuristic computation. */
 researchLeads?: import('./modules/ai-researcher/research-leads.service.js').ResearchLeadsService;
 /** Optional: G5 intent signals, fixture-first increment (same flag as G4). Pasted/bundled hiring-board-shaped JSON only - zero egress, every row labeled fixture. Live ATS/board ingestion is a separately gated step. */
 intentFixture?: import('./modules/ai-researcher/intent-fixture.service.js').IntentFixtureService;
 /** Optional: when provided, plan/feature gates are enforced server-side (main gates it behind LEADLOOM_ENTITLEMENTS_ENFORCED). */
 entitlements?: Pick<EntitlementService,'checkFeature'|'checkLimit'>;
}
export async function createApplication(services?:RuntimeServices) {
 const app=await NestFactory.create<NestFastifyApplication>(RuntimeModule,new FastifyAdapter({bodyLimit:65536}),{logger:['error','warn']});
 const fastify=app.getHttpAdapter().getInstance();
 if(services) {
  const authorize=async(request:any,reply:any,write=false)=>{
   try {
    const token=String(request.headers.authorization??'').replace(/^Bearer /,'');
    let claims;let engineSession=false;
    try {claims=verifySession(token,services.sessionKey);engineSession=true;}
    catch(e) {
     if(!services.nextAuthBridgeKey||!services.userDirectory) throw e;
     const proven=verifyBridgeToken(token,services.nextAuthBridgeKey);
     await services.passwordAccounts?.claimByProvider(proven.email);
     const member=await services.userDirectory.findByEmail(proven.email);
     if(!member) throw new Error('No membership');
     claims={sub:member.id,workspaceId:member.workspaceId,role:member.role,exp:proven.exp};
    }
    if(services.accessGuard&&!await services.accessGuard.isActive(claims.sub,claims.workspaceId,engineSession?{ver:(claims as any).ver}:undefined)) {reply.code(401).send({error:'Authentication required'});return null;}
    if(write && !canWrite(claims)) {reply.code(403).send({error:'Read-only workspace role'});return null;}
    return claims;
   } catch {reply.code(401).send({error:'Authentication required'});return null;}
  };
  // Who am I: lets the web app gate /app and /admin on the engine's own answer.
  // Identity, workspace and role come only from the engine's tables. Never accepts input.
  fastify.get('/auth/me',async(request:any,reply:any)=>{
   const session=await authorize(request,reply);if(!session)return;
   return {userId:session.sub,workspaceId:session.workspaceId,role:session.role};
  });
  // First sign-in provisioning. Authenticated ONLY by a bridge token (verified
  // email). The body can supply a display name and nothing else: workspace and
  // role are always server-assigned (new workspace, admin of it alone).
  if(services.provisioning&&services.nextAuthBridgeKey) {
   // Request-level abuse cap (per client IP and global). In-memory, per process.
   const provisionLimiter=new SlidingWindowLimiter(5,60_000);
   fastify.post('/auth/provision',async(request:any,reply:any)=>{
    let email:string;
    try {
     email=verifyBridgeToken(String(request.headers.authorization??'').replace(/^Bearer /,''),services.nextAuthBridgeKey!).email;
    } catch {return reply.code(401).send({error:'Authentication required'});}
    if(!provisionLimiter.take('ip:'+String(request.ip))||!provisionLimiter.take('global')) return reply.code(429).send({error:'Too many requests'});
    const name=typeof request.body?.name==='string'?request.body.name:null;
    try {
     await services.passwordAccounts?.claimByProvider(email);
     const member=await services.provisioning!.provision(email,name);
     return reply.code(member.created?201:200).send(member);
    } catch(e) {
     if(e instanceof AccountSuspendedError) return reply.code(403).send({error:'Account unavailable'});
     if(e instanceof SignupLimitedError) return reply.code(429).send({error:'Too many requests'});
     return reply.code(400).send({error:'Provisioning failed'});
    }
   });
  }
  /** Server-side plan gate; no-op unless entitlements are configured. Deny-by-default when enforced. */
  const allowed=async(reply:any,workspaceId:string,feature:FeatureKey)=>{
   if(!services.entitlements)return true;
   const decision=await services.entitlements.checkFeature(workspaceId,feature);
   if(decision.allowed)return true;
   reply.code(403).send({error:'Not available on the current plan',reason:decision.reason,feature});
   return false;
  };
  if(services.reads){
   const reads=services.reads;
   fastify.get('/workspace/summary',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.summary(s.workspaceId);});
   fastify.get('/workspace/tables',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.listTables(s.workspaceId);});
   fastify.get('/workspace/tables/:tableId/rows',async(request:any,reply:any)=>{
    const s=await authorize(request,reply);if(!s)return;
    const id=z.string().uuid().safeParse(request.params.tableId);if(!id.success)return reply.code(400).send({error:'Invalid table ID'});
    const result=await reads.listTableRows(s.workspaceId,id.data);
    if(!result)return reply.code(404).send({error:'Table not found'});
    return result;
   });
   fastify.get('/workspace/mailboxes',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.listMailboxes(s.workspaceId);});
   fastify.get('/workspace/connectors/status',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return {connectors:connectorStatuses()};});
   if(services.waterfallConnectors) {
    fastify.get('/waterfall/connectors',async(request:any,reply:any)=>{
     const session=await authorize(request,reply);if(!session)return;
     return {connectors:await services.waterfallConnectors!.list(session.workspaceId),sendingEnabled:false};
    });
   }
   fastify.get('/workspace/suppressions',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.listSuppressions(s.workspaceId);});
   fastify.get('/workspace/experiments',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.listExperiments(s.workspaceId);});
   fastify.get('/workspace/campaigns',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.listCampaigns(s.workspaceId);});
  }
  if(services.invitations) {
   const inv=services.invitations;
   const InviteBody=z.object({email:z.string().max(320),role:z.enum(['read_only','member','admin'])}).strict();
   const adminOnly=async(request:any,reply:any)=>{const s=await authorize(request,reply,true);if(!s)return null;if(!isAdmin(s)){reply.code(403).send({error:'Admin role required'});return null;}return s;};
   const inviteLimiter=new SlidingWindowLimiter(30,60_000);
   // The signed-in user's own pending invitations and explicit accept. Any role may call these; the engine
   // answers only for the session's own verified address and moves only a pristine, empty personal workspace.
   const acceptLimiter=new SlidingWindowLimiter(10,60_000);
   fastify.get('/me/invitations',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return inv.mine(s.sub);});
   fastify.post('/me/invitations/:id/accept',async(request:any,reply:any)=>{
    const s=await authorize(request,reply);if(!s)return;
    if(!acceptLimiter.take(s.sub))return reply.code(429).send({error:'Too many requests'});
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid invitation ID'});
    const r=await inv.accept(s.sub,id.data);
    if(r.ok)return {accepted:true,role:r.role,reauthenticate:true};
    return reply.code(r.reason==='not_found'?404:409).send({error:'Invitation not accepted',code:r.reason});
   });
   fastify.get('/workspace/invitations',async(request:any,reply:any)=>{const s=await adminOnly(request,reply);if(!s)return;return inv.list(s.workspaceId);});
   fastify.post('/workspace/invitations',async(request:any,reply:any)=>{
    const s=await adminOnly(request,reply);if(!s)return;
    if(!inviteLimiter.take(s.workspaceId))return reply.code(429).send({error:'Too many requests'});
    const p=InviteBody.safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Invalid invitation request',code:'invalid_request'});
    const r=await inv.invite(s.workspaceId,s.sub,p.data.email,p.data.role);
    if(r.ok)return reply.code(201).send({invitation:r.invitation,emailSent:false});
    const status=r.reason==='limit_reached'?429:r.reason==='owner_only'?403:r.reason==='account_exists'||r.reason==='already_invited'?409:400;
    return reply.code(status).send({error:'Invitation not created',code:r.reason});
   });
   fastify.delete('/workspace/invitations/:id',async(request:any,reply:any)=>{
    const s=await adminOnly(request,reply);if(!s)return;
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid invitation ID'});
    const ok=await inv.revoke(s.workspaceId,s.sub,id.data);
    return ok?{revoked:true}:reply.code(404).send({error:'Invitation not found'});
   });
  }
  if(services.members) {
   const mem=services.members;
   const adminOnlyM=async(request:any,reply:any)=>{const s=await authorize(request,reply,true);if(!s)return null;if(!isAdmin(s)){reply.code(403).send({error:'Admin role required'});return null;}return s;};
   const memberLimiter=new SlidingWindowLimiter(30,60_000);
   const changeStatus=(r:{ok:false;reason:string})=>r.reason==='not_found'?404:r.reason==='invalid_role'?400:r.reason==='owner_only'?403:409;
   fastify.get('/workspace/members',async(request:any,reply:any)=>{const s=await adminOnlyM(request,reply);if(!s)return;return mem.list(s.workspaceId);});
   fastify.patch('/workspace/members/:id',async(request:any,reply:any)=>{
    const s=await adminOnlyM(request,reply);if(!s)return;
    if(!memberLimiter.take(s.workspaceId))return reply.code(429).send({error:'Too many requests'});
    const id=z.string().uuid().safeParse(request.params.id);const b=z.object({role:z.enum(['read_only','member','admin'])}).strict().safeParse(request.body);
    if(!id.success||!b.success)return reply.code(400).send({error:'Invalid request'});
    const r=await mem.setRole(s.workspaceId,s.sub,id.data,b.data.role);
    return r.ok?{updated:true}:reply.code(changeStatus(r)).send({error:'Member not changed',code:r.reason});
   });
   fastify.delete('/workspace/members/:id',async(request:any,reply:any)=>{
    const s=await adminOnlyM(request,reply);if(!s)return;
    if(!memberLimiter.take(s.workspaceId))return reply.code(429).send({error:'Too many requests'});
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid member ID'});
    const r=await mem.remove(s.workspaceId,s.sub,id.data);
    return r.ok?{removed:true}:reply.code(changeStatus(r)).send({error:'Member not changed',code:r.reason});
   });
  }
  if(services.mailboxConnect) {
   const mc=services.mailboxConnect;
   const adminOnlyMb=async(request:any,reply:any)=>{const s=await authorize(request,reply,true);if(!s)return null;if(!isAdmin(s)){reply.code(403).send({error:'Admin role required'});return null;}return s;};
   const mbLimiter=new SlidingWindowLimiter(10,60_000);
   const ConnectBody=z.object({email:z.string().max(320),password:z.string().min(1).max(512),smtpHost:z.string().max(253),smtpPort:z.number().int(),imapHost:z.string().max(253),imapPort:z.number().int()}).strict();
   fastify.get('/workspace/mailbox-presets',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;const {MAILBOX_PRESETS}=await import('./modules/mailbox-connect/presets.js');return MAILBOX_PRESETS;});
   fastify.post('/workspace/mailboxes/connect',async(request:any,reply:any)=>{
    const s=await adminOnlyMb(request,reply);if(!s)return;
    if(!mbLimiter.take(s.workspaceId))return reply.code(429).send({error:'Too many requests'});
    const p=ConnectBody.safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Invalid mailbox request',code:'invalid_request'});
    const r=await mc.connect(s.workspaceId,p.data);
    if(r.ok)return reply.code(201).send({mailbox:r.mailbox,result:r.result,mailSent:false});
    const status=r.reason==='already_connected'?409:r.reason==='connection_failed'?422:400;
    return reply.code(status).send({error:'Mailbox not connected',code:r.reason,...(r.result?{result:r.result}:{})});
   });
   fastify.post('/workspace/mailboxes/:id/test',async(request:any,reply:any)=>{
    const s=await adminOnlyMb(request,reply);if(!s)return;
    if(!mbLimiter.take(s.workspaceId))return reply.code(429).send({error:'Too many requests'});
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid mailbox ID'});
    const r=await mc.test(s.workspaceId,id.data);
    return r.ok?{mailbox:r.mailbox,result:r.result,mailSent:false}:reply.code(404).send({error:'Mailbox not found'});
   });
   fastify.delete('/workspace/mailboxes/:id',async(request:any,reply:any)=>{
    const s=await adminOnlyMb(request,reply);if(!s)return;
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid mailbox ID'});
    return (await mc.remove(s.workspaceId,id.data))?{removed:true}:reply.code(404).send({error:'Mailbox not found'});
   });
  }
  fastify.get('/vault/credentials',async(request:any,reply:any)=>{
   const session=await authorize(request,reply);if(!session)return;
   return services.credentials.list(session.workspaceId);
  });
  fastify.post('/vault/credentials',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   try{return await services.credentials.save(session.workspaceId,request.body);}
   catch{return reply.code(400).send({error:'Credential could not be saved'});}
  });
  fastify.delete('/vault/credentials/:id',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const id=z.string().uuid().safeParse(request.params.id);
   if(!id.success)return reply.code(400).send({error:'Invalid credential ID'});
   return {deleted:await services.credentials.delete(session.workspaceId,id.data)};
  });
  // Live test-connection. A live test is a REAL request to the provider's API
  // (see TestConnectionService probes): for most vendors it consumes a credit,
  // quota, or tokens. It is never a free auth check. The route is inert unless
  // LEADLOOM_CONNECTORS_LIVE_ENABLED=true; otherwise no egress is possible and
  // the stored key is not even decrypted. On a completed live test the result
  // persists as isValid/lastVerifiedAt on the credential row.
  const TEST_COST_DISCLOSURE='A live test sends a real request to the provider and may consume quota, credits, or tokens.';
  fastify.post('/vault/credentials/:provider/test',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const provider=BYOKProviderEnum.safeParse(request.params.provider);
   if(!provider.success)return reply.code(400).send({error:'Unknown provider'});
   if(process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED!=='true')
    return reply.code(503).send({status:'DISABLED',message:'Live connector testing is disabled on this environment',costDisclosure:TEST_COST_DISCLOSURE});
   if(!services.connectorTest)return reply.code(503).send({status:'DISABLED',message:'Connector testing unavailable',costDisclosure:TEST_COST_DISCLOSURE});
   const cred=await services.credentials.findLatestByProvider(session.workspaceId,provider.data);
   if(!cred)return reply.code(404).send({status:'FAILED',message:'No saved key for this provider',costDisclosure:TEST_COST_DISCLOSURE});
   const result=await services.credentials.use(session.workspaceId,cred.id,(key:Buffer)=>
    services.connectorTest!.testConnection({workspaceId:session.workspaceId,connectorId:provider.data,apiKey:key.toString('utf8')}));
   if(result.status==='SUCCESS'||result.status==='FAILED')
    await services.credentials.markTestResult(session.workspaceId,cred.id,result.status==='SUCCESS');
   const code=result.status==='FORBIDDEN'?403:result.status==='DISABLED'?503:200;
   return reply.code(code).send({status:result.status,message:result.message,latencyMs:result.latencyMs??null,error:result.error??null,costDisclosure:TEST_COST_DISCLOSURE});
  });
  // Jobs always enter as pending_approval: approval is enforced server-side and no caller
  // parameter can enqueue a send-reservable job. claim() only picks status='pending' and no
  // code path moves approved->pending while dispatch is disabled (G9 hardening).
  const EnqueueRecipient=z.object({firstName:z.string().max(120).nullish(),lastName:z.string().max(120).nullish(),companyName:z.string().max(200).nullish(),title:z.string().max(200).nullish(),customFields:z.record(z.string(),z.unknown()).optional()}).strict();
  // recipientId links the job to a campaign_recipients row (live fields); recipient fixes inline fields at enqueue.
  // A template with variables resolves strictly: without recipient data the enqueue fails closed (nothing enters the queue).
  const Enqueue=z.object({campaignId:z.string().uuid(),recipientEmail:z.string().email(),idempotencyKey:z.string().min(1).max(255),stepNumber:z.number().int().positive(),scheduledAt:z.iso.datetime(),recipientId:z.string().uuid().optional(),recipient:EnqueueRecipient.optional(),senderMailboxId:z.string().uuid().optional()}).strict();
  // Campaign recipients: the entry path into the recipient store that per-recipient resolution reads.
  const RecipientInput=z.object({email:z.string().email().max(320),firstName:z.string().max(120).nullish(),lastName:z.string().max(120).nullish(),companyName:z.string().max(200).nullish(),title:z.string().max(200).nullish(),customFields:z.record(z.string(),z.unknown()).optional()}).strict();
  const RecipientsBody=z.object({recipients:z.array(RecipientInput).min(1).max(500)}).strict();
  fastify.post('/campaigns/:campaignId/recipients',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   if(!await allowed(reply,session.workspaceId,'outbound_sending'))return;
   if(!services.recipients)return reply.code(503).send({error:'Recipient store unavailable'});
   const campaignId=z.string().uuid().safeParse((request.params as any)?.campaignId);
   const parsed=RecipientsBody.safeParse(request.body);
   if(!campaignId.success||!parsed.success)return reply.code(400).send({error:'Invalid recipients request'});
   if(!await services.recipients.campaignExists(session.workspaceId,campaignId.data))return reply.code(404).send({error:'Campaign not found'});
   const res=await services.recipients.addRecipients(session.workspaceId,campaignId.data,parsed.data.recipients);
   return reply.code(200).send(res);
  });
  fastify.get('/campaigns/:campaignId/recipients',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,false);if(!session)return;
   if(!services.recipients)return reply.code(503).send({error:'Recipient store unavailable'});
   const campaignId=z.string().uuid().safeParse((request.params as any)?.campaignId);
   if(!campaignId.success)return reply.code(400).send({error:'Invalid campaign id'});
   if(!await services.recipients.campaignExists(session.workspaceId,campaignId.data))return reply.code(404).send({error:'Campaign not found'});
   return reply.code(200).send({recipients:await services.recipients.listRecipients(session.workspaceId,campaignId.data)});
  });

  fastify.post('/outbound/jobs',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   if(!await allowed(reply,session.workspaceId,'outbound_sending'))return;
   const parsed=Enqueue.safeParse(request.body);
   if(!parsed.success)return reply.code(400).send({error:'Invalid job request'});
   try {
    const id=await services.outbound.enqueue({...parsed.data,workspaceId:session.workspaceId,scheduledAt:new Date(parsed.data.scheduledAt)});
    return reply.code(202).send({id,status:'pending_approval',sendingEnabled:false});
   } catch (err) {
    // Resolution failures are actionable by the caller (fix the template or recipient); other errors stay generic.
    const msg=err instanceof Error ? err.message : '';
    if(msg.startsWith('Message does not resolve')) return reply.code(400).send({error:'Job could not be queued',detail:msg});
    if(msg.startsWith('Sender mailbox')) return reply.code(400).send({error:'Job could not be queued',detail:msg});
    return reply.code(400).send({error:'Job could not be queued'});
   }
  });
  // G9: Approval-before-send queue routes. Human review required before any send; sending stays disabled.
  fastify.get('/outbound/approvals',async(request:any,reply:any)=>{
   const session=await authorize(request,reply);if(!session)return;
   const cId=request.query?.campaignId?z.string().uuid().safeParse(request.query.campaignId):null;
   const campaignId=cId?.success?cId.data:undefined;
   const [items,stats]=await Promise.all([
    services.outbound.listPendingApprovals(session.workspaceId,campaignId),
    services.outbound.getApprovalStats(session.workspaceId),
   ]);
   return {items,stats,sendingEnabled:false};
  });
  fastify.get('/outbound/replies',async(request:any,reply:any)=>{
   const session=await authorize(request,reply);if(!session)return;
   const cId=request.query?.campaignId?z.string().uuid().safeParse(request.query.campaignId):null;
   const campaignId=cId?.success?cId.data:undefined;
   const items=await services.outbound.listInboundReplies(session.workspaceId,campaignId);
   return {items,sendingEnabled:false};
  });
  fastify.post('/outbound/approvals/approve',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const b=z.object({jobIds:z.array(z.string().uuid()).optional(),all:z.boolean().optional(),campaignId:z.string().uuid().optional()}).strict().safeParse(request.body);
   if(!b.success)return reply.code(400).send({error:'Invalid approval request'});
   const result=await services.outbound.approve(session.workspaceId,b.data);
   return {...result,sendingEnabled:false};
  });
  fastify.post('/outbound/approvals/reject',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const b=z.object({jobIds:z.array(z.string().uuid()).optional(),all:z.boolean().optional(),campaignId:z.string().uuid().optional(),reason:z.string().max(255).optional()}).strict().safeParse(request.body);
   if(!b.success)return reply.code(400).send({error:'Invalid rejection request'});
   return services.outbound.reject(session.workspaceId,b.data);
  });
  fastify.post('/outbound/approvals/:id/approve',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid job ID'});
   const result=await services.outbound.approve(session.workspaceId,{jobIds:[id.data]});
   return {...result,sendingEnabled:false};
  });
  // Per-job sender pin: narrow a held message to one mailbox from the campaign's pool (or clear back to rotation).
  // Recomputes the approval snapshot/hash so the reviewer deliberately approves the pinned sender context.
  fastify.post('/outbound/approvals/:id/sender',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid job ID'});
   const b=z.object({mailboxId:z.string().uuid().nullable()}).strict().safeParse(request.body);
   if(!b.success)return reply.code(400).send({error:'Invalid sender request'});
   const r=await services.outbound.setSenderMailbox(session.workspaceId,id.data,b.data.mailboxId);
   return r.ok?{updated:true,sendingEnabled:false}:reply.code(400).send({error:r.error});
  });
  fastify.post('/outbound/approvals/:id/reject',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid job ID'});
   return services.outbound.reject(session.workspaceId,{jobIds:[id.data]});
  });
  // G3 gated release: moves held 'approved' jobs to send-reservable 'pending'.
  // The repository is constructed with sendingEnabled only when main sees
  // LEADLOOM_OUTBOUND_SENDING_ENABLED=true; every current deployment leaves it
  // unset, so this route honestly reports released:0/sendingEnabled:false.
  fastify.post('/outbound/release',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   if(!await allowed(reply,session.workspaceId,'outbound_sending'))return;
   const b=z.object({campaignId:z.string().uuid()}).strict().safeParse(request.body);
   if(!b.success)return reply.code(400).send({error:'Invalid release request'});
   return services.outbound.releaseApproved(session.workspaceId,b.data.campaignId);
  });
  fastify.post('/outbound/suppressions',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
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
  // PRD 4.1 waterfall + validator route contracts. Mounted only when the
  // services are provided; main constructs them behind explicit env flags,
  // so the deployed posture stays unchanged unless an operator opts in.
  if(services.waterfall) {
   fastify.post('/waterfall/pre-flight',async(request:any,reply:any)=>{
    const session=await authorize(request,reply);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'waterfall'))return;
    try{return await services.waterfall!.getPreFlightEstimate(request.body);}
    catch{return reply.code(400).send({error:'Invalid pre-flight request'});}
   });
   fastify.post('/waterfall/dispatch',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'waterfall'))return;
    try{return await services.waterfall!.dispatch(request.body);}
    catch{return reply.code(400).send({error:'Invalid waterfall dispatch request'});}
   });
  }
  // G4 buyer discovery, first increment: heuristic website-signal analysis.
  // Honesty contract (see website-signals.service.ts): keyword matches only,
  // labeled heuristic_keywords; no LLM call, no invented summary/confidence.
  // Pasted page text is always accepted (no egress). URL fetching exists only
  // when main mounted a fetcher behind LEADLOOM_RESEARCH_FETCH_ENABLED.
  if(services.websiteSignals) {
   const ResearchBody=z.union([
    z.object({domain:z.string().min(1).max(255).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i,'Invalid domain'),pageText:z.string().min(1).max(200_000)}).strict(),
    z.object({url:z.string().url().max(2048)}).strict(),
   ]);
   fastify.post('/research/website-signals',async(request:any,reply:any)=>{
    const session=await authorize(request,reply);if(!session)return;
    const parsed=ResearchBody.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Invalid research request'});
    if('url' in parsed.data) {
     if(!services.websiteFetcher)
      return {status:'DISABLED',message:'Fetching websites is disabled on this environment. Paste the page text instead.',fetchEnabled:false};
     let fetched;
     try{fetched=await services.websiteFetcher.fetchText(parsed.data.url);}
     catch(err){return reply.code(422).send({status:'FETCH_FAILED',message:(err as Error).message||'The page could not be fetched',fetchEnabled:true});}
     const domain=new URL(fetched.finalUrl).hostname;
     const signals=services.websiteSignals!.analyzeText(domain,fetched.text);
     const {deriveIcpHints,deriveRelevanceReasons}=await import('./modules/ai-researcher/website-signals.service.js');
     const icpHints=deriveIcpHints(fetched.text);
     return {status:'OK',input:'fetched_url',truncated:fetched.truncated,signals,icpHints,relevanceReasons:deriveRelevanceReasons(signals,icpHints)};
    }
    const signals=services.websiteSignals!.analyzeText(parsed.data.domain,parsed.data.pageText);
    const {deriveIcpHints,deriveRelevanceReasons}=await import('./modules/ai-researcher/website-signals.service.js');
    const icpHints=deriveIcpHints(parsed.data.pageText);
    return {status:'OK',input:'pasted_text',signals,icpHints,relevanceReasons:deriveRelevanceReasons(signals,icpHints)};
   });
  }
  if(services.researchLeads) {
   const SaveBody=z.object({domain:z.string().min(1).max(255).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i,'Invalid domain'),pageText:z.string().min(1).max(200_000)}).strict();
   fastify.post('/research/website-signals/save',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    const parsed=SaveBody.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Invalid research save request'});
    const saved=await services.researchLeads!.saveAnalysis(session.workspaceId,parsed.data.domain,parsed.data.pageText,'pasted_text');
    return {status:'SAVED',...saved};
   });
   fastify.get('/research/leads',async(request:any,reply:any)=>{
    const session=await authorize(request,reply);if(!session)return;
    return {items:await services.researchLeads!.listAnalyses(session.workspaceId)};
   });
  }
  // G5 intent signals, fixture-first: analyze/save/list hiring-board-shaped
  // JSON fixtures. Pasted JSON only - no fetch variant exists, so nothing in
  // these routes performs egress. Computed values are engine-only.
  if(services.intentFixture) {
   const IntentBody=z.object({fixture:z.unknown()}).strict();
   fastify.post('/research/intent-fixture',async(request:any,reply:any)=>{
    const session=await authorize(request,reply);if(!session)return;
    const parsed=IntentBody.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Invalid intent fixture request'});
    const result=services.intentFixture!.analyze(parsed.data.fixture);
    if(!result.ok)return reply.code(422).send({status:'INVALID_FIXTURE',message:result.error});
    return {status:'OK',input:'pasted_fixture',analysis:result.analysis};
   });
   fastify.post('/research/intent-fixture/save',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    const parsed=IntentBody.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Invalid intent fixture save request'});
    const saved=await services.intentFixture!.saveAnalysis(session.workspaceId,parsed.data.fixture);
    if(!saved.ok)return reply.code(422).send({status:'INVALID_FIXTURE',message:saved.error});
    return {status:'SAVED',tableId:saved.tableId,rowId:saved.rowId};
   });
   fastify.get('/research/intent-signals',async(request:any,reply:any)=>{
    const session=await authorize(request,reply);if(!session)return;
    return {items:await services.intentFixture!.listAnalyses(session.workspaceId)};
   });
  }
  if(services.validator) {
   fastify.post('/validator/experiments',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    try{return await services.validator!.generate(session.workspaceId,request.body);}
    catch{return reply.code(400).send({error:'Invalid validation request'});}
   });
   fastify.post('/validator/experiments/:id/outreach',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    try{return await services.validator!.recordOutreach(String(request.params.id),session.workspaceId,request.body);}
    catch{return reply.code(400).send({error:'Invalid outreach metrics'});}
   });
   fastify.get('/validator/experiments/:id/page',async(request:any,reply:any)=>{
    const session=await authorize(request,reply);if(!session)return;
    const page=await services.validator!.getOwnerPage(String(request.params.id),session.workspaceId);
    if(!page)return reply.code(404).send({error:'Experiment not found'});
    return page;
   });
   fastify.post('/validator/experiments/:id/publish',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    try{return await services.validator!.setPublishStatus(String(request.params.id),session.workspaceId,true);}
    catch{return reply.code(404).send({error:'Experiment not found'});}
   });
   fastify.post('/validator/experiments/:id/unpublish',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    try{return await services.validator!.setPublishStatus(String(request.params.id),session.workspaceId,false);}
    catch{return reply.code(404).send({error:'Experiment not found'});}
   });
   fastify.get('/validator/experiments/:id/scorecard',async(request:any,reply:any)=>{
    const session=await authorize(request,reply);if(!session)return;
    try{return await services.validator!.getScorecard(String(request.params.id),session.workspaceId);}
    catch{return reply.code(404).send({error:'Experiment not found'});}
   });
   // Public by design: smoke-test pages render and collect waitlist leads
   // without an account. Strict schema validation only. State persists in
   // Postgres (validation_experiments/validation_leads) when the service is
   // constructed with Prisma; the in-memory fallback is for unit tests only.
   const SLUG_RE=/^[a-z0-9][a-z0-9-]{0,127}$/i;
   // First-line abuse control at the engine (the web proxy has its own per-IP
   // limiter; direct engine callers must not bypass it): 20 page loads + 5
   // lead submissions per IP per slug per 10 minutes. Uses the shared
   // Postgres store when wired (production), per-process map otherwise.
   // Client IP for limit keys: the engine is loopback-only behind the web
   // proxy, so X-Forwarded-For is trusted ONLY when the direct peer is
   // loopback (the proxy). Direct non-loopback callers cannot spoof it.
   const pubClientIp=(request:any):string=>{
    const peer=String(request.ip??'unknown');
    if(peer==='127.0.0.1'||peer==='::1'||peer==='::ffff:127.0.0.1'){
     const fwd=String(request.headers?.['x-forwarded-for']??'').split(',')[0].trim();
     if(fwd)return fwd.slice(0,45);
    }
    return peer.slice(0,45);
   };
   const pubHits=new Map<string,number[]>();
   const pubLimit=async(key:string,max:number):Promise<'allow'|'deny'|'error'>=>{
    if(services?.publicRateLimit)return services.publicRateLimit(key,max);
    // Fallback when no shared store is configured (unit tests, no DB).
    const now=Date.now(),W=600_000;
    const arr=(pubHits.get(key)??[]).filter(t=>now-t<W);
    if(arr.length>=max){pubHits.set(key,arr);return 'deny';}
    arr.push(now);pubHits.set(key,arr);return 'allow';
   };
   const pubGate=async(request:any,reply:any,prefix:string,slug:string,max:number):Promise<boolean>=>{
    const verdict=await pubLimit(`${prefix}:${pubClientIp(request)}:${slug}`,max);
    if(verdict==='error'){reply.code(503).send({error:'Service temporarily unavailable'});return false;}
    if(verdict==='deny'){reply.code(429).send({error:max<=5?'Too many submissions. Please try again in 10 minutes.':'Too many requests'});return false;}
    return true;
   };
   fastify.get('/validator/pages/:slug',async(request:any,reply:any)=>{
    const slug=String(request.params.slug);
    if(!SLUG_RE.test(slug))return reply.code(404).send({error:'Smoke test page not found'});
    if(!(await pubGate(request,reply,'pg',slug,20)))return;
    const page=await services.validator!.getPublicPage(slug);
    if(!page)return reply.code(404).send({error:'Smoke test page not found'});
    return page;
   });
   fastify.post('/validator/pages/:slug/leads',async(request:any,reply:any)=>{
    const slug=String(request.params.slug);
    if(!SLUG_RE.test(slug))return reply.code(404).send({error:'Smoke test page not found'});
    if(!(await pubGate(request,reply,'ld',slug,5)))return;
    try{return await services.validator!.submitLead(slug,request.body);}
    catch(err){const notFound=(err as Error).message?.includes('not found');return reply.code(notFound?404:400).send({error:notFound?'Smoke test page not found':'Invalid lead submission'});}
   });
  }
  // Planned login issuer (PRD users.password_hash). Mounted ONLY when a user
  // directory is provided AND the issuer is explicitly enabled via env, so the
  // public deployment posture never changes silently. No other login method is
  // mounted; OAuth/magic-link methods plug into the UserDirectory port later.
  if(services.userDirectory && !services.passwordAccounts && process.env.LEADLOOM_AUTH_ISSUER_ENABLED==='true') {
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
  if(services.passwordAccounts) {
   const pw=services.passwordAccounts;
   const ipLimiter=new SlidingWindowLimiter(40,5*60_000);      // per source address, all password routes
   const emailLimiter=new SlidingWindowLimiter(5,15*60_000);   // per target email, sign-in only
   const mailLimiter=new SlidingWindowLimiter(6,60*60_000);    // per target email, mail-sending routes
   const Cred=z.object({email:z.string().email().max(320),password:z.string().min(1).max(256)}).strict();
   const Reg=z.object({email:z.string().email().max(320),password:z.string().min(1).max(256),name:z.string().max(255).optional()}).strict();
   const Verify=z.object({email:z.string().email().max(320),code:z.string().min(1).max(12)}).strict();
   const Forgot=z.object({email:z.string().email().max(320)}).strict();
   const Reset=z.object({email:z.string().email().max(320),code:z.string().min(1).max(12),password:z.string().min(1).max(256)}).strict();
   const codeLimiter=new SlidingWindowLimiter(10,15*60_000);   // per target email, code checks (on top of 5 per code)
   const limited=(request:any,reply:any)=>{ if(!ipLimiter.take(String(request.ip??'unknown'))){reply.code(429).send({error:'Too many requests'});return true;} return false; };
   const fail=(reply:any,e:unknown)=>{
    if(e instanceof WeakPasswordError) return reply.code(400).send({error:e.message});
    if(e instanceof InvalidCodeError) return reply.code(400).send({error:'This code is invalid or has expired'});
    if(e instanceof PwSignupLimitedError) return reply.code(429).send({error:'Signups are temporarily limited'});
    if(e instanceof MailUnavailableError) return reply.code(503).send({error:'Email sending is not available'});
    return reply.code(400).send({error:'Invalid request'});
   };
   fastify.post('/auth/register',async(request:any,reply:any)=>{
    if(limited(request,reply)) return reply;
    const p=Reg.safeParse(request.body); if(!p.success) return reply.code(400).send({error:'Invalid request'});
    if(!mailLimiter.take(p.data.email.toLowerCase())) return reply.code(202).send({status:'code_sent'}); // silent: no signal
    try { await pw.register(p.data.email,p.data.password,p.data.name); } catch(e) { return fail(reply,e); }
    return reply.code(202).send({status:'code_sent'});
   });
   fastify.post('/auth/resend-verification',async(request:any,reply:any)=>{
    if(limited(request,reply)) return reply;
    const p=Forgot.safeParse(request.body); if(!p.success) return reply.code(400).send({error:'Invalid request'});
    if(mailLimiter.take(p.data.email.toLowerCase())) { try { await pw.resendVerification(p.data.email); } catch(e) { return fail(reply,e); } }
    return reply.code(202).send({status:'code_sent'});
   });
   fastify.post('/auth/verify-email',async(request:any,reply:any)=>{
    if(limited(request,reply)) return reply;
    const p=Verify.safeParse(request.body); if(!p.success) return reply.code(400).send({error:'Invalid request'});
    if(!codeLimiter.take(p.data.email.toLowerCase())) return reply.code(429).send({error:'Too many attempts. Request a new code'});
    try { await pw.verifyEmail(p.data.email,p.data.code); } catch(e) { return fail(reply,e); }
    return {status:'verified'};
   });
   fastify.post('/auth/forgot-password',async(request:any,reply:any)=>{
    if(limited(request,reply)) return reply;
    const p=Forgot.safeParse(request.body); if(!p.success) return reply.code(400).send({error:'Invalid request'});
    if(mailLimiter.take(p.data.email.toLowerCase())) { try { await pw.forgotPassword(p.data.email); } catch(e) { return fail(reply,e); } }
    return reply.code(202).send({status:'code_sent'});
   });
   fastify.post('/auth/reset-password',async(request:any,reply:any)=>{
    if(limited(request,reply)) return reply;
    const p=Reset.safeParse(request.body); if(!p.success) return reply.code(400).send({error:'Invalid request'});
    if(!codeLimiter.take(p.data.email.toLowerCase())) return reply.code(429).send({error:'Too many attempts. Request a new code'});
    try { await pw.resetPassword(p.data.email,p.data.code,p.data.password); } catch(e) { return fail(reply,e); }
    return {status:'password_updated'};
   });
   fastify.post('/auth/login',async(request:any,reply:any)=>{
    if(limited(request,reply)) return reply;
    const p=Cred.safeParse(request.body); if(!p.success) return reply.code(400).send({error:'Invalid login request'});
    if(!emailLimiter.take(p.data.email.toLowerCase())) return reply.code(429).send({error:'Too many login attempts'});
    try {
     const id=await pw.authenticate(p.data.email,p.data.password);
     const {token,claims}=issueSession(id,services.sessionKey,12*60*60);
     return {token,expiresAt:new Date(claims.exp*1000).toISOString()};
    } catch(e) {
     if(e instanceof EmailNotVerifiedError) return reply.code(403).send({error:'Email not verified',code:'email_not_verified'});
     if(e instanceof AccountInactiveError) return reply.code(403).send({error:'Account unavailable'});
     return reply.code(401).send({error:'Invalid credentials'});
    }
   });
  }
 }
 // Coarse Boolean(services) alone was easy to misread as "open mutations";
 // report per-route mount state so health checks show exactly what exists.
 // Every mounted mutation route still requires a session + write role, and
 // sessions can only be minted when the login issuer itself is mounted.
 fastify.get('/health',async()=>({status:'ok',service:'leadloom-engine',mutationsEnabled:Boolean(services),outboundSendingEnabled:false,routes:{provisioning:services?.provisioning&&services.nextAuthBridgeKey?'mounted:bridge-token-required':'unmounted',entitlements:services?.entitlements?'enforced':'not_enforced',mutations:services?'mounted:session+write-role-required':'unmounted',loginIssuer:services?.userDirectory&&process.env.LEADLOOM_AUTH_ISSUER_ENABLED==='true'?'mounted':'unmounted',unsubscribe:services?.unsubscribeKey?'mounted':'unmounted',waterfall:services?.waterfall?'mounted:session-required':'unmounted',validator:services?.validator?'mounted:session-required':'unmounted',research:services?.websiteSignals?(services.websiteFetcher?'mounted:session-required:fetch-enabled':'mounted:session-required:pasted-text-only'):'unmounted'}}));
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
   services={credentials:new CredentialService(new PrismaCredentialRepository(prisma),vault),outbound:new AtomicDispatchRepository(new PrismaDispatchDatabase(prisma),undefined,{sendingEnabled:process.env.LEADLOOM_OUTBOUND_SENDING_ENABLED==='true'}),recipients:new CampaignRecipientsRepository(new PrismaDispatchDatabase(prisma)),sessionKey:key,userDirectory:new PrismaUserDirectory(prisma),...(unsubscribeKey?{unsubscribeKey}:{})};
   services.accessGuard=new PrismaAccessGuard(prisma);
   services.reads=new WorkspaceReadService(prisma as any);
   if(process.env.LEADLOOM_ENTITLEMENTS_ENFORCED==='true') {
    const {EntitlementService}=await import('./modules/entitlements/entitlements.service.js');
    const {PrismaEntitlementStore}=await import('./modules/entitlements/prisma-entitlement-store.js');
    const {DEFAULT_PLANS}=await import('./modules/entitlements/default-plans.js');
    const store=new PrismaEntitlementStore(prisma);
    services.entitlements=new EntitlementService(DEFAULT_PLANS,store,store);
   }
   if(process.env.LEADLOOM_NEXTAUTH_BRIDGE_ENABLED==='true') {
    const bridge=process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET?Buffer.from(process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET,'base64'):undefined;
    if(!bridge||bridge.length<32)throw new Error('LEADLOOM_NEXTAUTH_BRIDGE_SECRET (base64, >=32 bytes) required when bridge enabled');
    services.nextAuthBridgeKey=bridge;
   }
   if(process.env.LEADLOOM_SELF_SIGNUP_ENABLED==='true') {
    if(!services.nextAuthBridgeKey)throw new Error('LEADLOOM_SELF_SIGNUP_ENABLED requires the NextAuth bridge');
    const {ProvisioningService}=await import('./modules/provisioning/provisioning.service.js');
    const {PrismaProvisioningStore}=await import('./modules/provisioning/prisma-provisioning-store.js');
    const creationLimiter=new SlidingWindowLimiter(Number(process.env.LEADLOOM_SIGNUP_HOURLY_CAP??20),3_600_000);
    services.provisioning=new ProvisioningService(new PrismaProvisioningStore(prisma),()=>creationLimiter.take('new-accounts'));
   }
   if(process.env.LEADLOOM_TEAM_INVITES_ENABLED==='true') {
    const {InvitationService}=await import('./modules/invitations/invitation.service.js');
    const {PrismaInvitationStore}=await import('./modules/invitations/prisma-invitation-store.js');
    services.invitations=new InvitationService(new PrismaInvitationStore(prisma));
    const {MemberService}=await import('./modules/invitations/members.js');
    const {PrismaMemberStore}=await import('./modules/invitations/prisma-member-store.js');
    services.members=new MemberService(new PrismaMemberStore(prisma));
   }
   if(process.env.LEADLOOM_MAILBOX_CONNECT_ENABLED==='true') {
    const {MailboxConnectService}=await import('./modules/mailbox-connect/mailbox-connect.service.js');
    const {PrismaMailboxConnectStore}=await import('./modules/mailbox-connect/prisma-mailbox-connect-store.js');
    const PRIV=process.env.NODE_ENV!=='production'&&process.env.LEADLOOM_MAILBOX_ALLOW_PRIVATE_HOSTS==='true';
    const {RealConnectionVerifier}=await import('./modules/mailbox-connect/verifier.js');
    services.mailboxConnect=new MailboxConnectService(new PrismaMailboxConnectStore(prisma,vault),new RealConnectionVerifier({allowPrivateHosts:PRIV}),{allowPrivateHosts:PRIV});
   }
   if(process.env.LEADLOOM_PASSWORD_AUTH_ENABLED==='true') {
    const {createTransactionalEmail}=await import('./modules/email/transactional.js');
    let mailer=createTransactionalEmail(process.env,(u,i)=>fetch(u,i as any) as any);
    const sinkFile=process.env.LEADLOOM_DEV_MAIL_SINK_FILE;
    if(sinkFile) {
     if(process.env.NODE_ENV==='production')throw new Error('LEADLOOM_DEV_MAIL_SINK_FILE is not allowed in production');
     const {FileDevMailSink}=await import('./modules/email/dev-sink.js');
     mailer=new FileDevMailSink(sinkFile);
    }
    const {PrismaPasswordStore}=await import('./modules/password-auth/prisma-password-store.js');
    const signupCap=new SlidingWindowLimiter(Number(process.env.LEADLOOM_SIGNUP_HOURLY_CAP??20),3_600_000);
    services.passwordAccounts=new PasswordAccountService(new PrismaPasswordStore(prisma),mailer,{resendCooldownSeconds:Math.max(1,Number(process.env.LEADLOOM_OTP_RESEND_COOLDOWN_SECONDS??60)),otpKey:createHmac('sha256',services.sessionKey).update('leadloom-otp-v1').digest(),creationGate:()=>signupCap.take('new-password-accounts')});
   }
   // Opt-in product APIs, default OFF in every environment. Each requires an
   // explicit env flag; providers still need per-workspace BYOK keys at call
   // time, so mounting never implies provider access.
   // G6 registry endpoint: read-only reconcile of the connector registry with
   // masked BYOK credential status. No provider calls, no secrets leave the DB.
   {
    const {createDefaultConnectorRegistry}=await import('./modules/waterfall/connectors/registry.js');
    const {reconcileConnectorStatus}=await import('./modules/waterfall/connector-status.js');
    const registry=createDefaultConnectorRegistry();
    const {TestConnectionService}=await import('./modules/waterfall/connectors/test-connection.service.js');
    services.connectorTest=new TestConnectionService(registry,services.entitlements as never);
    services.waterfallConnectors={list:async(workspaceId:string)=>{
     const creds=await prisma!.byokCredential.findMany({where:{workspaceId}});
     return reconcileConnectorStatus(
      registry.list().map((c:any)=>({id:c.id,name:c.name,capabilities:c.capabilities})),
      creds.map((c:any)=>({provider:c.provider,maskedKey:c.maskedKey,label:c.label,isValid:c.isValid,lastVerifiedAt:c.lastVerifiedAt,updatedAt:c.updatedAt})),
     );
    }};
   }
   if(process.env.LEADLOOM_WATERFALL_API_ENABLED==='true') {
    const {WaterfallController}=await import('./modules/waterfall/waterfall.controller.js');
    const {WaterfallService}=await import('./modules/waterfall/waterfall.service.js');
    services.waterfall=new WaterfallController(new WaterfallService());
   }
   // G4 research API: heuristic website signals (no LLM, no egress for pasted
   // text). URL fetching is a separate opt-in with the private-host rule.
   if(process.env.LEADLOOM_RESEARCH_API_ENABLED==='true') {
    const {WebsiteSignalService}=await import('./modules/ai-researcher/website-signals.service.js');
    services.websiteSignals=new WebsiteSignalService();
    const {ResearchLeadsService}=await import('./modules/ai-researcher/research-leads.service.js');
    services.researchLeads=new ResearchLeadsService(prisma);
    const {IntentFixtureService}=await import('./modules/ai-researcher/intent-fixture.service.js');
    services.intentFixture=new IntentFixtureService(prisma);
    if(process.env.LEADLOOM_RESEARCH_FETCH_ENABLED==='true') {
     const {SafeWebsiteFetcher}=await import('./modules/ai-researcher/website-fetcher.js');
     const PRIV=process.env.NODE_ENV!=='production'&&process.env.LEADLOOM_MAILBOX_ALLOW_PRIVATE_HOSTS==='true';
     services.websiteFetcher=new SafeWebsiteFetcher({allowPrivateHosts:PRIV});
    }
   }
   if(process.env.LEADLOOM_VALIDATOR_API_ENABLED==='true') {
    const {ValidatorController}=await import('./modules/validator/validator.controller.js');
    const {ValidatorService}=await import('./modules/validator/validator.service.js');
    services.validator=new ValidatorController(new ValidatorService(process.env.APP_BASE_URL??'http://localhost:3000',prisma));
    // Public /v/ routes get a shared-store limiter so the cap holds across
    // replicas and restarts (the old per-process map did not - release gap).
    const {PgSharedLimiter}=await import('./modules/auth/rate-limiter.js');
    const db=prisma; // narrowed: this block only runs after a successful connect
    const pubPg=new PgSharedLimiter((text,params)=>db.$queryRawUnsafe(text,...params) as Promise<Array<Record<string,unknown>>>,600_000);
    services.publicRateLimit=(key,max)=>pubPg.take(key,max);
   }
  }
  const app=await createApplication(services);
  const close=async()=>{await app.close();await prisma?.$disconnect();vault?.destroy();};
  process.once('SIGTERM',()=>{void close();});process.once('SIGINT',()=>{void close();});
  await app.listen(Number(process.env.PORT??4000),process.env.HOST??'127.0.0.1');
 })().catch(()=>{console.error('Engine startup failed');process.exitCode=1;});
}
