import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@leadloom/database';
import { ValidatorService } from '../validator.service';

const url = process.env.LEADLOOM_TEST_DATABASE_URL;
describe.runIf(process.env.LEADLOOM_INTEGRATION === '1' && Boolean(url))('native waitlist capture concurrency and publication boundary', () => {
  let db: PrismaClient;
  let service: ValidatorService;
  const ws = randomUUID();
  let experimentId: string;
  const slug = 'capture-' + randomUUID();
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    service = new ValidatorService('http://localhost:3000', db);
    await db.workspace.create({ data: { id: ws, name: 'Synthetic capture concurrency' } });
    const created = await service.generate(ws, { rawHypothesis: 'Synthetic capture boundary experiment', preferredSlug: slug });
    experimentId = created.experimentId;
    await service.setPublishStatus(experimentId,ws,true,(await service.getOwnerPage(experimentId,ws))?.revision);
  });
  afterAll(async () => {
    if (db) { await db.workspace.delete({ where: { id: ws } }); await db.$disconnect(); }
  });
  it('twenty parallel case-variant retries create one row and return committed counts, preserving original answers', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => service.submitLead(slug, {
      email: i % 2 ? 'CASE@example.invalid' : 'case@example.invalid', name: 'Synthetic visitor', surveyResponses: { q1: 'Original answer' }, referrer: 'synthetic-referrer',
    })));
    expect(results.every((r) => r.success && r.totalWaitlist === 1)).toBe(true);
    const fresh = new ValidatorService('http://localhost:3000', db);
    const leads = await fresh.getLeads(experimentId, ws);
    expect(leads.totalLeads).toBe(1);
    expect(leads.leads[0].email).toBe('case@example.invalid');
    await service.submitLead(slug, { email: 'case@example.invalid', surveyResponses: { q1: 'Retry must not overwrite' } });
    expect((await fresh.getLeads(experimentId, ws)).leads[0].surveyResponses).toEqual({ q1: 'Original answer' });
    const stored = await db.waitlistLead.findFirstOrThrow({ where: { page: { experimentId } } });
    expect(stored.referrer).toBe('synthetic-referrer');
    expect((await fresh.getScorecard(experimentId, ws)).metrics.waitlistCount).toBe(1);
  });
  it('distinct visitors persist with exact counts and never collide across pages', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => service.submitLead(slug, { email: `visitor${i}@example.invalid`, surveyResponses: {} })));
    expect(results.map((r) => r.totalWaitlist).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 2));
    const other = await service.generate(ws, { rawHypothesis: 'Other synthetic experiment', preferredSlug: 'other-' + randomUUID() });
    await service.setPublishStatus(other.experimentId,ws,true,(await service.getOwnerPage(other.experimentId,ws))?.revision);
    await service.submitLead(other.decomposed.slug, { email: 'case@example.invalid', surveyResponses: {} });
    expect((await service.getLeads(other.experimentId, ws)).totalLeads).toBe(1);
    expect((await service.getLeads(experimentId, ws)).totalLeads).toBe(13);
  });
  it('a committed unpublish blocks queued capture before inserting, and storage failure remains a failure', async () => {
    // Hold the page row in an actual independent transaction until submit is
    // in flight, then commit its unpublished status. The waiter must recheck.
    let unlock!: () => void, locked!: () => void;
    const held = new Promise<void>((r) => { locked = r; });
    const release = new Promise<void>((r) => { unlock = r; });
    const writer = db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM smoke_test_pages WHERE slug=$1 FOR UPDATE', slug);
      await tx.smokeTestPage.updateMany({ where: { slug }, data: { status: 'draft' } });
      locked(); await release;
    });
    await held;
    const pending = service.submitLead(slug, { email: 'after-unpublish@example.invalid', surveyResponses: {} });
    await new Promise((r) => setTimeout(r, 50)); unlock(); await writer;
    await expect(pending).rejects.toThrow(/not found/);
    expect((await service.getLeads(experimentId, ws)).totalLeads).toBe(13);
    const unavailable = new ValidatorService('http://localhost:3000', { $transaction: async () => { throw new Error('Synthetic storage failure'); } });
    await expect(unavailable.submitLead(slug, { email: 'failure@example.invalid', surveyResponses: {} })).rejects.toThrow(/storage failure/);
  });
});
