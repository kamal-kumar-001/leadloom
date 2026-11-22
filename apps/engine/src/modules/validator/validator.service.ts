import * as crypto from 'crypto';
import {
  GenerateValidationRequest,
  SubmitWaitlistLeadRequest,
  ValidationScorecardMetrics,
  ValidationScorecardResponse,
  SmokePageConfig,
  ValidationLeadsResponse,
  EditDraftPageCopy,
  DraftPageCopy,
} from '@leadloom/contracts';
import { DecomposedHypothesisOutput, HypothesisDecomposerService } from './hypothesis-decomposer.service';
import { ScorecardService } from './scorecard.service';

export interface StoredExperiment {
  id: string;
  workspaceId: string;
  hypothesis: string;
  decomposed: DecomposedHypothesisOutput;
  metrics: ValidationScorecardMetrics;
  leads: Array<{
    id?: string;
    email: string;
    name?: string;
    company?: string;
    surveyResponses: Record<string, string>;
    createdAt: Date;
  }>;
  createdAt: Date;
}

export interface PublicSmokePage {
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  heroCtaText: string;
  surveyQuestions: SmokePageConfig['surveyQuestions'];
}

export class PagePublicationConflict extends Error {}
export class ExperimentNotFound extends Error {constructor(){super('Experiment not found');}}
export class DraftPageConflict extends Error {}
export type OwnerSmokePage = PublicSmokePage & {status:string;revision:string};
const copyOf=(page:PublicSmokePage):DraftPageCopy=>({title:page.title,headline:page.headline,subheadline:page.subheadline,heroCtaText:page.heroCtaText});
const pageRevision=(page:PublicSmokePage):string=>crypto.createHash('sha256').update(JSON.stringify({...copyOf(page),surveyQuestions:page.surveyQuestions})).digest('hex');

const INITIAL_METRICS: ValidationScorecardMetrics = {
  visitors: 0,
  pageConversions: 0,
  pageConversionRate: null,
  outreachSent: 0,
  replies: 0,
  replyRate: 0,
  positiveReplies: 0,
  positiveResonanceRate: 0,
  waitlistCount: 0,
};

/**
 * Validator service. When constructed with a Prisma client, experiments,
 * smoke pages, leads and metric counters persist in Postgres
 * (validation_experiments / smoke_test_pages / waitlist_leads) and survive
 * restarts; without one it falls back to the legacy in-memory Map (unit
 * tests only - never claim durability in that mode). Experiments are
 * tenant-scoped on create and on scorecard reads; the public smoke page
 * resolves by globally-unique slug.
 */
export class ValidatorService {
  private experiments = new Map<string, StoredExperiment>();
  private slugToId = new Map<string, string>();
  private decomposer: HypothesisDecomposerService;
  private scorecard: ScorecardService;
  /** In-memory fallback only: per-slug publication status (Prisma path stores it on the page row). */
  private pageStatus = new Map<string, 'draft' | 'published'>();

  constructor(
    private readonly publicOrigin = 'http://localhost:3000',
    private readonly prisma?: any,
  ) {
    this.decomposer = new HypothesisDecomposerService();
    this.scorecard = new ScorecardService();
  }

  private pageUrl(slug: string): string {
    return new URL(`/v/${slug}`, this.publicOrigin).href;
  }

  /** Preserve measured loads. Missing or incomparable denominators do not create traffic. */
  private metricsFrom(parts: { visitors: number; leadCount: number; outreachSent: number; replies: number; positiveReplies: number }): ValidationScorecardMetrics {
    const visitors = parts.visitors;
    return {
      visitors,
      pageConversions: parts.leadCount,
      pageConversionRate: visitors > 0 && parts.leadCount <= visitors ? parts.leadCount / visitors : null,
      outreachSent: parts.outreachSent,
      replies: parts.replies,
      replyRate: parts.outreachSent > 0 ? parts.replies / parts.outreachSent : 0,
      positiveReplies: parts.positiveReplies,
      positiveResonanceRate: parts.replies > 0 ? parts.positiveReplies / parts.replies : 0,
      waitlistCount: parts.leadCount,
    };
  }

