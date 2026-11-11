import { describe, it, expect } from 'vitest';
import { ValidatorService } from '../validator.service';

/** Minimal in-memory stand-in for the Prisma validation models (PRD schema). */
function fakePrisma() {
  const experiments: any[] = [];
  const pages: any[] = [];
  const leads: any[] = [];
  const withLeads = (p: any) => ({ ...p, waitlistLeads: leads.filter((l) => l.pageId === p.id) });
  return {
    validationExperiment: {
      findFirst: async ({ where, include }: any) => {
        const e = experiments.find((x) => (!where.id || x.id === where.id) && (!where.workspaceId || x.workspaceId === where.workspaceId));
        if (!e) return null;
        return include?.smokeTestPages
          ? { ...e, smokeTestPages: pages.filter((p) => p.experimentId === e.id).map(withLeads) }
          : e;
      },
      create: async ({ data }: any) => {
        const { smokeTestPages, ...exp } = data;
        experiments.push({ outreachSent: 0, replies: 0, positiveReplies: 0, createdAt: new Date(), ...exp });
        if (smokeTestPages?.create) pages.push({ visitors: 0, createdAt: new Date(), ...smokeTestPages.create, experimentId: data.id });
        return data;
      },
      update: async ({ where, data }: any) => { const e = experiments.find((x) => x.id === where.id); Object.assign(e, data); return e; },
    },
    smokeTestPage: {
      findMany: async ({ where, select }: any) =>
        pages.filter((p) => (where.slug?.startsWith ? p.slug.startsWith(where.slug.startsWith) : true)).map((p) => (select?.slug ? { slug: p.slug } : p)),
      findFirst: async ({ where, include }: any) => {
        const p = pages.find((x) => x.slug === where.slug);
        if (!p) return null;
        let out: any = p;
        if (include?.waitlistLeads) out = withLeads(out);
        if (include?.experiment) out = { ...out, experiment: experiments.find((e) => e.id === p.experimentId) };
        return out;
      },
      update: async ({ where, data }: any) => {
        const p = pages.find((x) => x.id === where.id);
        if (data.visitors?.increment) p.visitors += data.visitors.increment;
        return p;
      },
    },
    waitlistLead: {
      create: async ({ data }: any) => {
        if (leads.some((l) => l.pageId === data.pageId && l.email === data.email)) throw new Error('Unique constraint failed');
        leads.push({ createdAt: new Date(), ...data }); return data;
      },
    },
  };
}

const WS = 'ws-tenant-a';

describe('ValidatorService persistence (Prisma path)', () => {
  it('persists experiments, leads and metrics so a fresh service instance sees them (restart survival)', async () => {
    const prisma = fakePrisma();
    const svc = new ValidatorService('http://localhost:3000', prisma);
    const generated = await svc.generate(WS, { rawHypothesis: 'Automated Kubernetes cost-cutter for Series A startups', preferredSlug: 'k8s-persist' });
    expect(generated.pageUrl).toBe('http://localhost:3000/v/k8s-persist');

    const page = await svc.getPublicPage('k8s-persist');
    expect(page?.headline).toContain('Kubernetes');
    expect(page?.surveyQuestions).toHaveLength(2);

    await svc.submitLead('k8s-persist', { email: 'Founder@ScaleUp.io', surveyResponses: { q1: 'too slow' } });
    // duplicate email is deduped (case-insensitive)
    await svc.submitLead('k8s-persist', { email: 'founder@scaleup.io', surveyResponses: {} });

    // A brand-new service over the same prisma sees everything: restart survival.
    const svc2 = new ValidatorService('http://localhost:3000', prisma);
    const scorecard = await svc2.getScorecard(generated.experimentId, WS);
    expect(scorecard.metrics.waitlistCount).toBe(1);
    expect(scorecard.metrics.visitors).toBe(1); // one public page load
    expect(scorecard.metrics.pageConversions).toBe(1);
    const page2 = await svc2.getPublicPage('k8s-persist');
    expect(page2?.headline).toContain('Kubernetes');
    const scorecard2 = await svc2.getScorecard(generated.experimentId, WS);
    expect(scorecard2.metrics.visitors).toBe(2);
  });

  it('scopes scorecard reads to the owning workspace', async () => {
    const prisma = fakePrisma();
    const svc = new ValidatorService('http://localhost:3000', prisma);
    const generated = await svc.generate(WS, { rawHypothesis: 'Tenant isolation check', preferredSlug: 'tenant-scope' });
    await expect(svc.getScorecard(generated.experimentId, 'ws-other')).rejects.toThrow(/not found/i);
    await expect(svc.getScorecard(generated.experimentId, WS)).resolves.toBeDefined();
  });

  it('rejects a taken preferred slug and suffixes collisions', async () => {
    const prisma = fakePrisma();
    const svc = new ValidatorService('http://localhost:3000', prisma);
    await svc.generate(WS, { rawHypothesis: 'First', preferredSlug: 'taken-slug' });
    await expect(svc.generate(WS, { rawHypothesis: 'Second', preferredSlug: 'taken-slug' })).rejects.toThrow(/already in use/i);
    const auto = await svc.generate(WS, { rawHypothesis: 'Automated Kubernetes cost-cutter for Series A startups' });
    expect(auto.decomposed.slug).toBeTruthy();
  });

  it('returns undefined for unknown public slugs', async () => {
    const svc = new ValidatorService('http://localhost:3000', fakePrisma());
    expect(await svc.getPublicPage('nope')).toBeUndefined();
  });
});
