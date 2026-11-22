import {PrepareDmpilotPostSchema,RecordDmpilotPreviewSchema} from '@leadloom/contracts';
import {DmpilotPostHandoffService,DmpilotHandoffConflict} from './modules/project-context/dmpilot-post-handoff.service';
import {PlatformOverviewService,InvalidPlatformCursor} from './modules/platform-admin/platform-overview.service';
import {PlatformOverviewQuerySchema} from '@leadloom/contracts';
import {ProjectGrowthWatchService,ProjectGrowthWatchWorker,GrowthWatchConflict,GrowthWatchInvalid,GrowthWatchAccess,GrowthWatchUnavailable} from './modules/growth-watches/project-growth-watch.service';
import {CreateProjectGrowthWatchSchema,UpdateProjectGrowthWatchSchema} from '@leadloom/contracts';
import {ProjectExperimentResultsSchema} from '@leadloom/contracts';
import {ProjectDiscoveryMatchSchema} from '@leadloom/contracts';
import {ProjectDiscoveryService,DiscoveryProfileInvalid} from './modules/signals-ingest/project-discovery.service';
import {ProjectResearchIndexQuerySchema,ProjectResearchDetailQuerySchema} from '@leadloom/contracts';
import {ResearchCursorInvalid} from './modules/ai-researcher/project-research-archive';
import {ProjectExperimentResultsService} from './modules/validator/project-experiment-results.service';
import {ProjectHnResearchService,HN_SEARCH_SCOPE,HnResearchUnavailable,HnResearchLimited,HnResearchBusy} from './modules/signals-ingest/project-hn-research.service';
import {RELEASE_BUILD_ID} from './release-identity.generated';
import {ProjectExperimentDraftService,ExperimentDraftConflict,ExperimentDraftDenied} from './modules/validator/project-experiment-draft.service';
import {CreateProjectExperimentDraftSchema,ApproveOutboundJobRequestSchema,ApprovalReviewRevisionSchema} from '@leadloom/contracts';
import {MailboxDnsService,MailboxDnsInputSchema} from './modules/outbound/mailbox-dns.service';
import {SavedWaterfallService,SavedWaterfallConflict,SavedWaterfallInvalid,ConfigureSavedWaterfallSchema,ReviseSavedWaterfallSchema} from './modules/waterfall/saved-waterfall.service';
import {WaterfallRunInvalid,WaterfallRunConflict} from './modules/waterfall/durable-waterfall.service';
import {PrivateCampaignService,PrivateCampaignConflict} from './modules/outbound/private-campaign.service';
import {RevisePrivateCampaignSchema} from '@leadloom/contracts';
import {ProjectInventoryService} from './modules/project-context/project-inventory.service';
import {CampaignCreateConflict,CampaignPoolConflict} from './modules/outbound/campaign-recipients.repository';
import {ProjectAssetService,AssetConflict} from './modules/project-context/project-asset.service';
import {CreateProjectAssetSchema,ReviseProjectAssetSchema,ProjectAssetQuerySchema} from '@leadloom/contracts';
import {DraftPageConflict,PagePublicationConflict,ExperimentNotFound} from './modules/validator/validator.service';
import {EditDraftPageCopySchema,PublishReviewedPageSchema} from '@leadloom/contracts';
import {ResearchTableConflict,ResearchProjectNotFound} from './modules/ai-researcher/research-row-store';
import {TableExportService,TableExportLimit} from './modules/workspace-read/table-export.service';
import {TableCellService,CellEditConflict,CellEditUnsupported} from './modules/workspace-read/table-cell.service';
import {TableImportService,TableImportConflict,TableImportTargetDeleted,TableImportLimit,TableImportProjectMissing} from './modules/workspace-read/table-import.service';
import {ImportTableSchema} from '@leadloom/contracts';
import { ProjectEntryService, EntryCursorInvalid, EntryRequestConflict } from './modules/project-context/project-entry.service';
import { CreateProjectEntrySchema, ProjectEntryQuerySchema } from '@leadloom/contracts';
import { importCapturedLeadsToTable,CapturedTableMappingInvalid,CapturedTableMappingConflict } from './modules/validator/captured-table-import';
import { changeExistingPassword } from './modules/auth/password-change.service';
import {connectorStatuses} from './modules/connectors/connector-registry';
import 'reflect-metadata';
import { createHmac, createHash } from 'node:crypto';
import { PrismaClient, runDbSchemaPreflight } from '@leadloom/database';
import { verifySession } from './modules/auth/session';
import { PrismaAccessGuard } from './modules/auth/access-guard';
import type { AccessGuard } from './modules/auth/access-guard';
import { AccountSuspendedError, SignupLimitedError } from './modules/provisioning/provisioning.service';
import { BYOKProviderEnum, CreateWorkspaceCampaignSchema,CreateProjectCampaignDraftSchema, IssueAgentTokenRequestSchema, PersistContextRequestSchema, CreateProjectRequestSchema, ImportCapturedLeadsRequestSchema } from '@leadloom/contracts';
import { hasScope } from './modules/auth/agent-token.service';
import { SlidingWindowLimiter } from './modules/auth/rate-limiter';
import type { ProvisioningService } from './modules/provisioning/provisioning.service';
import type { EntitlementService } from './modules/entitlements/entitlements.service';
import { FeatureKeySchema, LimitKeySchema, type FeatureKey, type LimitKey } from '@leadloom/contracts';
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
import { formatLeadsCsv } from './modules/validator/csv-export';
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
 /** Optional: mounted send worker (default off; LEADLOOM_WORKER_ENABLED). The app starts it after init and stops it on close. Sending itself stays separately gated on the repository's sendingEnabled flag. */
 outboundWorker?: { start(): void; stop(): void };
 /** Optional: mounted durable waterfall dispatch loop (default off;
  *  LEADLOOM_WATERFALL_DURABLE_DISPATCH + connected database). Already started
  *  by the mount seam; the app stops it on close. Jobs stay inert until the
  *  proposed D2 migration is applied on the host. */
 waterfallDispatch?: { stop(): void };
 /** Honest report of the send gate actually applied to the outbound repository (LEADLOOM_OUTBOUND_SENDING_ENABLED). */
 outboundSendingEnabled?: boolean;
 /** Optional: read-only tenant-scoped views of persisted data (mounted when provided). */
 reads?: Pick<WorkspaceReadService,'summary'|'tableSchema'|'listJobTimeline'|'listTables'|'listTableRows'|'listMailboxes'|'listCampaigns'|'listCampaignJobs'|'listSuppressions'|'listExperiments'>;
 /** Optional: admin-only workspace invitations (default off; LEADLOOM_TEAM_INVITES_ENABLED). Sends no mail. */
 invitations?: Pick<InvitationService,'invite'|'list'|'revoke'|'mine'|'accept'>;
 members?: Pick<MemberService,'list'|'setRole'|'remove'>;
 /** Optional: admin-only mailbox connect by IMAP/SMTP password (default off; LEADLOOM_MAILBOX_CONNECT_ENABLED). Sends no mail. */
 mailboxConnect?: Pick<MailboxConnectService,'connect'|'test'|'remove'>;
 /** Optional: mounted only when provided (main gates them behind explicit env flags). */
 waterfall?: Pick<WaterfallController,'getPreFlightEstimate'|'dispatch'|'getJobStatus'|'getJobUncertainRows'>;
 /** Optional: read-only waterfall connector registry reconciled with stored BYOK credentials (masked only). */
 waterfallConnectors?: { list(workspaceId: string): Promise<unknown> };
 connectorTest?: import('./modules/waterfall/connectors/test-connection.service.js').TestConnectionService;
 validator?: Pick<ValidatorController,'generate'|'recordOutreach'|'getOwnerPage'|'editDraftCopy'|'setPublishStatus'|'getScorecard'|'submitLead'|'getPublicPage'|'getLeads'>;
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
 entitlements?: Pick<EntitlementService,'checkFeature'|'checkLimit'> & Partial<Pick<EntitlementService,'status'>>;
 /** Optional: scoped, revocable agent API tokens (Slice A). */
 agentTokens?: import('./modules/auth/agent-token.service.js').AgentTokenService;
 /** Optional: project-scoped agent context persist & restore (Slice B). */
 projectContext?: import('./modules/project-context/project-context.service.js').ProjectContextService;
 /** Optional: canonical workspace-owned projects registry (Slice B). */
 projectRegistry?: import('./modules/project-context/project-registry.service.js').ProjectRegistryService;
 /** Opt-in public HN queries, no storage. Requires an explicit search scope and shared rate store. */
 projectHnResearch?:ProjectHnResearchService;
 projectAssets?: ProjectAssetService;
 projectInventory?:ProjectInventoryService;
 growthWatches?:ProjectGrowthWatchService;
 growthWatchWorker?:ProjectGrowthWatchWorker;
 projectEntries?: ProjectEntryService;
 tableExports?: TableExportService;
 mailboxDns?:MailboxDnsService;
 savedWaterfalls?:SavedWaterfallService;
 privateCampaigns?:PrivateCampaignService;
 tableCells?: TableCellService;
 tableImports?: TableImportService;
 prisma?: any;
}
export async function createApplication(services?:RuntimeServices) {
 // Client IP for per-IP limiters: trust X-Forwarded-For only when the peer is
 // loopback (our own web proxy); direct non-loopback callers cannot spoof it.
 // Recorded deployment prerequisite: the ingress strips client-supplied XFF
 // (PUMPGTM_GAP G13). Until then the global ceilings are the backstop.
 const clientIp=(request:any):string=>{
  const peer=String(request.ip??'unknown');
  if(peer==='127.0.0.1'||peer==='::1'||peer==='::ffff:127.0.0.1'){
   const fwd=String(request.headers?.['x-forwarded-for']??'').split(',')[0].trim();
   if(fwd)return fwd;
  }
  return peer;
 };
 const app=await NestFactory.create<NestFastifyApplication>(RuntimeModule,new FastifyAdapter({bodyLimit:524288}),{logger:['error','warn']});
 const fastify=app.getHttpAdapter().getInstance();
 let authorize:any=null;
 if(services) {
  authorize=async(request:any,reply:any,write=false,requiredScope?:string)=>{
   try {
    const token=String(request.headers.authorization??'').replace(/^Bearer /,'');
    let claims: any;let engineSession=false;let providerAuthTime: number | undefined;let providerSession=false;
    if(token.startsWith('lld_agt_')) {
     if(!services.agentTokens) throw new Error('Agent token service unavailable');
     const verified=await services.agentTokens.verify(token);
     if(!verified) throw new Error('Invalid, expired or revoked agent token');
     claims={sub:verified.userId,workspaceId:verified.workspaceId,projectId:verified.projectId,role:verified.role,exp:verified.expiresAt?Math.floor(verified.expiresAt.getTime()/1000):2147483647,isAgentToken:true,scopes:verified.scopes,tokenId:verified.id};
     if(!requiredScope) {
      reply.code(403).send({error:'Route not accessible by agent token (unannotated route)'});
      return null;
     }
     if(claims.projectId) {
      const isProjectScoped = requiredScope.startsWith('context:') || requiredScope.startsWith('project:context:') || (requiredScope==='project:experiments:read'||requiredScope==='project:experiments:draft'||requiredScope==='project:experiments:results') || requiredScope==='project:campaigns:read' || requiredScope==='project:tables:read' || requiredScope==='project:tables:write' || requiredScope==='project:campaigns:edit' || requiredScope==='project:campaigns:draft' || requiredScope==='project:assets:read' || requiredScope==='project:assets:write' || requiredScope==='project:research:read' || requiredScope===HN_SEARCH_SCOPE || requiredScope==='project:inventory:read';
      if(!isProjectScoped) {
       reply.code(403).send({error:'Project-scoped agent token cannot access workspace-wide routes'});
       return null;
      }
     }
     if(!hasScope(verified.scopes, requiredScope, write)) {
      reply.code(403).send({error:'Insufficient scope', required: requiredScope});
      return null;
     }
     if(write && !hasScope(verified.scopes, requiredScope ?? '*', true)) {
      reply.code(403).send({error:'Insufficient scope for write action'});
      return null;
     }
    } else {
     try {claims=verifySession(token,services.sessionKey);engineSession=true;}
     catch(e) {
      if(!services.nextAuthBridgeKey||!services.userDirectory) throw e;
      const proven=verifyBridgeToken(token,services.nextAuthBridgeKey);
      providerSession=true;providerAuthTime=proven.authTime;
      await services.passwordAccounts?.claimByProvider(proven.email);
      const member=await services.userDirectory.findByEmail(proven.email);
      if(!member) throw new Error('No membership');
      claims={sub:member.id,workspaceId:member.workspaceId,role:member.role,exp:proven.exp};
     }
    }
    if(services.accessGuard&&!await services.accessGuard.isActive(claims.sub,claims.workspaceId,engineSession?{kind:'engine',ver:(claims as any).ver}:providerSession?{kind:'provider',authTime:providerAuthTime}:undefined)) {reply.code(401).send({error:'Authentication required'});return null;}
    if(write && !canWrite(claims)) {reply.code(403).send({error:'Read-only workspace role'});return null;}
    return claims;
   } catch {reply.code(401).send({error:'Authentication required'});return null;}
  };
  // Who am I: lets the web app gate /app and /admin on the engine's own answer.
  // Identity, workspace and role come only from the engine's tables. Never accepts input.
  fastify.get('/auth/me',async(request:any,reply:any)=>{
   const session=await authorize(request,reply);if(!session)return;
   let name: string | null = null;
   if(services.prisma) {
    try { name=(await services.prisma.user.findUnique({where:{id:session.sub},select:{name:true}}))?.name ?? null; }
    catch { return reply.code(503).send({error:'Profile service unavailable'}); }
   }
   return {userId:session.sub,workspaceId:session.workspaceId,role:session.role,name};
  });
  fastify.patch('/auth/profile',async(request:any,reply:any)=>{
   const session=await authorize(request,reply);if(!session)return;
   const name=typeof request.body?.name==='string'?request.body.name.trim():'';
   if(!name||name.length>255) return reply.code(400).send({error:'Display name must be between 1 and 255 characters'});
   if(!services.prisma)return reply.code(503).send({error:'Profile service unavailable'});
   try {
    const changed=await services.prisma.$queryRawUnsafe('UPDATE users SET name=$3, updated_at=clock_timestamp() WHERE id=$1::uuid AND workspace_id=$2::uuid AND disabled_at IS NULL RETURNING name',session.sub,session.workspaceId,name);
    if(changed.length!==1)return reply.code(409).send({error:'Profile was not updated. Reload before retrying.'});
    return {ok:true,name:changed[0].name};
   } catch {return reply.code(503).send({error:'Could not confirm profile update. Reload before retrying.'});}
  });
  fastify.post('/auth/password/update',async(request:any,reply:any)=>{
   const session=await authorize(request,reply);if(!session)return;
   const currentPassword=typeof request.body?.currentPassword==='string'?request.body.currentPassword:'';
   const newPassword=typeof request.body?.newPassword==='string'?request.body.newPassword:'';
   try {
    const result=await changeExistingPassword(services.prisma,session.sub,currentPassword,newPassword);
    if(!result.ok)return reply.code(result.status).send({error:result.error});
    return {ok:true,message:'Password updated. Sign in again.'};
   } catch {
    return reply.code(503).send({error:'Could not confirm password update. Sign in again to check before retrying.'});
   }
  });
  const platformOperator=async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return null;
   const configured=process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
   if(!configured){reply.code(403).send({error:'Platform admin not configured (fail-closed)'});return null;}
   if(!services.prisma){reply.code(503).send({error:'Platform operator identity storage unavailable'});return null;}
   try{
    const user=await services.prisma.user.findUnique({where:{id:session.sub},select:{email:true,disabledAt:true,emailVerifiedAt:true}});
    if(!user||user.disabledAt!==null||(user.emailVerifiedAt===null&&!session.email_verified)||user.email?.toLowerCase()!==configured){reply.code(403).send({error:'Active verified platform administrator required'});return null;}
    return{session,email:user.email.toLowerCase()};
   }catch{reply.code(503).send({error:'Platform operator identity storage unavailable'});return null;}
  };
  fastify.get('/admin/verify',async(request:any,reply:any)=>{
   reply.header('Cache-Control','no-store');
   const operator=await platformOperator(request,reply);if(!operator)return;
   return {ok:true,admin:true,email:operator.email,verified:true,active:true};
  });
  fastify.get('/admin/overview',async(request:any,reply:any)=>{
   reply.header('Cache-Control','no-store');
   const operator=await platformOperator(request,reply);if(!operator)return;
   const query=PlatformOverviewQuerySchema.safeParse(request.query);
   if(!query.success)return reply.code(400).send({error:'Invalid platform overview query'});
   try{return await new PlatformOverviewService(services.prisma).get(query.data);}
   catch(e){if(e instanceof InvalidPlatformCursor)return reply.code(400).send({error:e.message});return reply.code(503).send({error:'Platform overview unavailable. No snapshot was confirmed.'});}
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
    if(!provisionLimiter.take('ip:'+clientIp(request))||!provisionLimiter.take('global')) return reply.code(429).send({error:'Too many requests'});
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
  fastify.get('/workspace/plan-status',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Workspace comes only from the session'});reply.header('Cache-Control','no-store');if(!services.entitlements)return{enforcement:'disabled',asOf:new Date().toISOString(),plan:null,features:[],limits:[],notes:['Plan enforcement is disabled in this runtime. No plan, usage or available quota is inferred. Hard safety, validation and rate limits still apply.']};if(!services.entitlements.status)return reply.code(503).send({error:'Current plan policy unavailable'});try{return await services.entitlements.status(s.workspaceId);}catch{return reply.code(503).send({error:'Current plan policy unavailable'});}});
  const allowed=async(reply:any,workspaceId:string,feature:FeatureKey)=>{
   if(!services.entitlements)return true;
   const decision=await services.entitlements.checkFeature(workspaceId,feature);
   if(decision.allowed)return true;
   reply.code(403).send({error:'Not available on the current plan',reason:decision.reason,feature});
   return false;
  };
  if(services.entitlements){
   // The one place the web learns plan decisions (GATING.md: the engine
   // decides, the web only renders). Session-bound; keys validated against
   // the shared contract. Default-off: unmounted when entitlements are not
   // configured, exactly like the enforcement it reports on.
   fastify.get('/entitlements/decision',async(request:any,reply:any)=>{
    const s=await authorize(request,reply);if(!s)return;
    const q=(request.query??{}) as Record<string,unknown>;
    const out:{feature?:{key:FeatureKey;decision:unknown};limit?:{key:LimitKey;decision:unknown}}={};
    if(q.feature!==undefined){
     const f=FeatureKeySchema.safeParse(q.feature);
     if(!f.success)return reply.code(400).send({error:'Unknown feature key'});
     out.feature={key:f.data,decision:await services.entitlements!.checkFeature(s.workspaceId,f.data)};
    }
    if(q.limit!==undefined){
     const l=LimitKeySchema.safeParse(q.limit);
     if(!l.success)return reply.code(400).send({error:'Unknown limit key'});
     const requested=q.requested===undefined?1:Number(q.requested);
     if(!Number.isInteger(requested)||requested<1||requested>1000000)return reply.code(400).send({error:'requested must be a positive integer'});
     out.limit={key:l.data,decision:await services.entitlements!.checkLimit(s.workspaceId,l.data,requested)};
    }
    if(!out.feature&&!out.limit)return reply.code(400).send({error:'feature or limit query is required'});
    return out;
   });
  }
  // Explicit project-owned text tables. Workspace routes remain broad for humans/workspace credentials.
  {
   const importLimit=new SlidingWindowLimiter(10,60_000),editLimit=new SlidingWindowLimiter(60,60_000);
   const bound=async(request:any,reply:any,write=false)=>{const s=await authorize(request,reply,write,write?'project:tables:write':'project:tables:read');if(!s)return null;if(!s.isAgentToken||!s.projectId){reply.code(403).send({error:'Project-bound agent credential required'});return null;}if(!services.projectRegistry){reply.code(503).send({error:'Project registry unavailable'});return null;}try{if(!await services.projectRegistry.findByIdOrSlug(s.workspaceId,s.projectId)){reply.code(404).send({error:'Project not found'});return null;}}catch{reply.code(503).send({error:'Project registry unavailable'});return null;}return s;};
   fastify.get('/agent/project/tables',async(request:any,reply:any)=>{const s=await bound(request,reply);if(!s)return;if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Project comes only from the credential'});if(!services.reads)return reply.code(503).send({error:'Table reads unavailable'});try{return await services.reads.listTables(s.workspaceId,s.projectId);}catch{return reply.code(503).send({error:'Table reads unavailable'});}});
   fastify.get('/agent/project/tables/:tableId/rows',async(request:any,reply:any)=>{const s=await bound(request,reply);if(!s)return;const id=z.string().uuid().safeParse(request.params.tableId),q=z.object({offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().safeParse(request.query??{});if(!id.success||!q.success)return reply.code(400).send({error:'Invalid table page'});if(!services.reads)return reply.code(503).send({error:'Table reads unavailable'});try{const r=await services.reads.listTableRows(s.workspaceId,id.data,q.data.offset,s.projectId);return r??reply.code(404).send({error:'Table not found'});}catch{return reply.code(503).send({error:'Table reads unavailable'});}});
   fastify.post('/agent/project/tables/import',{bodyLimit:262144},async(request:any,reply:any)=>{const s=await bound(request,reply,true);if(!s)return;if(!services.tableImports)return reply.code(503).send({error:'Table imports unavailable'});if(!importLimit.take(s.workspaceId))return reply.code(429).send({error:'Too many table imports'});const p=ImportTableSchema.safeParse(request.body);if(!p.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Invalid table import. Project comes only from the credential.'});try{const r=await services.tableImports.import(s.workspaceId,p.data,s.projectId);return reply.code(r.created?201:200).send(r);}catch(e){if(e instanceof TableImportProjectMissing)return reply.code(404).send({error:'Project not found'});if(e instanceof TableImportTargetDeleted)return reply.code(409).send({error:'The original imported table was deleted. This request cannot recreate it. A deliberate new import needs a new request ID.'});if(e instanceof TableImportConflict)return reply.code(409).send({error:'Request ID already used for different table data or project'});if(e instanceof TableImportLimit)return reply.code(403).send({error:'Table creation unavailable on this plan'});return reply.code(503).send({error:'Import not confirmed. Retry unchanged input and request ID.'});}});
   fastify.patch('/agent/project/tables/:tableId/cells',async(request:any,reply:any)=>{const s=await bound(request,reply,true);if(!s)return;if(!services.tableCells)return reply.code(503).send({error:'Cell editing unavailable'});if(!editLimit.take(s.workspaceId))return reply.code(429).send({error:'Too many cell edits'});const id=z.string().uuid().safeParse(request.params.tableId),p=z.object({rowId:z.string().uuid(),columnId:z.string().uuid(),expectedValue:z.string().max(10000).nullable(),value:z.string().max(10000)}).strict().safeParse(request.body);if(!id.success||!p.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Invalid project text-cell edit'});try{const r=await services.tableCells.edit(s.workspaceId,id.data,p.data,s.projectId);return r??reply.code(404).send({error:'Table cell not found'});}catch(e){if(e instanceof CellEditConflict)return reply.code(409).send({error:'Cell changed since restore. Reload saved rows before editing.'});if(e instanceof CellEditUnsupported)return reply.code(400).send({error:'Only plain text cells in text columns can be edited'});return reply.code(503).send({error:'Cell save not confirmed. Keep local input and reload before retrying.'});}});
  }
  if(services.tableExports){
   const exportLimiter=new SlidingWindowLimiter(5,60_000);
   fastify.get('/workspace/tables/:tableId/export',async(request:any,reply:any)=>{
    const session=await authorize(request,reply);if(!session)return;
    if(!exportLimiter.take(session.workspaceId))return reply.code(429).send({error:'Too many exports. Try again in a minute.'});
    const id=z.string().uuid().safeParse(request.params.tableId);if(!id.success)return reply.code(400).send({error:'Invalid table ID'});
    try{
     const result=await services.tableExports!.export(session.workspaceId,id.data);if(!result)return reply.code(404).send({error:'Table not found'});
     return reply.header('Content-Type','text/csv; charset=utf-8').header('Content-Disposition',`attachment; filename="leadloom-table-${id.data}.csv"`).header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('X-Export-Row-Count',String(result.rowCount)).send(result.csv);
    }catch(e){if(e instanceof TableExportLimit)return reply.code(413).send({error:'Table export exceeds 5,000 rows, 100 columns, 100,000 cells or the 2 MB value budget. No partial export was created.'});return reply.code(503).send({error:'Table export could not be completed. No partial export was created.'});}
   });
  }
  if(services.mailboxDns){const dnsLimit=new SlidingWindowLimiter(10,60_000);fastify.post('/workspace/mailboxes/:mailboxId/dns-diagnostics',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;if(!dnsLimit.take(s.workspaceId))return reply.code(429).send({error:'Too many DNS diagnostics. Wait a minute.'});const id=z.string().uuid().safeParse(request.params.mailboxId),input=MailboxDnsInputSchema.safeParse(request.body);if(!id.success||!input.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Use a saved mailbox ID and up to five provider-supplied DKIM selectors only'});reply.header('Cache-Control','no-store');try{const result=await services.mailboxDns!.inspect(s.workspaceId,id.data,input.data.dkimSelectors);return result??reply.code(404).send({error:'Mailbox not found'});}catch{return reply.code(503).send({error:'DNS diagnostics unavailable. No mailbox health or sending state was changed.'});}});}
  if(services.savedWaterfalls){
   const limit=new SlidingWindowLimiter(20,60_000);
   const savedIdentity=async(request:any,reply:any,write:boolean)=>{const s=await authorize(request,reply,write);if(!s)return null;if(Object.keys(request.query??{}).length){reply.code(400).send({error:'Workspace comes only from the session'});return null;}const id=z.string().uuid().safeParse(request.params.tableId);if(!id.success){reply.code(400).send({error:'Invalid table ID'});return null;}if(!limit.take(s.workspaceId)){reply.code(429).send({error:'Too many saved waterfall requests'});return null;}reply.header('Cache-Control','no-store');return{...s,tableId:id.data};};
   fastify.post('/workspace/tables/:tableId/waterfall-columns',async(request:any,reply:any)=>{const s=await savedIdentity(request,reply,true);if(!s)return;const p=ConfigureSavedWaterfallSchema.safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Supply a column ID, unique name and distinct domain/firstName/lastName input-column mappings'});try{const r=await services.savedWaterfalls!.configure(s.workspaceId,s.tableId,p.data);return r?reply.code(r.created?201:200).send(r):reply.code(404).send({error:'Table not found'});}catch(e){if(e instanceof SavedWaterfallConflict)return reply.code(409).send({error:e.message});if(e instanceof SavedWaterfallInvalid)return reply.code(400).send({error:e.message});return reply.code(503).send({error:'Configuration save unconfirmed. Keep the same column ID and input to retry.'});}});
   fastify.get('/workspace/tables/:tableId/waterfall-columns/:columnId',async(request:any,reply:any)=>{const s=await savedIdentity(request,reply,false);if(!s)return;const id=z.string().uuid().safeParse(request.params.columnId);if(!id.success)return reply.code(400).send({error:'Invalid column ID'});try{const r=await services.savedWaterfalls!.read(s.workspaceId,s.tableId,id.data);return r??reply.code(404).send({error:'Saved waterfall not found'});}catch(e){if(e instanceof SavedWaterfallInvalid)return reply.code(400).send({error:e.message});return reply.code(503).send({error:'Saved mapping unavailable. No configuration changed.'});}});
   fastify.put('/workspace/tables/:tableId/waterfall-columns/:columnId',async(request:any,reply:any)=>{const s=await savedIdentity(request,reply,true);if(!s)return;const id=z.string().uuid().safeParse(request.params.columnId),p=ReviseSavedWaterfallSchema.safeParse(request.body);if(!id.success||!p.success)return reply.code(400).send({error:'Supply a valid saved column, current revision, unique name and distinct mappings'});try{const r=await services.savedWaterfalls!.revise(s.workspaceId,s.tableId,id.data,p.data);return r??reply.code(404).send({error:'Saved waterfall not found'});}catch(e){if(e instanceof SavedWaterfallConflict)return reply.code(409).send({error:e.message});if(e instanceof SavedWaterfallInvalid)return reply.code(400).send({error:e.message});return reply.code(503).send({error:'Mapping revision unconfirmed. Retry the unchanged edit or reload current mapping.'});}});
   fastify.post('/workspace/tables/:tableId/waterfall-preview',async(request:any,reply:any)=>{const s=await savedIdentity(request,reply,false);if(!s)return;const p=z.object({columnId:z.string().uuid(),rowIds:z.array(z.string().uuid()).min(1).max(100).refine(v=>new Set(v).size===v.length)}).strict().safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Select one saved waterfall column and1to100distinct row IDs'});try{const r=await services.savedWaterfalls!.preview(s.workspaceId,s.tableId,p.data.columnId,p.data.rowIds);return r??reply.code(404).send({error:'Table not found'});}catch(e){if(e instanceof WaterfallRunInvalid||e instanceof WaterfallRunConflict)return reply.code(400).send({error:e.message});return reply.code(503).send({error:'Input validation unavailable. No work queued or provider called.'});}});
  }
  if(services.tableCells){
   const editLimiter=new SlidingWindowLimiter(60,60_000);
   fastify.patch('/workspace/tables/:tableId/cells',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'tables:write');if(!session)return;
    if(!editLimiter.take(session.workspaceId))return reply.code(429).send({error:'Too many cell edits. Try again in a minute.'});
    const tableId=z.string().uuid().safeParse(request.params.tableId);
    const input=z.object({rowId:z.string().uuid(),columnId:z.string().uuid(),expectedValue:z.string().max(10000).nullable(),value:z.string().max(10000)}).strict().safeParse(request.body);
    if(!tableId.success||!input.success)return reply.code(400).send({error:'Invalid text cell edit'});
    try{
     const result=await services.tableCells!.edit(session.workspaceId,tableId.data,input.data);
     if(!result)return reply.code(404).send({error:'Table cell not found'});
     return result;
    }catch(e){
     if(e instanceof CellEditConflict)return reply.code(409).send({error:'This cell changed since you opened it. Reload the saved rows before editing again.'});
     if(e instanceof CellEditUnsupported)return reply.code(400).send({error:'Only plain text cells in text columns can be edited here.'});
     return reply.code(503).send({error:'Cell save was not confirmed. Keep your edit and reload before retrying.'});
    }
   });
  }
  if(services.tableImports){
   const importLimiter=new SlidingWindowLimiter(10,60_000);
   fastify.post('/workspace/tables/import',{bodyLimit:1048576},async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'tables:write');if(!session)return;
    if(!importLimiter.take(session.workspaceId))return reply.code(429).send({error:'Too many table imports. Try again in a minute.'});
    const parsed=ImportTableSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Invalid table import. Use unique headers, matching row widths and the documented limits.'});
    try{const result=await services.tableImports!.import(session.workspaceId,parsed.data);return reply.code(result.created?201:200).send(result);}
    catch(e){if(e instanceof TableImportTargetDeleted)return reply.code(409).send({error:'The original imported table was deleted. This request cannot recreate it. A deliberate new import needs a new request ID.'});if(e instanceof TableImportConflict)return reply.code(409).send({error:'This request ID was already used for different table data'});if(e instanceof TableImportLimit)return reply.code(403).send({error:'Table limit reached or table creation is unavailable on this plan'});return reply.code(503).send({error:'Import was not confirmed. Keep the same request and reload before retrying.'});}
   });
  }
  if(services.reads){
   const reads=services.reads;
   fastify.get('/workspace/summary',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.summary(s.workspaceId);});
   fastify.get('/workspace/tables',async(request:any,reply:any)=>{const s=await authorize(request,reply,false,'tables:read');if(!s)return;return reads.listTables(s.workspaceId);});
   fastify.get('/workspace/tables/:tableId/schema',async(request:any,reply:any)=>{const s=await authorize(request,reply,false,'tables:read');if(!s)return;const id=z.string().uuid().safeParse(request.params.tableId);if(!id.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Invalid table schema request'});try{const result=await reads.tableSchema(s.workspaceId,id.data);return result??reply.code(404).send({error:'Table not found'});}catch{return reply.code(503).send({error:'Table schema unavailable. No rows changed.'});}});
   fastify.get('/workspace/tables/:tableId/rows',async(request:any,reply:any)=>{
    const s=await authorize(request,reply,false,'tables:read');if(!s)return;
    const id=z.string().uuid().safeParse(request.params.tableId);if(!id.success)return reply.code(400).send({error:'Invalid table ID'});
    const query=z.object({offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().safeParse(request.query);if(!query.success)return reply.code(400).send({error:'Invalid table page'});
    const result=await reads.listTableRows(s.workspaceId,id.data,query.data.offset);
    if(!result)return reply.code(404).send({error:'Table not found'});
    return result;
   });
   fastify.get('/workspace/mailboxes',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.listMailboxes(s.workspaceId);});
   fastify.get('/workspace/connectors/status',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return {connectors:connectorStatuses()};});
   if(services.waterfallConnectors) {
    fastify.get('/waterfall/connectors',async(request:any,reply:any)=>{
     const session=await authorize(request,reply);if(!session)return;
     return {connectors:await services.waterfallConnectors!.list(session.workspaceId),sendingEnabled:services.outboundSendingEnabled===true};
    });
   }
   fastify.get('/workspace/suppressions',async(request:any,reply:any)=>{const s=await authorize(request,reply);if(!s)return;return reads.listSuppressions(s.workspaceId);});
   const listExperiments=async(request:any,reply:any)=>{
    const s=await authorize(request,reply,false,'experiments:read');if(!s)return;
    const parsed=z.object({projectId:z.union([z.string().uuid(),z.literal('unassigned')]).optional()}).strict().safeParse(request.query??{});
    if(!parsed.success)return reply.code(400).send({error:'Invalid experiment filter'});
    const projectId=parsed.data.projectId;
    if(projectId&&projectId!=='unassigned'&&(!services.projectRegistry||!await services.projectRegistry.findByIdOrSlug(s.workspaceId,projectId)))return reply.code(404).send({error:'Project not found'});
    return reads.listExperiments(s.workspaceId,projectId==='unassigned'?null:projectId);
   };
   fastify.get('/workspace/experiments',listExperiments);
   fastify.get('/validator/experiments',listExperiments);
   fastify.get('/workspace/campaigns',async(request:any,reply:any)=>{
    const s=await authorize(request,reply,false,'campaigns:read');if(!s)return;
    const parsed=z.object({projectId:z.union([z.string().uuid(),z.literal('unassigned')]).optional()}).strict().safeParse(request.query??{});
    if(!parsed.success)return reply.code(400).send({error:'Invalid campaign filter'});
    const projectId=parsed.data.projectId;
    if(projectId&&projectId!=='unassigned'&&(!services.projectRegistry||!await services.projectRegistry.findByIdOrSlug(s.workspaceId,projectId)))return reply.code(404).send({error:'Project not found'});
    return reads.listCampaigns(s.workspaceId,projectId==='unassigned'?null:projectId);
   });
   // Per-recipient job drill-down: tenant check inside the read service (null -> 404,
   // no existence leak). Job metadata only - no step bodies or provider ids.
   fastify.get('/campaigns/:campaignId/jobs',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'campaigns:read');if(!session)return;
    const campaignId=z.string().uuid().safeParse((request.params as any)?.campaignId);
    if(!campaignId.success)return reply.code(400).send({error:'Invalid campaign id'});
    const result=await reads.listCampaignJobs(session.workspaceId,campaignId.data);
    if(!result)return reply.code(404).send({error:'Campaign not found'});
    return reply.code(200).send(result);
   });
   // Delivery-event timeline for one job: tenant check inside the read service
   // (null -> 404, no existence leak). Events map to recorded columns only.
   fastify.get('/campaigns/:campaignId/jobs/:jobId/timeline',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false);if(!session)return;
    const campaignId=z.string().uuid().safeParse((request.params as any)?.campaignId);
    const jobId=z.string().uuid().safeParse((request.params as any)?.jobId);
    if(!campaignId.success||!jobId.success)return reply.code(400).send({error:'Invalid campaign or job id'});
    const result=await reads.listJobTimeline(session.workspaceId,campaignId.data,jobId.data);
    if(!result)return reply.code(404).send({error:'Job not found'});
    return reply.code(200).send(result);
   });
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
    if(r.ok)return reply.code(201).send({invitation:r.invitation,emailSent:r.emailSent});
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
  if(services.agentTokens) {
   const at=services.agentTokens;
   const issueTokenHandler=async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if((session as any).isAgentToken) return reply.code(403).send({error:'Agent tokens cannot issue agent tokens'});
    const p=IssueAgentTokenRequestSchema.safeParse(request.body);
    if(!p.success) return reply.code(400).send({error:'Invalid agent token request'});
    if(p.data.scopes.some(scope=>['project:tables:read','project:tables:write','project:experiments:read','project:experiments:draft','project:experiments:results','project:campaigns:read','project:campaigns:edit','project:campaigns:draft','project:assets:read','project:assets:write','project:research:read',HN_SEARCH_SCOPE,'project:inventory:read'].includes(scope))&&!p.data.projectId)return reply.code(400).send({error:'Project-specific scopes require an explicit project binding'});
    let resolvedProjectId: string | undefined = undefined;
    if(p.data.projectId) {
     if(!services.projectRegistry) {
      return reply.code(503).send({error:'Project registry service unavailable for project validation'});
     }
     const project=await services.projectRegistry.findByIdOrSlug(session.workspaceId, p.data.projectId);
     if(!project) return reply.code(400).send({error:'Project does not exist or does not belong to this workspace'});
     resolvedProjectId=project.id;
    }
    const res=await at.issue(session.workspaceId,session.sub,{...p.data, projectId: resolvedProjectId});
    return reply.code(201).send(res);
   };
   const listTokensHandler=async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false);if(!session)return;
    const list=await at.list(session.workspaceId);
    return reply.code(200).send(list);
   };
   const revokeTokenHandler=async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    const id=z.string().uuid().safeParse(request.params?.id);
    if(!id.success) return reply.code(400).send({error:'Invalid token ID'});
    const ok=await at.revoke(session.workspaceId,id.data,session.sub);
    if(!ok) return reply.code(404).send({error:'Agent token not found'});
    return reply.code(200).send({id:id.data,revoked:true});
   };
   fastify.post('/agent-tokens',issueTokenHandler);
   fastify.get('/agent-tokens',listTokensHandler);
   fastify.post('/agent-tokens/:id/revoke',revokeTokenHandler);
   fastify.post('/workspace/agent-tokens',issueTokenHandler);
   fastify.get('/workspace/agent-tokens',listTokensHandler);
   fastify.post('/workspace/agent-tokens/:id/revoke',revokeTokenHandler);
  }
  if(services.projectRegistry) {
   const pr=services.projectRegistry;
   const listProjectsHandler=async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false);if(!session)return;
    if((session as any).isAgentToken) return reply.code(403).send({error:'Agent tokens cannot list projects (human sessions only)'});
    const list=await pr.list(session.workspaceId);
    return reply.code(200).send(list);
   };
   const createProjectHandler=async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if((session as any).isAgentToken) return reply.code(403).send({error:'Agent tokens cannot create projects (human sessions only)'});
    const p=CreateProjectRequestSchema.safeParse(request.body);
    if(!p.success) return reply.code(400).send({error:p.error.issues[0]?.message??'Invalid project request',details:p.error.issues});
    try {
     const res=await pr.create(session.workspaceId,session.sub,p.data);
     return reply.code(201).send(res);
    } catch(err:any) {
     if(err?.statusCode===409||err?.name==='DuplicateProjectSlugError') {
      return reply.code(409).send({error:'A project with this slug already exists in this workspace'});
     }
     if(err?.statusCode===400||err?.name==='InvalidProjectSlugError') {
      return reply.code(400).send({error:err?.message??'Project slug cannot be formatted as a UUID'});
     }
     throw err;
    }
   };
   fastify.get('/projects',listProjectsHandler);
   fastify.post('/projects',createProjectHandler);
   fastify.get('/workspace/projects',listProjectsHandler);
   fastify.post('/workspace/projects',createProjectHandler);
  }
  if(services.projectRegistry&&services.reads){
   const campaignObserver=async(request:any,reply:any)=>{
    const s=await authorize(request,reply,false,'project:campaigns:read');if(!s)return null;
    if(!s.isAgentToken||!s.projectId){reply.code(403).send({error:'Project-bound observation token required'});return null;}
    if(Object.keys(request.query??{}).length){reply.code(400).send({error:'Project identity comes from token only'});return null;}
    if(!await services.projectRegistry!.findByIdOrSlug(s.workspaceId,s.projectId)){reply.code(404).send({error:'Project not found'});return null;}return s;
   };
   fastify.get('/agent/project/campaigns',async(request:any,reply:any)=>{const s=await campaignObserver(request,reply);if(!s)return;return services.reads!.listCampaigns(s.workspaceId,s.projectId!);});
   fastify.get('/agent/project/campaigns/:id/jobs',async(request:any,reply:any)=>{
    const s=await campaignObserver(request,reply);if(!s)return;
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid campaign id'});
    const result=await services.reads!.listCampaignJobs(s.workspaceId,id.data,s.projectId!);if(!result)return reply.code(404).send({error:'Campaign not found'});return result;
   });
  }
  if(services.growthWatches){
   const limiter=new SlidingWindowLimiter(60,60_000);
   const access=async(request:any,reply:any,write=false)=>{const s=await authorize(request,reply,write);if(!s)return null;reply.header('Cache-Control','no-store');const project=z.string().uuid().safeParse(request.params.projectId);if(!project.success||Object.keys(request.query??{}).length){reply.code(400).send({error:'Exact project UUID and no query parameters required'});return null;}if(!limiter.take(s.workspaceId)){reply.code(429).send({error:'Too many growth watch requests'});return null;}return{...s,projectId:project.data};};
   const failure=(reply:any,e:unknown)=>{if(e instanceof GrowthWatchAccess)return reply.code(403).send({error:'Current workspace write access required'});if(e instanceof GrowthWatchConflict)return reply.code(409).send({error:'Watch request/configuration changed. Reload the existing watch; do not start another request to retry.'});if(e instanceof GrowthWatchInvalid)return reply.code(400).send({error:'Watch exceeds its supported project/data bounds'});if(e instanceof GrowthWatchUnavailable)return reply.code(503).send({error:'Local growth observation worker is unavailable. No new active schedule is confirmed.'});return reply.code(503).send({error:'Growth watch storage unavailable. Inspect existing watches/history before retrying; no outcome is confirmed.'});};
   fastify.get('/projects/:projectId/growth-watches',async(request:any,reply:any)=>{const s=await access(request,reply);if(!s)return;try{const items=await services.growthWatches!.list(s.workspaceId,s.projectId);return items?{items,workerAvailable:services.growthWatchWorker?.available===true}:reply.code(404).send({error:'Project not found'});}catch(e){return failure(reply,e);}});
   fastify.post('/projects/:projectId/growth-watches',async(request:any,reply:any)=>{const s=await access(request,reply,true);if(!s)return;const input=CreateProjectGrowthWatchSchema.safeParse(request.body);if(!input.success)return reply.code(400).send({error:'Exact request/experiment UUIDs and integer interval60..10080 minutes required'});try{const result=await services.growthWatches!.create(s.workspaceId,s.projectId,s.sub,input.data,services.growthWatchWorker?.available===true);if(!result)return reply.code(404).send({error:'Owned project/experiment not found'});return reply.code(result.created?201:200).send(result.watch);}catch(e){return failure(reply,e);}});
   fastify.patch('/projects/:projectId/growth-watches/:id',async(request:any,reply:any)=>{const s=await access(request,reply,true);if(!s)return;const id=z.string().uuid().safeParse(request.params.id),input=UpdateProjectGrowthWatchSchema.safeParse(request.body);if(!id.success||!input.success)return reply.code(400).send({error:'Exact watch UUID, expected revision and active/paused state required'});try{const result=await services.growthWatches!.update(s.workspaceId,s.projectId,s.sub,id.data,input.data,services.growthWatchWorker?.available===true);return result??reply.code(404).send({error:'Owned watch/experiment not found'});}catch(e){return failure(reply,e);}});
  }
  if(services.prisma&&services.projectRegistry){
   const results=new ProjectExperimentResultsService(services.prisma),limiter=new SlidingWindowLimiter(60,60_000);
   fastify.get('/projects/:projectId/experiments/:id/results',async(request:any,reply:any)=>{
    const s=await authorize(request,reply,false,'experiments:read');if(!s)return;reply.header('Cache-Control','no-store');
    if(s.isAgentToken)return reply.code(403).send({error:'Human session required; use the separately scoped bound-project results route'});
    const project=z.string().uuid().safeParse(request.params.projectId),id=z.string().uuid().safeParse(request.params.id);
    if(!project.success||!id.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Valid exact project/experiment IDs and no query parameters required'});
    if(!limiter.take(s.workspaceId))return reply.code(429).send({error:'Too many aggregate results reads'});
    try{const result=await results.read(s.workspaceId,project.data,id.data);if(!result)return reply.code(404).send({error:'Experiment not found'});const parsed=ProjectExperimentResultsSchema.safeParse(result);if(!parsed.success)throw Error('Invalid stored aggregate');return parsed.data;}catch{return reply.code(503).send({error:'Stored aggregate results are unavailable. No result or action is confirmed.'});}
   });
   fastify.get('/agent/project/experiments/:id/results',async(request:any,reply:any)=>{
    const s=await authorize(request,reply,false,'project:experiments:results');if(!s)return;
    reply.header('Cache-Control','no-store');
    if(!s.isAgentToken||!s.projectId)return reply.code(403).send({error:'Project-bound results credential required'});
    if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Project comes only from the credential; results accept no query parameters'});
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid experiment ID'});
    if(!limiter.take(s.workspaceId))return reply.code(429).send({error:'Too many aggregate results reads'});
    try{const result=await results.read(s.workspaceId,s.projectId,id.data);return result??reply.code(404).send({error:'Experiment not found'});}catch{return reply.code(503).send({error:'Stored aggregate results are unavailable. No result or action is confirmed.'});}
   });
  }
  if(services.prisma&&services.projectRegistry){
   const drafts=new ProjectExperimentDraftService(services.prisma),limiter=new SlidingWindowLimiter(20,60_000);
   fastify.post('/agent/project/experiment-drafts',{bodyLimit:262144},async(request:any,reply:any)=>{
    const s=await authorize(request,reply,true,'project:experiments:draft');if(!s)return;
    reply.header('Cache-Control','no-store');
    if(!s.isAgentToken||!s.projectId)return reply.code(403).send({error:'Project-bound draft credential required'});
    if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Project comes only from the credential'});
    const parsed=CreateProjectExperimentDraftSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Supply requestId, rawHypothesis, preferredSlug, complete pageCopy and surveyQuestions only'});
    if(!limiter.take(s.workspaceId))return reply.code(429).send({error:'Too many private experiment saves. Retry later with the same request ID/input.'});
    if(!await allowed(reply,s.workspaceId,'validator'))return;
    try{const result=await drafts.create(s.workspaceId,s.projectId,s.sub,parsed.data);if(!result)return reply.code(404).send({error:'Project not found'});return reply.code(result.replayed?200:201).send({...result,note:'Private page storage only. Replay returns current saved state, never resets or publishes it. No visitor, lead, campaign or job was created.'});}
    catch(e){if(e instanceof ExperimentDraftConflict)return reply.code(409).send({error:e.message});if(e instanceof ExperimentDraftDenied)return reply.code(403).send({error:e.message});return reply.code(503).send({error:'Draft save not confirmed. Keep the request ID and input unchanged, then retry.'});}
   });
  }
  if(services.projectRegistry&&services.reads&&services.validator&&services.prisma){
   fastify.get('/agent/project/experiments',async(request:any,reply:any)=>{
    const s=await authorize(request,reply,false,'project:experiments:read');if(!s)return;
    if(!s.isAgentToken||!s.projectId)return reply.code(403).send({error:'Project-bound observation token required'});
    if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Project identity comes from token only'});
    if(!await services.projectRegistry!.findByIdOrSlug(s.workspaceId,s.projectId))return reply.code(404).send({error:'Project not found'});
    return services.reads!.listExperiments(s.workspaceId,s.projectId);
   });
   fastify.get('/agent/project/experiments/:id/page',async(request:any,reply:any)=>{
    const s=await authorize(request,reply,false,'project:experiments:read');if(!s)return;
    if(!s.isAgentToken||!s.projectId)return reply.code(403).send({error:'Project-bound observation token required'});
    if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Project identity comes from token only'});
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid experiment id'});
    const exp=await services.prisma.validationExperiment.findFirst({where:{id:id.data,workspaceId:s.workspaceId,projectId:s.projectId},select:{id:true}});
    if(!exp)return reply.code(404).send({error:'Experiment not found'});
    const page=await services.validator!.getOwnerPage(id.data,s.workspaceId);if(!page)return reply.code(404).send({error:'Experiment not found'});return page;
   });
  }
  if(services.projectRegistry&&services.projectInventory){
   const inventory=async(request:any,reply:any,agent:boolean)=>{
    const session=await authorize(request,reply,false,agent?'project:inventory:read':undefined);if(!session)return;
    if(agent&&(!session.isAgentToken||!session.projectId))return reply.code(403).send({error:'Project-bound inventory credential required'});
    if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Inventory has no query overrides'});
    try{const project=await services.projectRegistry!.findByIdOrSlug(session.workspaceId,agent?session.projectId:String(request.params.projectId));if(!project)return reply.code(404).send({error:'Project not found'});const result=await services.projectInventory!.get(session.workspaceId,project.id);if(!result)return reply.code(404).send({error:'Project not found'});return result;}catch{return reply.code(503).send({error:'Project inventory unavailable. No readiness claim can be made from this failed read.'});}
   };
   fastify.get('/projects/:projectId/inventory',(request:any,reply:any)=>inventory(request,reply,false));fastify.get('/agent/project/inventory',(request:any,reply:any)=>inventory(request,reply,true));
  }
  if(services.projectRegistry&&services.projectAssets){
   const mountAssets=(prefix:string,agentMode:boolean)=>{
    const resolve=async(request:any,reply:any,write=false)=>{
     const s=await authorize(request,reply,write,agentMode?(write?'project:assets:write':'project:assets:read'):undefined);if(!s)return null;
     if(agentMode&&(!s.isAgentToken||!s.projectId)){reply.code(403).send({error:'Project-bound asset credential required'});return null;}
     const project=await services.projectRegistry!.findByIdOrSlug(s.workspaceId,agentMode?s.projectId:String(request.params.projectId));
     if(!project){reply.code(404).send({error:'Project not found'});return null;}return{s,project};
    };
    const failed=(reply:any,error:unknown)=>error instanceof AssetConflict?reply.code(409).send({error:error.message}):reply.code(503).send({error:'Project asset operation was not confirmed. Keep the same request ID and input when retrying.'});
    fastify.post(agentMode?'/agent/project/discovery/match':'/projects/:projectId/discovery/match',{bodyLimit:262144},async(request:any,reply:any)=>{
     const r=await resolve(request,reply);if(!r)return;reply.header('Cache-Control','no-store');const body=ProjectDiscoveryMatchSchema.safeParse(request.body);
     if(!body.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Supply one saved profile asset/version and up to20 distinct selected posts only'});
     try{const result=await new ProjectDiscoveryService(services.projectAssets!).match(r.s.workspaceId,r.project.id,body.data);return result??reply.code(404).send({error:'Profile asset/version not found'});}catch(e){if(e instanceof DiscoveryProfileInvalid)return reply.code(409).send({error:e.message});return reply.code(503).send({error:'Project discovery unavailable. No match or draft was confirmed.'});}
    });
    for(const action of ['prepare','record-preview'] as const){
     fastify.post((agentMode?'/agent/project/posts/':'/projects/:projectId/posts/')+action,{bodyLimit:262144},async(request:any,reply:any)=>{
      const r=await resolve(request,reply,true);if(!r)return;reply.header('Cache-Control','no-store');
      const schema=action==='prepare'?PrepareDmpilotPostSchema:RecordDmpilotPreviewSchema,body=schema.safeParse(request.body);
      if(!body.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Supply exact supported DMPilot handoff or reported-preview input only. No keys, approval or publication controls.'});
      try{const service=new DmpilotPostHandoffService(services.projectAssets!);const saved=action==='prepare'?await service.prepare(r.s.workspaceId,r.project.id,r.s.sub,body.data as any):await service.recordPreview(r.s.workspaceId,r.project.id,r.s.sub,body.data as any);if(!saved)return reply.code(404).send({error:'Project asset/version not found'});return reply.code(saved.replayed?200:201).send(saved);}catch(e){if(e instanceof DmpilotHandoffConflict)return reply.code(409).send({error:e.message});return failed(reply,e);}
     });
    }
    fastify.get(prefix,async(request:any,reply:any)=>{
     const r=await resolve(request,reply);if(!r)return;const q=ProjectAssetQuerySchema.safeParse(request.query??{});if(!q.success)return reply.code(400).send({error:'Invalid asset query'});
     try{return await services.projectAssets!.list(r.s.workspaceId,r.project.id,q.data);}catch(e){return failed(reply,e);}
    });
    fastify.get(prefix+'/:assetId',async(request:any,reply:any)=>{
     const r=await resolve(request,reply);if(!r)return;const id=z.string().uuid().safeParse(request.params.assetId),q=z.object({version:z.coerce.number().int().min(1).max(1000000).optional()}).strict().safeParse(request.query??{});if(!id.success||!q.success)return reply.code(400).send({error:'Invalid asset detail query'});
     try{const asset=await services.projectAssets!.get(r.s.workspaceId,r.project.id,id.data,q.data.version);if(!asset)return reply.code(404).send({error:'Asset not found'});return asset;}catch(e){return failed(reply,e);}
    });
    fastify.post(prefix,{bodyLimit:262144},async(request:any,reply:any)=>{
     const r=await resolve(request,reply,true);if(!r)return;const body=CreateProjectAssetSchema.safeParse(request.body);if(!body.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Invalid project asset'});
     try{const asset=await services.projectAssets!.create(r.s.workspaceId,r.project.id,r.s.sub,body.data);if(!asset)return reply.code(404).send({error:'Project not found'});return reply.code(asset.replayed?200:201).send(asset);}catch(e){return failed(reply,e);}
    });
    fastify.put(prefix+'/:assetId',{bodyLimit:262144},async(request:any,reply:any)=>{
     const r=await resolve(request,reply,true);if(!r)return;const id=z.string().uuid().safeParse(request.params.assetId),body=ReviseProjectAssetSchema.safeParse(request.body);if(!id.success||!body.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Invalid asset revision'});
     try{const asset=await services.projectAssets!.revise(r.s.workspaceId,r.project.id,r.s.sub,id.data,body.data);if(!asset)return reply.code(404).send({error:'Asset not found'});return asset;}catch(e){return failed(reply,e);}
    });
   };
   mountAssets('/projects/:projectId/assets',false);mountAssets('/agent/project/assets',true);
  }
  if(services.projectRegistry&&services.projectEntries){
   const mountEntries=(prefix:string,agentMode:boolean)=>{
    const entryProject=async(request:any,reply:any,write=false)=>{
     const session=await authorize(request,reply,write,agentMode?(write?'context:write':'context:read'):undefined);if(!session)return null;
     if(agentMode&&(!session.isAgentToken||!session.projectId)){reply.code(403).send({error:'A project-bound context token is required'});return null;}
     try{
      const project=await services.projectRegistry!.findByIdOrSlug(session.workspaceId,agentMode?session.projectId:String(request.params.projectId));
      if(!project){reply.code(404).send({error:'Project not found'});return null;}
      return{session,project};
     }catch{reply.code(503).send({error:'Project history unavailable'});return null;}
    };
    fastify.get(prefix,async(request:any,reply:any)=>{
     const resolved=await entryProject(request,reply);if(!resolved)return;
     const parsed=ProjectEntryQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:'Invalid entry query'});
     try{return await services.projectEntries!.list(resolved.session.workspaceId,resolved.project.id,parsed.data);}
     catch(e){if(e instanceof EntryCursorInvalid)return reply.code(400).send({error:'Invalid entry cursor'});return reply.code(503).send({error:'Project history unavailable'});}
    });
    fastify.get(prefix+'/brief',async(request:any,reply:any)=>{
     const resolved=await entryProject(request,reply);if(!resolved)return;
     if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Brief does not accept query parameters'});
     try{return await services.projectEntries!.brief(resolved.session.workspaceId,resolved.project.id);}
     catch{return reply.code(503).send({error:'Project brief unavailable'});}
    });
    fastify.get(prefix+'/:entryId',async(request:any,reply:any)=>{
     const resolved=await entryProject(request,reply);if(!resolved)return;
     if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Detail route does not accept query parameters'});
     const id=z.string().uuid().safeParse(request.params.entryId);if(!id.success)return reply.code(400).send({error:'Invalid entry ID'});
     try{const entry=await services.projectEntries!.get(resolved.session.workspaceId,resolved.project.id,id.data);if(!entry)return reply.code(404).send({error:'Entry not found'});return entry;}
     catch{return reply.code(503).send({error:'Project history unavailable'});}
    });
    fastify.post(prefix,{bodyLimit:32768},async(request:any,reply:any)=>{
     const resolved=await entryProject(request,reply,true);if(!resolved)return;
     if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Write route does not accept query parameters'});
     const parsed=CreateProjectEntrySchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Invalid project entry'});
     try{const result=await services.projectEntries!.create(resolved.session.workspaceId,resolved.project.id,resolved.session.sub,parsed.data);if(!result)return reply.code(404).send({error:'Project not found'});return reply.code(result.created?201:200).send(result.entry);}
     catch(e){if(e instanceof EntryRequestConflict)return reply.code(409).send({error:'This request ID was already used for another entry'});return reply.code(503).send({error:'Entry save was not confirmed. Reload before retrying.'});}
    });
   };
   mountEntries('/projects/:projectId/entries',false);
   mountEntries('/agent/context/entries',true);
  }
  if(services.projectContext) {
   const pc=services.projectContext;
   const restoreAgentContextHandler=async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'context:read');if(!session)return;
    const sess=session as any;
    if(!sess.isAgentToken||!sess.projectId) {
     return reply.code(403).send({error:'Token is not project-bound. Context endpoints require a project-scoped agent token.'});
    }
    const queryProjectId=(request.query as any)?.projectId;
    if(queryProjectId&&queryProjectId!==sess.projectId) {
     return reply.code(403).send({error:'Project mismatch with bound token'});
    }
    try {
     const res=await pc.restore(sess.workspaceId,sess.projectId);
     if(!res) return reply.code(404).send({error:`No context found for project ${sess.projectId}`});
     return reply.code(200).send(res);
    } catch(err:any) {
     if(err?.statusCode===413||err?.name==='PayloadTooLargeError') return reply.code(413).send({error:'Stored context exceeds 256KB limit'});
     throw err;
    }
   };
   const persistAgentContextHandler=async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'context:write');if(!session)return;
    const sess=session as any;
    if(!sess.isAgentToken||!sess.projectId) {
     return reply.code(403).send({error:'Token is not project-bound. Context endpoints require a project-scoped agent token.'});
    }
    const queryProjectId=(request.query as any)?.projectId??(request.body as any)?.projectId;
    if(queryProjectId&&queryProjectId!==sess.projectId) {
     return reply.code(403).send({error:'Project mismatch with bound token'});
    }
    const rawLen=Buffer.byteLength(JSON.stringify(request.body??{}));
    if(rawLen>262_144) {
     return reply.code(413).send({error:'Context payload exceeds 256KB limit'});
    }
    const parsed=PersistContextRequestSchema.safeParse(request.body);
    if(!parsed.success) return reply.code(400).send({error:'Invalid context payload',details:parsed.error.issues});
    try {
     const res=await pc.persist(sess.workspaceId,sess.projectId,parsed.data,sess.sub);
     return reply.code(200).send(res);
    } catch(err:any) {
     if(err?.statusCode===413||err?.name==='PayloadTooLargeError') return reply.code(413).send({error:'Context payload exceeds 256KB limit'});
     if(err?.statusCode===409)return reply.code(409).send({error:err.message});
     return reply.code(503).send({error:'Context save was not confirmed. Restore current state before reconciling; do not retry an unconditional replacement blindly.'});
    }
   };
   fastify.get('/agent/context',restoreAgentContextHandler);
   fastify.post('/agent/context',{bodyLimit:262_144},persistAgentContextHandler);
   fastify.put('/agent/context',{bodyLimit:262_144},persistAgentContextHandler);

   fastify.get('/projects/:projectId/context',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false);if(!session)return;reply.header('Cache-Control','no-store');if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Project comes only from the route and workspace from session'});
    if((session as any).isAgentToken) return reply.code(403).send({error:'Agent tokens cannot access /projects/:projectId/context (human sessions only)'});
    const paramProjectId=String(request.params?.projectId??'');
    if(!services.projectRegistry) {
     return reply.code(503).send({error:'Project registry service unavailable for project validation'});
    }
    const project=await services.projectRegistry.findByIdOrSlug(session.workspaceId,paramProjectId);
    if(!project) return reply.code(404).send({error:`Project ${paramProjectId} not found in this workspace`});
    const canonicalProjectId=project.id;
    try {
     const res=await pc.restore(session.workspaceId,canonicalProjectId);
     if(!res) return reply.code(404).send({error:`No context found for project ${paramProjectId}`});
     return reply.code(200).send(res);
    } catch(err:any) {
     if(err?.statusCode===413||err?.name==='PayloadTooLargeError') return reply.code(413).send({error:'Stored context exceeds 256KB limit'});
     return reply.code(503).send({error:'Saved snapshot unavailable. No replacement was created.'});
    }
   });
   fastify.post('/projects/:projectId/context',{bodyLimit:262_144},async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;reply.header('Cache-Control','no-store');if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Project comes only from the route and workspace from session'});
    if((session as any).isAgentToken) return reply.code(403).send({error:'Agent tokens cannot access /projects/:projectId/context (human sessions only)'});
    const paramProjectId=String(request.params?.projectId??'');
    if(!services.projectRegistry) {
     return reply.code(503).send({error:'Project registry service unavailable for project validation'});
    }
    const project=await services.projectRegistry.findByIdOrSlug(session.workspaceId,paramProjectId);
    if(!project) return reply.code(404).send({error:`Project ${paramProjectId} not found in this workspace`});
    const canonicalProjectId=project.id;
    const rawLen=Buffer.byteLength(JSON.stringify(request.body??{}));
    if(rawLen>262_144) {
     return reply.code(413).send({error:'Context payload exceeds 256KB limit'});
    }
    const parsed=PersistContextRequestSchema.safeParse(request.body);
    if(!parsed.success) return reply.code(400).send({error:'Invalid context payload',details:parsed.error.issues});
    try {
     const res=await pc.persist(session.workspaceId,canonicalProjectId,parsed.data,session.sub);
     return reply.code(200).send(res);
    } catch(err:any) {
     if(err?.statusCode===413||err?.name==='PayloadTooLargeError') return reply.code(413).send({error:'Context payload exceeds 256KB limit'});
     if(err?.statusCode===409)return reply.code(409).send({error:err.message});
     return reply.code(503).send({error:'Context save was not confirmed. Restore current state before reconciling; do not retry an unconditional replacement blindly.'});
    }
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
  // Admin-gated per plan (C3: session + admin): a live test spends the
  // workspace's provider quota, so non-admin writers must not trigger it.
  fastify.post('/vault/credentials/:provider/test',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   if(!isAdmin(session))return reply.code(403).send({error:'Admin role required',costDisclosure:TEST_COST_DISCLOSURE});
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
  // Campaign create (G-gap: campaign-create UI): tenant-scoped, role-checked, plan-gated.
  // Table and mailbox pool references are verified inside this workspace; unknown ids 404
  // without leaking existence. New campaigns start as 'draft' - nothing becomes sendable here.
  const projectDraftLimiter=new SlidingWindowLimiter(20,60_000);
  fastify.post('/agent/project/campaign-drafts',{bodyLimit:262144},async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true,'project:campaigns:draft');if(!session)return;
   if(!session.isAgentToken||!session.projectId)return reply.code(403).send({error:'Project-bound agent credential required'});
   if(!services.recipients||!services.projectRegistry)return reply.code(503).send({error:'Campaign draft storage unavailable'});
   if(!projectDraftLimiter.take(session.workspaceId))return reply.code(429).send({error:'Too many campaign draft saves. Retry later with unchanged request ID/input.'});
   if(!await allowed(reply,session.workspaceId,'outbound_sending'))return;
   const parsed=CreateProjectCampaignDraftSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Invalid campaign draft. Supply requestId/name/steps and optional draft schedule settings only. No recipients, senders or lifecycle controls.'});
   if(Object.keys(request.query??{}).length)return reply.code(400).send({error:'Campaign draft project comes only from the credential'});
   try{
    if(!await services.projectRegistry.findByIdOrSlug(session.workspaceId,session.projectId))return reply.code(404).send({error:'Project not found'});
    const saved=await services.recipients.createCampaign(session.workspaceId,{...parsed.data,projectId:session.projectId,mailboxPoolIds:[]});
    if(!saved)return reply.code(404).send({error:'Project not found'});
    return reply.code(saved.replayed?200:201).send({...saved,note:'Private campaign content saved only. No recipient, sender, approval, activation, job, release or send was created. Replay returns current campaign state and never resets it.'});
   }catch(e){if(e instanceof CampaignCreateConflict)return reply.code(409).send({error:e.message});return reply.code(503).send({error:'Campaign draft save was not confirmed. Retry the same request ID and unchanged input.'});}
  });
  if(services.privateCampaigns){
   const limiter=new SlidingWindowLimiter(30,60_000);
   const draftIdentity=async(request:any,reply:any,write=false)=>{const s=await authorize(request,reply,write,write?'project:campaigns:edit':'project:campaigns:read');if(!s)return null;if(!s.isAgentToken||!s.projectId){reply.code(403).send({error:'Project-bound agent credential required'});return null;}if(Object.keys(request.query??{}).length){reply.code(400).send({error:'Project comes only from the credential'});return null;}const id=z.string().uuid().safeParse(request.params.campaignId);if(!id.success){reply.code(400).send({error:'Invalid campaign ID'});return null;}return{...s,campaignId:id.data};};
   const humanDraftIdentity=async(request:any,reply:any,write=false)=>{const s=await authorize(request,reply,write);if(!s)return null;const id=z.string().uuid().safeParse(request.params.campaignId);if(!id.success||Object.keys(request.query??{}).length){reply.code(400).send({error:'Use a saved campaign ID only; workspace comes from session'});return null;}if(!limiter.take(s.workspaceId)){reply.code(429).send({error:'Too many private draft requests'});return null;}reply.header('Cache-Control','no-store');return{...s,campaignId:id.data};};
   fastify.get('/workspace/campaigns/:campaignId/private-copy',async(request:any,reply:any)=>{const s=await humanDraftIdentity(request,reply);if(!s)return;try{const r=await services.privateCampaigns!.get(s.workspaceId,undefined,s.campaignId);return r??reply.code(404).send({error:'Campaign draft not found'});}catch(e){if(e instanceof PrivateCampaignConflict)return reply.code(409).send({error:e.message});return reply.code(503).send({error:'Private campaign copy unavailable'});}});
   fastify.put('/workspace/campaigns/:campaignId/private-copy',{bodyLimit:262144},async(request:any,reply:any)=>{const s=await humanDraftIdentity(request,reply,true);if(!s)return;if(!await allowed(reply,s.workspaceId,'outbound_sending'))return;const p=RevisePrivateCampaignSchema.safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Supply current revision and complete private draft copy only'});try{const r=await services.privateCampaigns!.revise(s.workspaceId,undefined,s.campaignId,p.data);return r??reply.code(404).send({error:'Campaign draft not found'});}catch(e){if(e instanceof PrivateCampaignConflict)return reply.code(409).send({error:e.message});return reply.code(503).send({error:'Draft edit unconfirmed. Keep local words and retry unchanged or load current copy.'});}});
   fastify.get('/agent/project/campaign-drafts/:campaignId',async(request:any,reply:any)=>{const s=await draftIdentity(request,reply);if(!s)return;reply.header('Cache-Control','no-store');try{const r=await services.privateCampaigns!.get(s.workspaceId,s.projectId,s.campaignId);return r??reply.code(404).send({error:'Campaign draft not found'});}catch(e){if(e instanceof PrivateCampaignConflict)return reply.code(409).send({error:e.message});return reply.code(503).send({error:'Private draft unavailable'});}});
   fastify.put('/agent/project/campaign-drafts/:campaignId',{bodyLimit:262144},async(request:any,reply:any)=>{const s=await draftIdentity(request,reply,true);if(!s)return;if(!limiter.take(s.workspaceId))return reply.code(429).send({error:'Too many private draft revisions'});if(!await allowed(reply,s.workspaceId,'outbound_sending'))return;const p=RevisePrivateCampaignSchema.safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Invalid private draft revision. Supply exact current expectedRevision and complete draft copy only.'});try{const r=await services.privateCampaigns!.revise(s.workspaceId,s.projectId,s.campaignId,p.data);return r??reply.code(404).send({error:'Campaign draft not found'});}catch(e){if(e instanceof PrivateCampaignConflict)return reply.code(409).send({error:e.message});return reply.code(503).send({error:'Draft revision not confirmed. Keep local words and read saved draft before retrying.'});}});
  }
  fastify.post('/workspace/campaigns',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   if(!await allowed(reply,session.workspaceId,'outbound_sending'))return;
   if(!services.recipients)return reply.code(503).send({error:'Campaign store unavailable'});
   const parsed=CreateWorkspaceCampaignSchema.safeParse(request.body);
   if(!parsed.success)return reply.code(400).send({error:'Invalid campaign request'});
   try{
    const created=await services.recipients.createCampaign(session.workspaceId,parsed.data);
    if(!created)return reply.code(404).send({error:'Project, table or mailbox not found'});
    return reply.code(created.replayed?200:201).send(created);
   }catch(e){if(e instanceof CampaignCreateConflict)return reply.code(409).send({error:e.message});return reply.code(503).send({error:'Campaign save was not confirmed. Retry the same request ID and unchanged input. Without a request ID, inspect saved campaigns before retrying.'});}
  });
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
  // Sender pool management: the user-facing way to assign mailboxes to a campaign.
  // Pool changes invalidate held approvals via the sender-scoped approval snapshot.
  fastify.get('/campaigns/:campaignId/mailboxes',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,false);if(!session)return;
   if(!services.recipients)return reply.code(503).send({error:'Campaign store unavailable'});
   const campaignId=z.string().uuid().safeParse((request.params as any)?.campaignId);
   if(!campaignId.success)return reply.code(400).send({error:'Invalid campaign id'});
   if(!await services.recipients.campaignExists(session.workspaceId,campaignId.data))return reply.code(404).send({error:'Campaign not found'});
   return reply.code(200).send({pool:await services.recipients.listMailboxPool(session.workspaceId,campaignId.data)});
  });
  fastify.put('/campaigns/:campaignId/mailboxes',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   if(!await allowed(reply,session.workspaceId,'outbound_sending'))return;
   if(!services.recipients)return reply.code(503).send({error:'Campaign store unavailable'});
   const campaignId=z.string().uuid().safeParse((request.params as any)?.campaignId);
   const parsed=z.object({mailboxIds:z.array(z.string().uuid()).max(50),expectedMailboxIds:z.array(z.string().uuid()).max(50).optional()}).strict().safeParse(request.body);
   if(!campaignId.success||!parsed.success)return reply.code(400).send({error:'Invalid pool request'});
   try{const result=await services.recipients.setMailboxPool(session.workspaceId,campaignId.data,parsed.data.mailboxIds,parsed.data.expectedMailboxIds);
   if(!result)return reply.code(404).send({error:'Campaign or mailbox not found'});
   return reply.code(200).send(result);}catch(e){if(e instanceof CampaignPoolConflict)return reply.code(409).send({error:e.message});return reply.code(503).send({error:'Sender-pool save was not confirmed. Keep your selection and reload the saved pool before reconciling.'});}
  });
  // Campaign lifecycle: the user-facing draft -> active -> paused transitions.
  // Validation lives in the repository (steps + sender pool required to activate);
  // invalid transitions answer 409 with the named reason, unknown campaigns 404.
  fastify.put('/campaigns/:campaignId/status',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   if(!await allowed(reply,session.workspaceId,'outbound_sending'))return;
   if(!services.recipients)return reply.code(503).send({error:'Campaign store unavailable'});
   const campaignId=z.string().uuid().safeParse((request.params as any)?.campaignId);
   const parsed=z.object({status:z.enum(['draft','active','paused'])}).strict().safeParse(request.body);
   if(!campaignId.success||!parsed.success)return reply.code(400).send({error:'Invalid status request'});
   const result=await services.recipients.setCampaignStatus(session.workspaceId,campaignId.data,parsed.data.status);
   if(!result)return reply.code(404).send({error:'Campaign not found'});
   if(!result.ok)return reply.code(409).send({error:result.reason});
   return reply.code(200).send({id:campaignId.data,status:result.status});
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
    return reply.code(202).send({id,status:'pending_approval',sendingEnabled:services.outboundSendingEnabled===true});
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
   return {items,stats,sendingEnabled:services.outboundSendingEnabled===true};
  });
  fastify.get('/outbound/replies',async(request:any,reply:any)=>{
   const session=await authorize(request,reply);if(!session)return;
   const cId=request.query?.campaignId?z.string().uuid().safeParse(request.query.campaignId):null;
   const campaignId=cId?.success?cId.data:undefined;
   const items=await services.outbound.listInboundReplies(session.workspaceId,campaignId);
   return {items,sendingEnabled:services.outboundSendingEnabled===true};
  });
  fastify.post('/outbound/approvals/approve',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const b=ApproveOutboundJobRequestSchema.safeParse(request.body);
   if(!b.success)return reply.code(400).send({error:'Invalid approval request'});
   const result=await services.outbound.approve(session.workspaceId,b.data);
   return {...result,sendingEnabled:services.outboundSendingEnabled===true};
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
   const b=z.object({expectedRevision:ApprovalReviewRevisionSchema}).strict().safeParse(request.body);
   if(!b.success)return reply.code(400).send({error:'Supply the exact displayed approval revision. Reload and review this message before approval.'});
   const result=await services.outbound.approve(session.workspaceId,{jobIds:[id.data],expectedRevisions:{[id.data]:b.data.expectedRevision}});
   return {...result,sendingEnabled:services.outboundSendingEnabled===true};
  });
  // Per-job sender pin: narrow a held message to one mailbox from the campaign's pool (or clear back to rotation).
  // Recomputes the approval snapshot/hash so the reviewer deliberately approves the pinned sender context.
  fastify.post('/outbound/approvals/:id/sender',async(request:any,reply:any)=>{
   const session=await authorize(request,reply,true);if(!session)return;
   const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid job ID'});
   const b=z.object({mailboxId:z.string().uuid().nullable()}).strict().safeParse(request.body);
   if(!b.success)return reply.code(400).send({error:'Invalid sender request'});
   const r=await services.outbound.setSenderMailbox(session.workspaceId,id.data,b.data.mailboxId);
   return r.ok?{updated:true,sendingEnabled:services.outboundSendingEnabled===true}:reply.code(400).send({error:r.error});
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
    catch(e:any){if(e?.statusCode===503)return reply.code(503).send({error:e.message});if(e?.name==='ZodError')return reply.code(400).send({error:'Invalid pre-flight request'});return reply.code(503).send({error:'Waterfall estimate unavailable. No provider quote is established.'});}
   });
   fastify.post('/waterfall/dispatch',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'waterfall'))return;
    try{return await services.waterfall!.dispatch(request.body,session.workspaceId);}
    catch(err:any){
     if(err?.name==='WaterfallDispatchUnavailableError'||err?.statusCode===503)
      return reply.code(503).send({error:'Waterfall execution is unavailable. No job was queued and no provider was called.',message:'Durable job persistence is not implemented or unavailable; nothing was queued.',queued:false});
     if(err?.statusCode===403)return reply.code(403).send({error:'Waterfall is not permitted on this workspace plan'});
     if(err?.name==='ZodError'||err?.name==='WaterfallDispatchTenantMismatchError')return reply.code(400).send({error:'Invalid waterfall dispatch request'});
     return reply.code(503).send({error:'Waterfall dispatch was not confirmed. No queued job is established.',queued:false});
    }
   });
   // D3 status read (local, default-off with the rest of this block; honest
   // 503 without a durable store, tenant-fenced 404 for foreign jobs).
   fastify.get('/waterfall/jobs/:id',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'waterfall'))return;
    const id=(request.params as any)?.id;
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'Invalid job id'});
    try{return await services.waterfall!.getJobStatus(id,session.workspaceId);}
    catch(err:any){
     if(err&&err.name==='WaterfallDispatchUnavailableError')
      return reply.code(503).send({error:'Waterfall dispatch unavailable',message:'Durable job persistence is not implemented yet; no status can be read.',queued:false});
     if(err&&err.name==='WaterfallJobNotFoundError')
      return reply.code(404).send({error:'Waterfall job not found'});
     return reply.code(400).send({error:'Invalid waterfall status request'});
    }
   });
   // D3 review surface: WHICH rows of a job are uncertain. Same session +
   // tenant fence as the status read; ids only, never row content.
   fastify.get('/waterfall/jobs/:id/uncertain-rows',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true);if(!session)return;
    if(!await allowed(reply,session.workspaceId,'waterfall'))return;
    const id=(request.params as any)?.id;
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'Invalid job id'});
    try{return await services.waterfall!.getJobUncertainRows(id,session.workspaceId);}
    catch(err:any){
     if(err&&err.name==='WaterfallDispatchUnavailableError')
      return reply.code(503).send({error:'Waterfall dispatch unavailable',message:'Durable job persistence is not implemented yet; no review surface can be read.',queued:false});
     if(err&&err.name==='WaterfallJobNotFoundError')
      return reply.code(404).send({error:'Waterfall job not found'});
     return reply.code(400).send({error:'Invalid waterfall review request'});
    }
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
    const session=await authorize(request,reply,false,'research:read');if(!session)return;
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
  const researchFailure=(reply:any,error:unknown)=>error instanceof ResearchProjectNotFound?reply.code(404).send({error:'Project not found'}):error instanceof ResearchTableConflict?reply.code(409).send({error:error.message}):reply.code(503).send({error:'Research storage unavailable. Reload saved analyses before retrying any unconfirmed save.'});
  if(services.researchLeads) {
   const SaveBody=z.object({projectId:z.string().uuid().optional(),requestId:z.string().uuid().optional(),domain:z.string().min(1).max(255).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i,'Invalid domain'),pageText:z.string().min(1).max(200_000)}).strict();
   fastify.post('/research/website-signals/save',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'research:write');if(!session)return;
    const parsed=SaveBody.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Invalid research save request'});
    try{const saved=await services.researchLeads!.saveAnalysis(session.workspaceId,parsed.data.domain,parsed.data.pageText,'pasted_text',parsed.data.requestId,parsed.data.projectId);
    return {status:'SAVED',...saved};}catch(error){return researchFailure(reply,error);}
   });
   fastify.get('/research/leads',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'research:read');if(!session)return;
    const query=z.object({projectId:z.string().uuid().optional()}).strict().safeParse(request.query??{});if(!query.success)return reply.code(400).send({error:'Invalid research query'});
    try{if(query.data.projectId&&(!services.projectRegistry||!await services.projectRegistry.findByIdOrSlug(session.workspaceId,query.data.projectId)))return reply.code(404).send({error:'Project not found'});return {items:await services.researchLeads!.listAnalyses(session.workspaceId,query.data.projectId)};}catch(error){return researchFailure(reply,error);}
   });
  }
  // G5 intent signals, fixture-first: analyze/save/list hiring-board-shaped
  // JSON fixtures. Pasted JSON only - no fetch variant exists, so nothing in
  // these routes performs egress. Computed values are engine-only.
  if(services.intentFixture) {
   const IntentBody=z.object({fixture:z.unknown()}).strict();
   fastify.post('/research/intent-fixture',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'research:read');if(!session)return;
    const parsed=IntentBody.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Invalid intent fixture request'});
    const result=services.intentFixture!.analyze(parsed.data.fixture);
    if(!result.ok)return reply.code(422).send({status:'INVALID_FIXTURE',message:result.error});
    return {status:'OK',input:'pasted_fixture',analysis:result.analysis};
   });
   fastify.post('/research/intent-fixture/save',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'research:write');if(!session)return;
    const parsed=z.object({fixture:z.unknown(),requestId:z.string().uuid().optional(),projectId:z.string().uuid().optional()}).strict().safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Invalid intent fixture save request'});
    try{const saved=await services.intentFixture!.saveAnalysis(session.workspaceId,parsed.data.fixture,parsed.data.requestId,parsed.data.projectId);
    if(!saved.ok)return reply.code(422).send({status:'INVALID_FIXTURE',message:saved.error});
    return {status:'SAVED',tableId:saved.tableId,rowId:saved.rowId,replayed:saved.replayed};}catch(error){return researchFailure(reply,error);}
   });
   fastify.get('/research/intent-signals',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'research:read');if(!session)return;
    const query=z.object({projectId:z.string().uuid().optional()}).strict().safeParse(request.query??{});if(!query.success)return reply.code(400).send({error:'Invalid research query'});
    try{if(query.data.projectId&&(!services.projectRegistry||!await services.projectRegistry.findByIdOrSlug(session.workspaceId,query.data.projectId)))return reply.code(404).send({error:'Project not found'});return {items:await services.intentFixture!.listAnalyses(session.workspaceId,query.data.projectId)};}catch(error){return researchFailure(reply,error);}
   });
  }
  if(services.projectRegistry){
   fastify.post('/agent/project/research/hn-search',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,HN_SEARCH_SCOPE);if(!session)return;
    reply.header('Cache-Control','no-store');
    if(!session.isAgentToken||!session.projectId||!session.scopes?.includes(HN_SEARCH_SCOPE))return reply.code(403).send({error:'Explicit project-bound project:research:search scope required for queries sent to public HN search; wildcard is not consent'});
    const parsed=z.object({query:z.string().trim().min(1).max(120).regex(/^[^\u0000-\u001f\u007f]+$/)}).strict().safeParse(request.body);
    if(!parsed.success||Object.keys(request.query??{}).length)return reply.code(400).send({error:'Supply only one public HN query of1..120 characters. Project comes from the credential. Do not include private or secret information.'});
    if(!await services.projectRegistry!.findByIdOrSlug(session.workspaceId,session.projectId))return reply.code(404).send({error:'Project not found'});
    if(!services.projectHnResearch)return reply.code(503).send({error:'Public HN agent search is not enabled. No upstream query was made.'});
    if(!await allowed(reply,session.workspaceId,'ai_researcher'))return;
    try{return await services.projectHnResearch.search(session.workspaceId,session.projectId,parsed.data.query);}
    catch(error){if(error instanceof HnResearchLimited)return reply.header('Retry-After','60').code(429).send({error:'Public HN query limit reached. Wait before a new request.'});if(error instanceof HnResearchBusy)return reply.code(409).send({error:'A public HN query is already running. No new query was started.'});return reply.code(502).send({error:'Public HN search unavailable. No result or saved research is confirmed.'});}
   });
  }
  if(services.projectRegistry&&services.researchLeads&&services.intentFixture){
   const researchIdentity=async(request:any,reply:any,agent:boolean)=>{
    const session=await authorize(request,reply,false,agent?'project:research:read':'research:read');if(!session)return null;
    if(agent&&(!session.isAgentToken||!session.projectId)){reply.code(403).send({error:'Project-bound research observation credential required'});return null;}
    return session;
   };
   for(const agent of [false,true]){
    const prefix=agent?'/agent/project/research':'/research/records';
    fastify.get(prefix+(agent?'/index':''),async(request:any,reply:any)=>{
     const session=await researchIdentity(request,reply,agent);if(!session)return;
     const schema=agent?ProjectResearchIndexQuerySchema:ProjectResearchIndexQuerySchema.extend({projectId:z.string().uuid()});
     const parsed=schema.safeParse(request.query??{});if(!parsed.success)return reply.code(400).send({error:'Supply research kind, optional search, bounded limit and matching cursor; project identity is explicit for humans and token-bound for agents'});
     const projectId=agent?session.projectId:(parsed.data as any).projectId;
     try{
      if(!await services.projectRegistry!.findByIdOrSlug(session.workspaceId,projectId))return reply.code(404).send({error:'Project not found'});
      const service=parsed.data.kind==='website'?services.researchLeads!:services.intentFixture!;
      const result=await service.searchProjectAnalyses(session.workspaceId,projectId,parsed.data);
      return reply.header('Cache-Control','no-store').send(result);
     }catch(error){if(error instanceof ResearchCursorInvalid)return reply.code(400).send({error:'Cursor does not match this project, research kind or search. Start a fresh search.'});return researchFailure(reply,error);}
    });
    fastify.get(prefix+(agent?'/records/:rowId':'/:rowId'),async(request:any,reply:any)=>{
     const session=await researchIdentity(request,reply,agent);if(!session)return;
     const schema=agent?ProjectResearchDetailQuerySchema:ProjectResearchDetailQuerySchema.extend({projectId:z.string().uuid()});
     const parsed=schema.safeParse(request.query??{}),id=z.string().uuid().safeParse(request.params.rowId);
     if(!parsed.success||!id.success)return reply.code(400).send({error:'Supply a saved research row UUID, kind and expected project identity'});
     const projectId=agent?session.projectId:(parsed.data as any).projectId;
     try{
      if(!await services.projectRegistry!.findByIdOrSlug(session.workspaceId,projectId))return reply.code(404).send({error:'Project not found'});
      const service=parsed.data.kind==='website'?services.researchLeads!:services.intentFixture!;
      const result=await service.getProjectAnalysis(session.workspaceId,projectId,id.data);
      return result?reply.header('Cache-Control','no-store').send(result):reply.code(404).send({error:'Saved project research row not found'});
     }catch(error){return researchFailure(reply,error);}
    });
   }
   fastify.get('/agent/project/research',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'project:research:read');if(!session)return;
    if(!session.isAgentToken||!session.projectId)return reply.code(403).send({error:'Project-bound research observation credential required'});
    const query=z.object({kind:z.enum(['website','intent-fixture'])}).strict().safeParse(request.query??{});if(!query.success)return reply.code(400).send({error:'Choose website or intent-fixture research; project comes from token only'});
    try{if(!await services.projectRegistry!.findByIdOrSlug(session.workspaceId,session.projectId))return reply.code(404).send({error:'Project not found'});const service=query.data.kind==='website'?services.researchLeads!:services.intentFixture!;return{kind:query.data.kind,items:await service.listAnalyses(session.workspaceId,session.projectId),limit:50,note:'Newest saved computed rows only. Current editable cells, not source snapshots, live feeds, approvals or complete history.'};}catch(error){return researchFailure(reply,error);}
   });
  }
  if(services.validator) {
   fastify.post('/validator/experiments',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'experiments:write');if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    try{return await services.validator!.generate(session.workspaceId,request.body);}
    catch{return reply.code(400).send({error:'Invalid validation request'});}
   });
   fastify.post('/validator/experiments/:id/outreach',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'experiments:write');if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    try{return await services.validator!.recordOutreach(String(request.params.id),session.workspaceId,request.body);}
    catch{return reply.code(400).send({error:'Invalid outreach metrics'});}
   });
   fastify.get('/validator/experiments/:id/page',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'experiments:read');if(!session)return;
    const page=await services.validator!.getOwnerPage(String(request.params.id),session.workspaceId);
    if(!page)return reply.code(404).send({error:'Experiment not found'});
    return page;
   });
   fastify.put('/validator/experiments/:id/page',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'experiments:write');if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    const id=z.string().uuid().safeParse(request.params.id),body=EditDraftPageCopySchema.safeParse(request.body);
    if(!id.success||!body.success)return reply.code(400).send({error:'Invalid page-copy edit'});
    try{
     const result=await services.validator!.editDraftCopy(id.data,session.workspaceId,body.data);
     if(!result)return reply.code(404).send({error:'Experiment not found'});return result;
    }catch(error){if(error instanceof DraftPageConflict)return reply.code(409).send({error:error.message});return reply.code(503).send({error:'Page copy could not be saved. Reload the page before retrying.'});}
   });
   fastify.post('/validator/experiments/:id/publish',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'experiments:write');if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    const id=z.string().uuid().safeParse(request.params.id),body=PublishReviewedPageSchema.safeParse(request.body);if(!id.success||!body.success)return reply.code(400).send({error:'Publishing requires the reviewed page expectedRevision'});
    try{return await services.validator!.setPublishStatus(id.data,session.workspaceId,true,body.data.expectedRevision);}
    catch(error){if(error instanceof PagePublicationConflict)return reply.code(409).send({error:error.message});if(error instanceof ExperimentNotFound)return reply.code(404).send({error:'Experiment not found'});return reply.code(503).send({error:'Publication was not confirmed. Reload current page status before retrying.'});}
   });
   fastify.post('/validator/experiments/:id/unpublish',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'experiments:write');if(!session)return;
    if(!await allowed(reply,session.workspaceId,'validator'))return;
    const id=z.string().uuid().safeParse(request.params.id);if(!id.success)return reply.code(400).send({error:'Invalid experiment ID'});
    try{return await services.validator!.setPublishStatus(id.data,session.workspaceId,false);}
    catch(error){if(error instanceof ExperimentNotFound)return reply.code(404).send({error:'Experiment not found'});return reply.code(503).send({error:'Unpublication was not confirmed. Reload current page status before retrying.'});}
   });
   fastify.get('/validator/experiments/:id/scorecard',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'experiments:read');if(!session)return;
    try{return await services.validator!.getScorecard(String(request.params.id),session.workspaceId);}
    catch{return reply.code(404).send({error:'Experiment not found'});}
   });
   fastify.get('/validator/experiments/:id/leads',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'experiments:read');if(!session)return;
    try{return await services.validator!.getLeads(String(request.params.id),session.workspaceId);}
    catch{return reply.code(404).send({error:'Experiment not found'});}
   });
   fastify.get('/validator/experiments/:id/leads/export',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,false,'experiments:read');if(!session)return;
    try{
     const data=await services.validator!.getLeads(String(request.params.id),session.workspaceId);
     const csv=formatLeadsCsv(data.leads as any);
     return reply
      .header('Content-Type','text/csv; charset=utf-8')
      .header('Content-Disposition',`attachment; filename="experiment-${encodeURIComponent(String(request.params.id))}-leads.csv"`)
      .header('Cache-Control','no-store')
      .send(csv);
    }catch{return reply.code(404).send({error:'Experiment not found'});}
   });
   fastify.post('/validator/experiments/:id/import-leads',async(request:any,reply:any)=>{
    const session=await authorize(request,reply,true,'experiments:write');if(!session)return;
    const expId=z.string().uuid().safeParse((request.params as any)?.id);
    if(!expId.success)return reply.code(400).send({error:'Invalid experiment ID'});
    const parsed=ImportCapturedLeadsRequestSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Invalid import request'});

    let leadsRes;
    try{leadsRes=await services.validator!.getLeads(expId.data,session.workspaceId);}
    catch{return reply.code(404).send({error:'Experiment not found'});}

    if(!leadsRes||leadsRes.leads.length===0){
     return reply.code(400).send({error:'No captured leads to import'});
    }

    let targetName='Target';
    let importedCount=0;

    if(parsed.data.targetType==='campaign'){
     if(!services.recipients)return reply.code(503).send({error:'Campaign store unavailable'});

     const recipients=leadsRes.leads.map((l)=>{
      const parts=(l.name||'').trim().split(/\s+/);
      return {
       email:l.email,
       firstName:parts[0]||null,
       lastName:parts.slice(1).join(' ')||null,
       companyName:l.company||null,
       customFields:{
        surveyResponses:l.surveyResponses,
        experimentId:expId.data,
       },
      };
     });

     const atomicRes=await services.recipients.importRecipientsIntoDraft(session.workspaceId,parsed.data.targetId,recipients);
     if(!atomicRes.ok){
      if(atomicRes.reason==='not_found')return reply.code(404).send({error:'Target campaign not found'});
      return reply.code(409).send({error:'Target campaign must be in draft status'});
     }
     targetName=atomicRes.campaignName;
     importedCount=atomicRes.upserted;
    }else if(parsed.data.targetType==='table'){
     if(!services.prisma?.$transaction)return reply.code(503).send({error:'Table import persistence unavailable'});
     try {
      const result=await importCapturedLeadsToTable(new PrismaDispatchDatabase(services.prisma),session.workspaceId,parsed.data.targetId,leadsRes.leads,parsed.data.expectedTableRevision);
      if(!result)return reply.code(404).send({error:'Target table not found'});
      targetName=result.name;
      importedCount=result.importedCount;
     } catch(error) {if(error instanceof CapturedTableMappingConflict)return reply.code(409).send({error:error.message});if(error instanceof CapturedTableMappingInvalid)return reply.code(400).send({error:error.message});return reply.code(503).send({error:'Table import was not confirmed. Reload the table before retrying. Repeating this append operation can add duplicate rows.'});}
    }

    return reply.code(200).send({
     success:true,
     targetType:parsed.data.targetType,
     targetId:parsed.data.targetId,
     targetName,
     importedCount,
     status:parsed.data.targetType==='table'?'saved':'draft',
     message:parsed.data.targetType==='table'?`Appended ${importedCount} lead(s) to the saved table. Repeating appends new rows. No sends triggered.`:`Successfully imported ${importedCount} lead(s) into campaign draft. No sends triggered.`,
    });
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
   // loopback (the proxy). Direct non-loopback callers cannot spoof it here.
   // NOTE: a public client CAN still send XFF to the web app, which forwards
   // it from trusted loopback - per-IP keys are only as strong as the ingress
   // sanitizing client-supplied XFF (a recorded deployment prerequisite; see
   // PUMPGTM_GAP G13). The global ceilings below are the backstop meanwhile.
   // IPs are hashed into the key so the shared store never retains raw
   // client identifiers.
   const pubClientKey=(request:any):string=>{
    const peer=String(request.ip??'unknown');
    let ip=peer;
    if(peer==='127.0.0.1'||peer==='::1'||peer==='::ffff:127.0.0.1'){
     const fwd=String(request.headers?.['x-forwarded-for']??'').split(',')[0].trim();
     if(fwd)ip=fwd;
    }
    return createHash('sha256').update(ip.slice(0,45)).digest('hex').slice(0,16);
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
   // Global ceilings backstop per-IP evasion via spoofed/rotated XFF: even if
   // every request wears a fresh client IP, the shared bucket caps total
   // public load per 10-minute window.
   const PUB_GLOBAL:Record<string,number>={pg:2000,ld:200};
   const pubGate=async(request:any,reply:any,prefix:'pg'|'ld',slug:string,max:number):Promise<boolean>=>{
    const verdict=await pubLimit(`${prefix}:${pubClientKey(request)}:${slug}`,max);
    const globalVerdict=verdict==='allow'?await pubLimit(`${prefix}:global`,PUB_GLOBAL[prefix]):verdict;
    for(const v of [verdict,globalVerdict]){
     if(v==='error'){reply.code(503).send({error:'Service temporarily unavailable'});return false;}
     if(v==='deny'){reply.code(429).send({error:max<=5?'Too many submissions. Please try again in 10 minutes.':'Too many requests'});return false;}
    }
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
    const ip=clientIp(request);
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
   const Verify=z.object({email:z.string().email().max(320),code:z.string().min(1).max(12),password:z.string().min(10).max(256)}).strict();
   const Forgot=z.object({email:z.string().email().max(320)}).strict();
   const Reset=z.object({email:z.string().email().max(320),code:z.string().min(1).max(12),password:z.string().min(1).max(256)}).strict();
   const codeLimiter=new SlidingWindowLimiter(10,15*60_000);   // per target email, code checks (on top of 5 per code)
   const limited=(request:any,reply:any)=>{ if(!ipLimiter.take(clientIp(request))){reply.code(429).send({error:'Too many requests'});return true;} return false; };
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
    try { await pw.verifyEmail(p.data.email,p.data.code,p.data.password); } catch(e) { return fail(reply,e); }
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
 fastify.get('/health',async()=>({status:'ok',service:'leadloom-engine',buildId:RELEASE_BUILD_ID,growthObservationWorker:services?.growthWatchWorker?.available?'mounted':'unmounted',mutationsEnabled:Boolean(services),outboundSendingEnabled:services?.outboundSendingEnabled===true,worker:services?.outboundWorker?'mounted':'unmounted',routes:{provisioning:services?.provisioning&&services.nextAuthBridgeKey?'mounted:bridge-token-required':'unmounted',entitlements:services?.entitlements?'enforced':'not_enforced',mutations:services?'mounted:session+write-role-required':'unmounted',loginIssuer:services?.userDirectory&&process.env.LEADLOOM_AUTH_ISSUER_ENABLED==='true'?'mounted':'unmounted',unsubscribe:services?.unsubscribeKey?'mounted':'unmounted',waterfall:services?.waterfall?'mounted:session-required':'unmounted',validator:services?.validator?'mounted:session-required':'unmounted',research:services?.websiteSignals?(services.websiteFetcher?'mounted:session-required:fetch-enabled':'mounted:session-required:pasted-text-only'):'unmounted'}}));
 // Readiness is honest about the worker: 503 until the send worker is actually mounted
 // (LEADLOOM_WORKER_ENABLED), 200 once it is. The send gate is reported separately and
 // stays off unless LEADLOOM_OUTBOUND_SENDING_ENABLED was set at boot.
 fastify.get('/ready',async(_request:any,reply:any)=>{
  if(services?.outboundWorker)return {status:'ready',workers:'mounted',sendingEnabled:services.outboundSendingEnabled===true};
  return reply.code(503).send({status:'not-ready',reason:'Send worker is not mounted (LEADLOOM_WORKER_ENABLED unset)',workers:'not-mounted'});
 });
 fastify.get('/setup-health',async(request:any,reply:any)=>{
  if(services){
   const session=await authorize(request,reply,false);
   if(!session)return;
   if((session as any).isAgentToken || !isAdmin(session)){
    return reply.code(403).send({error:'Human administrator access required'});
   }
  }
  let runner:any=undefined;
  if(services?.prisma){
   runner={
    query:(sql:string,params?:any[])=>
     services.prisma.$queryRawUnsafe(sql,...(params||[])).then((rows:any)=>({rows})),
   };
  }
  const dbPreflight=await runDbSchemaPreflight({
   databaseUrl:process.env.DATABASE_URL,
   runner,
  });

  const publicApiUrl=process.env.LEADLOOM_PUBLIC_API_URL||'https://leadloom.dmpilot.org/api/agent';
  const publicApiConfigured=Boolean(process.env.LEADLOOM_PUBLIC_API_URL);
  const authSecretConfigured=Boolean(process.env.LEADLOOM_SESSION_KEY||process.env.AUTH_SECRET||process.env.NEXTAUTH_SECRET);
  const bridgeSecretConfigured=Boolean(services?.nextAuthBridgeKey||process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET);

  const websiteFetcher=services?.websiteSignals
   ?(services.websiteFetcher?'active':'pasted-text-only')
   :'disabled';
  const outboundDispatch=services?.outboundSendingEnabled
   ?'live'
   :(services?.outboundWorker?'dry-run-safe':'unmounted');
  const vaultEncryption=process.env.LEADLOOM_MASTER_KEY
   ?'active-aes-256-gcm'
   :'unconfigured';

  let overallStatus:'ok'|'degraded'|'error'='ok';
  if(dbPreflight.verdict==='AUTH_FAILED'||dbPreflight.verdict==='UNREACHABLE'||dbPreflight.verdict==='UNCONFIGURED'){
   overallStatus='error';
  }else if(dbPreflight.verdict==='DEGRADED'||dbPreflight.verdict==='MISSING_TABLES'||!publicApiConfigured||websiteFetcher==='pasted-text-only'){
   overallStatus='degraded';
  }

  return {
   status:overallStatus,
   database:{
    status:dbPreflight.connectivity.status,
    verdict:dbPreflight.verdict,
    verificationMode:'column-presence-only',
    missingTables:dbPreflight.missingTables,
    missingColumnsCount:dbPreflight.missingColumnsCount,
    diagnostic:`${dbPreflight.diagnostic} (verified by column-presence-only; runtime column types unverified)`,
   },
   config:{
    publicApiUrl,
    publicApiConfigured,
    authSecretConfigured,
    bridgeSecretConfigured,
   },
   providers:{
    websiteFetcher,
    outboundDispatch,
    vaultEncryption,
    mutationsEnabled:Boolean(services),
   },
   checkedAt:new Date().toISOString(),
  };
 });
 await app.init();
 services?.growthWatchWorker?.start();
 services?.outboundWorker?.start();
 fastify.addHook('onClose',async()=>{await services?.growthWatchWorker?.stop();services?.outboundWorker?.stop();services?.waterfallDispatch?.stop();});
 return app;
}

if(require.main===module) {
 (async()=>{
  let services:RuntimeServices|undefined;
  let prisma:PrismaClient|undefined,vault:VaultService|undefined;
  let outboundRepo:AtomicDispatchRepository|undefined;
  let unsubscribeKey:Buffer|undefined;
  if(process.env.DATABASE_URL || process.env.LEADLOOM_MASTER_KEY || process.env.LEADLOOM_SESSION_KEY) {
   if(!process.env.DATABASE_URL || !process.env.LEADLOOM_MASTER_KEY || !process.env.LEADLOOM_SESSION_KEY) throw new Error('Incomplete runtime configuration');
   const key=Buffer.from(process.env.LEADLOOM_SESSION_KEY,'base64');
   if(key.length<32)throw new Error('Invalid session signing key');
   prisma=new PrismaClient();await prisma.$connect();vault=VaultService.fromEnv();
   unsubscribeKey=process.env.LEADLOOM_UNSUBSCRIBE_KEY?Buffer.from(process.env.LEADLOOM_UNSUBSCRIBE_KEY,'base64'):undefined;
   if(unsubscribeKey&&unsubscribeKey.length<16)throw new Error('Invalid unsubscribe signing key');
   const sendingEnabled=process.env.LEADLOOM_OUTBOUND_SENDING_ENABLED==='true';
   outboundRepo=new AtomicDispatchRepository(new PrismaDispatchDatabase(prisma),undefined,{sendingEnabled});
   services={credentials:new CredentialService(new PrismaCredentialRepository(prisma),vault),outbound:outboundRepo,recipients:new CampaignRecipientsRepository(new PrismaDispatchDatabase(prisma)),sessionKey:key,userDirectory:new PrismaUserDirectory(prisma),outboundSendingEnabled:sendingEnabled,prisma,...(unsubscribeKey?{unsubscribeKey}:{})};
   services.accessGuard=new PrismaAccessGuard(prisma);
   services.growthWatches=new ProjectGrowthWatchService(prisma);
   if(process.env.LEADLOOM_GROWTH_WATCHES_ENABLED==='true')services.growthWatchWorker=new ProjectGrowthWatchWorker(services.growthWatches);
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
    const {createTransactionalEmail}=await import('./modules/email/transactional.js');
    let inviteMailer=createTransactionalEmail(process.env,(u,i)=>fetch(u,i as any) as any);
    const inviteSinkFile=process.env.LEADLOOM_DEV_MAIL_SINK_FILE;
    if(inviteSinkFile) {
     if(process.env.NODE_ENV==='production')throw new Error('LEADLOOM_DEV_MAIL_SINK_FILE is not allowed in production');
     const {FileDevMailSink}=await import('./modules/email/dev-sink.js');
     inviteMailer=new FileDevMailSink(inviteSinkFile);
    }
    services.invitations=new InvitationService(new PrismaInvitationStore(prisma),{mailer:inviteMailer,appBaseUrl:process.env.APP_BASE_URL??'http://localhost:3000'});
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
    const {TestConnectionService,TESTABLE_CONNECTOR_IDS}=await import('./modules/waterfall/connectors/test-connection.service.js');
    services.connectorTest=new TestConnectionService(registry,services.entitlements as never);
    services.waterfallConnectors={list:async(workspaceId:string)=>{
     const creds=await prisma!.byokCredential.findMany({where:{workspaceId},orderBy:[{createdAt:'desc'},{id:'desc'}]});
     return reconcileConnectorStatus(
      registry.list().map((c:any)=>({id:c.id,name:c.name,capabilities:c.capabilities,testable:TESTABLE_CONNECTOR_IDS.has(c.id)})),
      creds.map((c:any)=>({provider:c.provider,maskedKey:c.maskedKey,label:c.label,isValid:c.isValid,lastVerifiedAt:c.lastVerifiedAt,updatedAt:c.updatedAt})),
     );
    }};
   }
   if(process.env.LEADLOOM_WATERFALL_API_ENABLED==='true') {
    const {WaterfallController}=await import('./modules/waterfall/waterfall.controller.js');
    const {WaterfallService}=await import('./modules/waterfall/waterfall.service.js');
    const {DomainCacheService}=await import('./modules/waterfall/domain-cache.service.js');
    // D1: with prisma present the domain cache is DB-backed (enrichment_cache,
    // 30-day TTL, hit persistence across restarts); the in-memory map remains
    // only for tests where no database exists.
    const waterfallCache=new DomainCacheService(prisma);
    const waterfallSvc=new WaterfallService(undefined,waterfallCache);
    let waterfallQueue;
    if(process.env.LEADLOOM_WATERFALL_DURABLE_DISPATCH==='true') {
     // D2 default-off mount: assembles the durable queue + single-worker poll
     // loop ONLY with a connected database; without one it logs loudly and the
     // honest 503 posture stands. Jobs stay inert until the proposed migration
     // is applied on the host (enrichment_jobs does not exist before then).
     const {mountDurableWaterfallDispatch}=await import('./modules/waterfall/durable-dispatch.js');
     const mounted=await mountDurableWaterfallDispatch({env:{LEADLOOM_WATERFALL_DURABLE_DISPATCH:process.env.LEADLOOM_WATERFALL_DURABLE_DISPATCH},prisma,runner:waterfallSvc.getRunner()});
     if(mounted){waterfallQueue=mounted.queue;services.waterfallDispatch=mounted;}
    }
    services.waterfall=new WaterfallController(waterfallQueue?new WaterfallService(undefined,waterfallCache,waterfallQueue):waterfallSvc);
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
   if(process.env.LEADLOOM_PUBLIC_HN_AGENT_ENABLED==='true') {
    const {PgSharedLimiter}=await import('./modules/auth/rate-limiter.js');
    const db=prisma;
    const limiter=new PgSharedLimiter((text,params)=>db.$queryRawUnsafe(text,...params) as Promise<Array<Record<string,unknown>>>,60_000);
    services.projectHnResearch=new ProjectHnResearchService((key,max)=>limiter.take(key,max));
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
   const {AgentTokenService,PrismaAgentTokenStore}=await import('./modules/auth/agent-token.service.js');
   services.agentTokens=new AgentTokenService(new PrismaAgentTokenStore(prisma));
   const {ProjectContextService,PrismaProjectContextStore}=await import('./modules/project-context/project-context.service.js');
   services.projectContext=new ProjectContextService(new PrismaProjectContextStore(prisma));
   const {ProjectRegistryService,PrismaProjectRegistryStore}=await import('./modules/project-context/project-registry.service.js');
   services.projectRegistry=new ProjectRegistryService(new PrismaProjectRegistryStore(prisma));
   services.projectEntries=new ProjectEntryService(prisma);
   services.projectAssets=new ProjectAssetService(prisma);
   services.projectInventory=new ProjectInventoryService(prisma);
   services.tableExports=new TableExportService(prisma);
   if(process.env.LEADLOOM_DNS_DIAGNOSTICS_ENABLED==='true')services.mailboxDns=new MailboxDnsService(prisma);
   services.savedWaterfalls=new SavedWaterfallService(new PrismaDispatchDatabase(prisma));
   services.privateCampaigns=new PrivateCampaignService(new PrismaDispatchDatabase(prisma));
   services.tableCells=new TableCellService(new PrismaDispatchDatabase(prisma));
   services.tableImports=new TableImportService(prisma,services.entitlements?async(id,tx)=>{const {PrismaEntitlementStore}=await import('./modules/entitlements/prisma-entitlement-store.js');const {EntitlementService}=await import('./modules/entitlements/entitlements.service.js');const {DEFAULT_PLANS}=await import('./modules/entitlements/default-plans.js');const store=new PrismaEntitlementStore(tx);return(await new EntitlementService(DEFAULT_PLANS,store,store).checkLimit(id,'tables')).allowed;}:undefined);
  }
  // G3 worker mount (default off; LEADLOOM_WORKER_ENABLED). The loop only ticks
  // dispatch; jobs become send-reservable solely through the gated release step
  // (LEADLOOM_OUTBOUND_SENDING_ENABLED), so mounting with sending off just idles.
  // Mailbox credentials are loaded tenant-scoped at send time from the sealed
  // mailbox-connect store; the strict SMTP policy mirrors mailbox connect
  // (dev-only private hosts share LEADLOOM_MAILBOX_ALLOW_PRIVATE_HOSTS).
  if(process.env.LEADLOOM_WORKER_ENABLED==='true') {
   const {OutboundWorker}=await import('./modules/outbound/worker.js');
   const {DispatchService}=await import('./modules/outbound/dispatch.service.js');
   const {SnapshotMessageComposer}=await import('./modules/outbound/transport/snapshot-composer.js');
   const {MailboxTransportRouter}=await import('./modules/outbound/transport/mailbox-transport-router.js');
   const {PrismaMailboxConnectStore}=await import('./modules/mailbox-connect/prisma-mailbox-connect-store.js');
   const dispatchDb=new PrismaDispatchDatabase(prisma!);
   const router=new MailboxTransportRouter({
    endpoints:new PrismaMailboxConnectStore(prisma!,vault!),
    composer:new SnapshotMessageComposer(dispatchDb),
    unsubscribe:unsubscribeKey?{baseUrl:process.env.APP_BASE_URL??'http://localhost:3000',signingKey:unsubscribeKey}:null,
    hooks:{allowPrivateHosts:process.env.NODE_ENV!=='production'&&process.env.LEADLOOM_MAILBOX_ALLOW_PRIVATE_HOSTS==='true'},
   });
   const intervalMs=Math.max(5_000,Number(process.env.LEADLOOM_WORKER_INTERVAL_MS??60_000)||60_000);
   services!.outboundWorker=new OutboundWorker(new DispatchService(outboundRepo!,router),outboundRepo!,{intervalMs,onTickError:()=>undefined});
  }
  const app=await createApplication(services);
  const close=async()=>{await app.close();await prisma?.$disconnect();vault?.destroy();};
  process.once('SIGTERM',()=>{void close();});process.once('SIGINT',()=>{void close();});
  await app.listen(Number(process.env.PORT??4000),process.env.HOST??'127.0.0.1');
 })().catch(()=>{console.error('Engine startup failed');process.exitCode=1;});
}