  private scorecardFor(exp: { id: string; hypothesis: string; decomposed: DecomposedHypothesisOutput; metrics: ValidationScorecardMetrics }): ValidationScorecardResponse {
    return this.scorecard.computeScorecard(
      exp.id,
      exp.hypothesis,
      exp.metrics,
      this.pageUrl(exp.decomposed.slug),
      exp.decomposed.sequenceSubject,
      exp.decomposed.sequenceBody,
    );
  }

  public async generate(workspaceId: string, request: GenerateValidationRequest): Promise<{
    experimentId: string;
    pageUrl: string;
    decomposed: DecomposedHypothesisOutput;
    scorecard: ValidationScorecardResponse;
  }> {
    const decomposed = this.decomposer.decompose(request);
    // The customer's coding agent or founder supplies the words. Leadloom
    // stores them as plain text in an unpublished draft, never rewrites them
    // into a domain template and never treats them as executable markup.
    if (request.pageCopy) Object.assign(decomposed.smokePage, request.pageCopy);
    if (request.surveyQuestions !== undefined) decomposed.smokePage.surveyQuestions = structuredClone(request.surveyQuestions);
    const baseSlug = decomposed.slug;

    if (this.prisma) {
      const existing = await this.prisma.smokeTestPage.findMany({ where: { slug: { startsWith: baseSlug } }, select: { slug: true } });
      const taken = new Set(existing.map((r: any) => r.slug));
      if (request.preferredSlug && taken.has(baseSlug)) throw new Error('Requested page slug is already in use');
      while (taken.has(decomposed.slug)) decomposed.slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
      decomposed.smokePage.slug = decomposed.slug;
      const experimentId = crypto.randomUUID();
      await this.prisma.validationExperiment.create({
        data: {
          id: experimentId,
          workspaceId,
          ...(request.projectId?{projectId:request.projectId}:{}),
          hypothesis: request.rawHypothesis,
          icpSpec: decomposed.icp as any,
          sequenceSubject: decomposed.sequenceSubject,
          sequenceBody: decomposed.sequenceBody,
          smokeTestPages: {
            create: {
              id: crypto.randomUUID(),
              slug: decomposed.slug,
              title: decomposed.smokePage.title,
              headline: decomposed.smokePage.headline,
              subheadline: decomposed.smokePage.subheadline,
              heroCtaText: decomposed.smokePage.heroCtaText,
              surveyQuestions: decomposed.smokePage.surveyQuestions as any,
            },
          },
        },
      });
      const exp = { id: experimentId, hypothesis: request.rawHypothesis, decomposed, metrics: { ...INITIAL_METRICS } };
      return { experimentId, pageUrl: this.pageUrl(decomposed.slug), decomposed, scorecard: this.scorecardFor(exp) };
    }

    if(request.projectId)throw new Error('Project-owned experiments require persistent storage');
    if (request.preferredSlug && this.slugToId.has(baseSlug)) throw new Error('Requested page slug is already in use');
    while (this.slugToId.has(decomposed.slug)) decomposed.slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
    decomposed.smokePage.slug = decomposed.slug;
    const experimentId = crypto.randomUUID();
    const stored: StoredExperiment = {
      id: experimentId,
      workspaceId,
      hypothesis: request.rawHypothesis,
      decomposed,
      metrics: { ...INITIAL_METRICS },
      leads: [],
      createdAt: new Date(),
    };
    this.experiments.set(experimentId, stored);
    this.slugToId.set(decomposed.slug, experimentId);
    this.pageStatus.set(decomposed.slug, 'draft');
    return { experimentId, pageUrl: this.pageUrl(decomposed.slug), decomposed, scorecard: this.scorecardFor(stored) };
  }

