import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { ValidatorService } from '../validator.service';

/**
 * Disposable isolated-fixture evidence for the validator's Prisma path
 * (PGlite PostgreSQL WASM). No live DB, no host effect, no production data.
 * The facade below implements the exact call shapes ValidatorService uses,
 * over REAL SQL - so uniques, joins and JSON round-trips are exercised, which
 * the in-memory fake in validator-persistence.spec.ts cannot prove.
 * Fixture DDL models only the three tables the service touches (workspace FK
 * omitted; tenant scoping is asserted at the query level instead).
 */

const DDL = `
CREATE TABLE validation_experiments (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  hypothesis text NOT NULL,
  icp_spec jsonb,
  sequence_subject text,
  sequence_body text,
  outreach_sent int NOT NULL DEFAULT 0,
  replies int NOT NULL DEFAULT 0,
  positive_replies int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE smoke_test_pages (
  id uuid PRIMARY KEY,
  experiment_id uuid NOT NULL REFERENCES validation_experiments(id) ON DELETE CASCADE,
  slug varchar(128) UNIQUE NOT NULL,
  title varchar(255) NOT NULL,
  headline text NOT NULL,
  subheadline text NOT NULL,
  hero_cta_text varchar(255) NOT NULL DEFAULT 'Request Early Access',
  survey_questions jsonb NOT NULL DEFAULT '[]',
  visitors int NOT NULL DEFAULT 0,
  status varchar(16) NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE waitlist_leads (
  id uuid PRIMARY KEY,
  page_id uuid NOT NULL REFERENCES smoke_test_pages(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  name varchar(255),
  company varchar(255),
  survey_responses jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);`;

const EXP_COLS = `id, workspace_id AS "workspaceId", hypothesis, icp_spec AS "icpSpec", sequence_subject AS "sequenceSubject", sequence_body AS "sequenceBody", outreach_sent AS "outreachSent", replies, positive_replies AS "positiveReplies", created_at AS "createdAt"`;
const PAGE_COLS = `id, experiment_id AS "experimentId", slug, title, headline, subheadline, hero_cta_text AS "heroCtaText", survey_questions AS "surveyQuestions", visitors, status, created_at AS "createdAt"`;
const LEAD_COLS = `id, page_id AS "pageId", email, name, company, survey_responses AS "surveyResponses", created_at AS "createdAt"`;