  /** Hydrate the StoredExperiment view from PRD rows (experiment + its first page + that page's leads). */
  private toStored(row: any): StoredExperiment | undefined {
    const page = row.smokeTestPages?.[0] ?? (row.slug ? row : undefined);
    const experiment = row.smokeTestPages ? row : (row.experiment ?? undefined);
    if (!experiment || !page) return undefined;
    const leads = (page.waitlistLeads ?? []).map((l: any) => ({
      id: l.id,
      email: l.email,
      name: l.name ?? undefined,
      company: l.company ?? undefined,
      surveyResponses: l.surveyResponses as Record<string, string>,
      createdAt: l.createdAt,
    }));
    const decomposed = {
      slug: page.slug,
      icp: experiment.icpSpec,
      smokePage: {
        slug: page.slug,
        title: page.title,
        headline: page.headline,
        subheadline: page.subheadline,
        heroCtaText: page.heroCtaText,
        surveyQuestions: page.surveyQuestions,
        ...(page.customDomain ? { customDomain: page.customDomain } : {}),
      },
      sequenceSubject: experiment.sequenceSubject,
      sequenceBody: experiment.sequenceBody,
    } as unknown as DecomposedHypothesisOutput;
    const metrics = this.metricsFrom({
      visitors: page.visitors ?? 0,
      leadCount: leads.length,
      outreachSent: experiment.outreachSent ?? 0,
      replies: experiment.replies ?? 0,
      positiveReplies: experiment.positiveReplies ?? 0,
    });
    return { id: experiment.id, workspaceId: experiment.workspaceId, hypothesis: experiment.hypothesis, decomposed, metrics, leads, createdAt: experiment.createdAt };
  }

  public async getExperiment(id: string, workspaceId?: string): Promise<StoredExperiment | undefined> {
    if (this.prisma) {
      const row = await this.prisma.validationExperiment.findFirst({
        where: { id, ...(workspaceId ? { workspaceId } : {}) },
        include: { smokeTestPages: { include: { waitlistLeads: true } } },
      });
      return row ? this.toStored(row) : undefined;
    }
    const exp = this.experiments.get(id);
    if (!exp) return undefined;
    if (workspaceId && exp.workspaceId !== workspaceId) return undefined;
    return exp;
  }

  public async getExperimentBySlug(slug: string): Promise<StoredExperiment | undefined> {
    if (this.prisma) {
      const page = await this.prisma.smokeTestPage.findFirst({
        where: { slug },
        include: { waitlistLeads: true, experiment: true },
      });
      if (!page) return undefined;
      return this.toStored({ ...page.experiment, smokeTestPages: [page] });
    }
    const id = this.slugToId.get(slug);
    return id ? this.experiments.get(id) : undefined;
  }

  /** Public smoke-page payload. Each call is one raw page load: visitors counts loads, not unique people. */
  public async getPublicPage(slug: string): Promise<PublicSmokePage | undefined> {
    if (this.prisma) {
      const page = await this.prisma.smokeTestPage.findFirst({ where: { slug, status: 'published' } });
      if (!page) return undefined;
      await this.prisma.smokeTestPage.update({ where: { id: page.id }, data: { visitors: { increment: 1 } } });
      return { slug: page.slug, title: page.title, headline: page.headline, subheadline: page.subheadline, heroCtaText: page.heroCtaText, surveyQuestions: page.surveyQuestions as SmokePageConfig['surveyQuestions'] };
    }
    if (this.pageStatus.get(slug) !== 'published') return undefined;
    const exp = await this.getExperimentBySlug(slug);
    if (!exp) return undefined;
    exp.metrics.visitors += 1;
    exp.metrics.pageConversionRate = exp.metrics.visitors > 0 && exp.metrics.pageConversions <= exp.metrics.visitors ? exp.metrics.pageConversions / exp.metrics.visitors : null;
    const sp = exp.decomposed.smokePage;
    return { slug: exp.decomposed.slug, title: sp.title, headline: sp.headline, subheadline: sp.subheadline, heroCtaText: sp.heroCtaText, surveyQuestions: sp.surveyQuestions };
  }

  /** Owner-only preview of the exact page copy (any status). Never increments visitors: previews are not page loads. */
  public async getOwnerPage(experimentId: string, workspaceId: string): Promise<OwnerSmokePage | undefined> {
    if (this.prisma) {
      const exp = await this.prisma.validationExperiment.findFirst({ where: { id: experimentId, workspaceId } });
      if (!exp) return undefined;
      const page = await this.prisma.smokeTestPage.findFirst({ where: { experimentId } });
      if (!page) return undefined;
      return { slug: page.slug, title: page.title, headline: page.headline, subheadline: page.subheadline, heroCtaText: page.heroCtaText, surveyQuestions: page.surveyQuestions as SmokePageConfig['surveyQuestions'], status: page.status, revision: pageRevision(page) };
    }
    const exp = await this.getExperiment(experimentId, workspaceId);
    if (!exp) return undefined;
    const sp = exp.decomposed.smokePage;
    return { slug: exp.decomposed.slug, title: sp.title, headline: sp.headline, subheadline: sp.subheadline, heroCtaText: sp.heroCtaText, surveyQuestions: sp.surveyQuestions, status: this.pageStatus.get(exp.decomposed.slug) ?? 'draft', revision:pageRevision(sp) };
  }

  /** Draft-only compare-and-set. Public pages must first be explicitly unpublished.
   * Copy alone changes: slug, survey, ownership, metrics and captured leads stay intact.
   */
  public async editDraftCopy(experimentId:string,workspaceId:string,input:EditDraftPageCopy):Promise<(OwnerSmokePage&{saved:true;changed:boolean})|undefined>{
    const apply=(page:any)=>{
      if(page.status!=='draft')throw new DraftPageConflict('Unpublish this page before editing its copy');
      const unchanged=JSON.stringify(copyOf(page))===JSON.stringify(input.pageCopy);
      if(!unchanged&&pageRevision(page)!==input.expectedRevision)throw new DraftPageConflict('Page copy changed since you opened it. Reload before saving; your draft has not been applied');
      return !unchanged;
    };
    if(this.prisma){
      return this.prisma.$transaction(async(tx:any)=>{
        const pages=await tx.$queryRawUnsafe(`SELECT p.id FROM smoke_test_pages p JOIN validation_experiments e ON e.id=p.experiment_id WHERE e.id=$1::uuid AND e.workspace_id=$2::uuid FOR UPDATE OF p`,experimentId,workspaceId);
        if(pages.length!==1)return undefined;
        const page=await tx.smokeTestPage.findUnique({where:{id:pages[0].id}});if(!page)return undefined;
        const changed=apply(page);
        const saved=changed?await tx.smokeTestPage.update({where:{id:page.id},data:input.pageCopy}):page;
        return{slug:saved.slug,...copyOf(saved),surveyQuestions:saved.surveyQuestions,status:saved.status,revision:pageRevision(saved),saved:true as const,changed};
      });
    }
    const exp=await this.getExperiment(experimentId,workspaceId);if(!exp)return undefined;
    const page=exp.decomposed.smokePage,status=this.pageStatus.get(page.slug)??'draft';
    const changed=apply({...page,status});if(changed)Object.assign(page,input.pageCopy);
    return{...page,status,revision:pageRevision(page),saved:true,changed};
  }

  public async recordTraffic(slug: string): Promise<void> {
    await this.getPublicPage(slug);
  }

  public async submitLead(slug: string, lead: SubmitWaitlistLeadRequest): Promise<{ success: boolean; totalWaitlist: number }> {
    const email = lead.email.toLowerCase();
    if (this.prisma) {
      // Serialize on the page itself. A pre-read followed by create is not a
      // dedupe boundary: parallel submissions can all observe an empty list.
      // This lock also orders capture with unpublish/delete, which update or
      // remove the same row. No existing leads are overwritten on a retry.
      return this.prisma.$transaction(async (tx: any) => {
        const pages: Array<{ id: string }> = await tx.$queryRawUnsafe(
          `SELECT id::text AS id FROM smoke_test_pages WHERE slug=$1 AND status='published' FOR UPDATE`, slug,
        );
        const page = pages[0];
        if (!page) throw new Error(`Smoke test page not found for slug: ${slug}`);
        const existing = await tx.waitlistLead.findFirst({
          where: { pageId: page.id, email: { equals: email, mode: 'insensitive' } }, select: { id: true },
        });
        if (!existing) {
          await tx.waitlistLead.create({
            data: { id: crypto.randomUUID(), pageId: page.id, email, name: lead.name ?? null, company: lead.company ?? null, surveyResponses: (lead.surveyResponses ?? {}) as any, referrer: lead.referrer ?? null },
          });
        }
        return { success: true, totalWaitlist: await tx.waitlistLead.count({ where: { pageId: page.id } }) };
      });
    }
    if (this.pageStatus.get(slug) !== 'published') throw new Error(`Smoke test page not found for slug: ${slug}`);
    const exp = await this.getExperimentBySlug(slug);
    if (!exp) throw new Error(`Smoke test page not found for slug: ${slug}`);
    const alreadyExists = exp.leads.some((l) => l.email.toLowerCase() === email);
    if (!alreadyExists) {
      exp.leads.push({ id: crypto.randomUUID(), email: lead.email, name: lead.name, company: lead.company, surveyResponses: lead.surveyResponses ?? {}, createdAt: new Date() });
      exp.metrics = this.metricsFrom({ visitors: exp.metrics.visitors, leadCount: exp.leads.length, outreachSent: exp.metrics.outreachSent, replies: exp.metrics.replies, positiveReplies: exp.metrics.positiveReplies });
    }
    return { success: true, totalWaitlist: exp.leads.length };
  }