function pglitePrisma(pg: PGlite) {
  const leadsFor = async (pageId: string) =>
    (await pg.query(`SELECT ${LEAD_COLS} FROM waitlist_leads WHERE page_id=$1 ORDER BY created_at`, [pageId])).rows as any[];
  const withLeads = async (p: any) => ({ ...p, waitlistLeads: await leadsFor(p.id) });
  return {
    validationExperiment: {
      findFirst: async ({ where, include }: any) => {
        const conds: string[] = []; const params: any[] = [];
        if (where.id) { params.push(where.id); conds.push(`id=$${params.length}`); }
        if (where.workspaceId) { params.push(where.workspaceId); conds.push(`workspace_id=$${params.length}`); }
        const res = await pg.query(`SELECT ${EXP_COLS} FROM validation_experiments ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} LIMIT 1`, params);
        const e = res.rows[0] as any; if (!e) return null;
        if (include?.smokeTestPages) {
          const pages = (await pg.query(`SELECT ${PAGE_COLS} FROM smoke_test_pages WHERE experiment_id=$1`, [e.id])).rows as any[];
          return { ...e, smokeTestPages: await Promise.all(pages.map(withLeads)) };
        }
        return e;
      },
      create: async ({ data }: any) => {
        await pg.query(
          `INSERT INTO validation_experiments (id, workspace_id, hypothesis, icp_spec, sequence_subject, sequence_body)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [data.id, data.workspaceId, data.hypothesis, JSON.stringify(data.icpSpec ?? null), data.sequenceSubject ?? null, data.sequenceBody ?? null]);
        const pc = data.smokeTestPages?.create;
        if (pc) {
          await pg.query(
            `INSERT INTO smoke_test_pages (id, experiment_id, slug, title, headline, subheadline, hero_cta_text, survey_questions)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [pc.id, data.id, pc.slug, pc.title, pc.headline, pc.subheadline, pc.heroCtaText, JSON.stringify(pc.surveyQuestions ?? [])]);
        }
        return data;
      },
      update: async ({ where, data }: any) => {
        const sets: string[] = []; const params: any[] = [];
        for (const [k, col] of [['outreachSent','outreach_sent'],['replies','replies'],['positiveReplies','positive_replies']] as const) {
          if (k in data) { params.push((data as any)[k]); sets.push(`${col}=$${params.length}`); }
        }
        if (!sets.length) return null;
        params.push(where.id);
        await pg.query(`UPDATE validation_experiments SET ${sets.join(', ')} WHERE id=$${params.length}`, params);
        return null;
      },
    },
    smokeTestPage: {
      findMany: async ({ where, select }: any) => {
        const res = await pg.query(`SELECT slug FROM smoke_test_pages WHERE slug LIKE $1`, [where.slug.startsWith + '%']);
        return res.rows as any[];
      },
      findFirst: async ({ where, include }: any) => {
        const conds: string[] = []; const params: any[] = [];
        if (where.slug) { params.push(where.slug); conds.push(`slug=$${params.length}`); }
        if (where.experimentId) { params.push(where.experimentId); conds.push(`experiment_id=$${params.length}`); }
        if (where.status) { params.push(where.status); conds.push(`status=$${params.length}`); }
        const res = await pg.query(`SELECT ${PAGE_COLS} FROM smoke_test_pages WHERE ${conds.join(' AND ')} LIMIT 1`, params);
        let p = res.rows[0] as any; if (!p) return null;
        if (include?.waitlistLeads) p = await withLeads(p);
        if (include?.experiment) {
          p = { ...p, experiment: (await pg.query(`SELECT ${EXP_COLS} FROM validation_experiments WHERE id=$1`, [p.experimentId])).rows[0] };
        }
        return p;
      },
      update: async ({ where, data }: any) => {
        if (data.visitors?.increment) {
          await pg.query(`UPDATE smoke_test_pages SET visitors = visitors + $1 WHERE id=$2`, [data.visitors.increment, where.id]);
        }
        if (data.status) {
          await pg.query(`UPDATE smoke_test_pages SET status=$1 WHERE id=$2`, [data.status, where.id]);
        }
        return null;
      },
    },
    waitlistLead: {
      create: async ({ data }: any) => {
        await pg.query(
          `INSERT INTO waitlist_leads (id, page_id, email, name, company, survey_responses) VALUES ($1,$2,$3,$4,$5,$6)`,
          [data.id, data.pageId, data.email, data.name ?? null, data.company ?? null, JSON.stringify(data.surveyResponses ?? {})]);
        return data;
      },
    },
  };
}

const WS_A = crypto.randomUUID();
const WS_B = crypto.randomUUID();