  /**
   * Publication boundary: a generated page stays an owner-only draft until an
   * explicit owner publish action. Tenant-scoped; public routes only serve
   * published pages (drafts are indistinguishable from unknown slugs).
   */
  public async setPublishStatus(experimentId:string,workspaceId:string,published:boolean,expectedRevision?:string):Promise<{experimentId:string;slug:string;status:string}>{
    const status=published?'published':'draft';
    const check=(page:PublicSmokePage)=>{if(published&&(!expectedRevision||pageRevision(page)!==expectedRevision))throw new PagePublicationConflict('Saved page changed or was not reviewed. Load and review the current copy before publishing.');};
    if(this.prisma){
      return this.prisma.$transaction(async(tx:any)=>{
        const owned=await tx.$queryRawUnsafe('SELECT p.id FROM smoke_test_pages p JOIN validation_experiments e ON e.id=p.experiment_id WHERE e.id=$1::uuid AND e.workspace_id=$2::uuid FOR UPDATE OF p',experimentId,workspaceId);
        if(owned.length!==1)throw new ExperimentNotFound();
        const page=await tx.smokeTestPage.findUnique({where:{id:owned[0].id}});if(!page)throw new ExperimentNotFound();check(page);
        if(page.status!==status)await tx.smokeTestPage.update({where:{id:page.id},data:{status}});
        return{experimentId,slug:page.slug,status};
      });
    }
    const exp=await this.getExperiment(experimentId,workspaceId);if(!exp)throw new ExperimentNotFound();check(exp.decomposed.smokePage);
    this.pageStatus.set(exp.decomposed.slug,status);return{experimentId,slug:exp.decomposed.slug,status};
  }

  public async updateOutreachMetrics(
    experimentId: string,
    workspaceId: string,
    outreachSent: number,
    replies: number,
    positiveReplies: number,
  ): Promise<ValidationScorecardResponse> {
    if (![outreachSent, replies, positiveReplies].every((n) => Number.isInteger(n) && n >= 0) || replies > outreachSent || positiveReplies > replies) {
      throw new Error('Invalid outreach metrics');
    }
    if (this.prisma) {
      const owned = await this.getExperiment(experimentId, workspaceId);
      if (!owned) throw new Error(`Experiment not found: ${experimentId}`);
      await this.prisma.validationExperiment.update({ where: { id: experimentId }, data: { outreachSent, replies, positiveReplies } });
      const fresh = await this.getExperiment(experimentId, workspaceId);
      return this.scorecardFor(fresh!);
    }
    const exp = await this.getExperiment(experimentId, workspaceId);
    if (!exp) throw new Error(`Experiment not found: ${experimentId}`);
    exp.metrics = this.metricsFrom({ visitors: exp.metrics.visitors, leadCount: exp.leads.length, outreachSent, replies, positiveReplies });
    return this.scorecardFor(exp);
  }

  public async getScorecard(experimentId: string, workspaceId?: string): Promise<ValidationScorecardResponse> {
    const exp = await this.getExperiment(experimentId, workspaceId);
    if (!exp) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    return this.scorecardFor(exp);
  }

  /**
   * Retrieves captured waitlist leads for an experiment. Tenant-scoped; caller
   * must have experiments:read scope for the owning workspace.
   */
  public async getLeads(experimentId: string, workspaceId: string): Promise<ValidationLeadsResponse> {
    const exp = await this.getExperiment(experimentId, workspaceId);
    if (!exp) throw new Error(`Experiment not found: ${experimentId}`);
    return {
      experimentId,
      totalLeads: exp.leads.length,
      leads: exp.leads.map((l, idx) => ({
        id: l.id ?? `lead-${idx + 1}`,
        email: l.email,
        name: l.name ?? null,
        company: l.company ?? null,
        surveyResponses: l.surveyResponses ?? {},
        createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
      })),
    };
  }
}