describe('ValidatorService on real SQL (PGlite isolated fixture)', () => {
  let pg: PGlite;
  beforeEach(async () => {
    pg = new PGlite();
    await pg.exec(DDL);
  });
  afterEach(async () => { await pg.close(); });

  it('generate persists experiment + page; a FRESH service instance over the same DB sees them (restart survival)', async () => {
    const svc1 = new ValidatorService('http://localhost:3000', pglitePrisma(pg));
    const gen = await svc1.generate(WS_A, { rawHypothesis: 'Automated Kubernetes cost-cutter for Series A startups', preferredSlug: 'k8s-sql' });
    const svc2 = new ValidatorService('http://localhost:3000', pglitePrisma(pg));
    const exp = await svc2.getExperiment(gen.experimentId, WS_A);
    expect(exp?.hypothesis).toBe('Automated Kubernetes cost-cutter for Series A startups');
    expect(exp?.decomposed.slug).toBe('k8s-sql');
    const page = await svc2.getOwnerPage(gen.experimentId, WS_A);
    expect(page?.status).toBe('draft');
  });

  it('preferredSlug collision throws; auto-slug collision gets a suffix', async () => {
    const svc = new ValidatorService('http://localhost:3000', pglitePrisma(pg));
    await svc.generate(WS_A, { rawHypothesis: 'First', preferredSlug: 'taken-sql' });
    await expect(svc.generate(WS_A, { rawHypothesis: 'Second', preferredSlug: 'taken-sql' })).rejects.toThrow(/already in use/i);
    const auto = await svc.generate(WS_A, { rawHypothesis: 'Automated Kubernetes cost-cutter for Series A startups' });
    expect(auto.decomposed.slug).not.toBe('k8s-sql');
  });

  it('publish boundary: drafts invisible publicly, published pages served and visitor loads counted', async () => {
    const svc = new ValidatorService('http://localhost:3000', pglitePrisma(pg));
    const gen = await svc.generate(WS_A, { rawHypothesis: 'Draft boundary over SQL' });
    expect(await svc.getPublicPage(gen.decomposed.slug)).toBeUndefined();
    await svc.setPublishStatus(gen.experimentId, WS_A, true);
    const pub = await svc.getPublicPage(gen.decomposed.slug);
    expect(pub?.slug).toBe(gen.decomposed.slug);
    await svc.recordTraffic(gen.decomposed.slug);
    const exp = await svc.getExperiment(gen.experimentId, WS_A);
    expect(exp?.metrics.visitors).toBe(2);
  });

  it('submitLead dedups case-insensitively and counts totalWaitlist over real rows', async () => {
    const svc = new ValidatorService('http://localhost:3000', pglitePrisma(pg));
    const gen = await svc.generate(WS_A, { rawHypothesis: 'Lead capture over SQL' });
    await expect(svc.submitLead(gen.decomposed.slug, { email: 'a@b.co', surveyResponses: {} })).rejects.toThrow(/not found/i);
    await svc.setPublishStatus(gen.experimentId, WS_A, true);
    const first = await svc.submitLead(gen.decomposed.slug, { email: 'First@Example.com', surveyResponses: { q1: 'yes' } });
    expect(first.totalWaitlist).toBe(1);
    const dup = await svc.submitLead(gen.decomposed.slug, { email: 'first@example.COM', surveyResponses: {} });
    expect(dup.totalWaitlist).toBe(1);
    const exp = await svc.getExperiment(gen.experimentId, WS_A);
    expect(exp?.leads[0]?.email).toBe('first@example.com');
  });

  it('tenant scoping holds on real rows; outreach metrics persist and validate', async () => {
    const svc = new ValidatorService('http://localhost:3000', pglitePrisma(pg));
    const gen = await svc.generate(WS_A, { rawHypothesis: 'Tenant scope over SQL' });
    expect(await svc.getExperiment(gen.experimentId, WS_B)).toBeUndefined();
    await expect(svc.setPublishStatus(gen.experimentId, WS_B, true)).rejects.toThrow(/not found/i);
    const sc = await svc.updateOutreachMetrics(gen.experimentId, WS_A, 10, 3, 1);
    expect(sc.metrics.outreachSent).toBe(10);
    const svc2 = new ValidatorService('http://localhost:3000', pglitePrisma(pg));
    const fresh = await svc2.getExperiment(gen.experimentId, WS_A);
    expect(fresh?.metrics.outreachSent).toBe(10);
    await expect(svc2.updateOutreachMetrics(gen.experimentId, WS_A, 1, 5, 0)).rejects.toThrow(/Invalid outreach metrics/i);
  });
});
