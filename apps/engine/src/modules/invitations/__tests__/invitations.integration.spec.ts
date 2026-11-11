import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaProvisioningStore } from '../../provisioning/prisma-provisioning-store';
import { ProvisioningService } from '../../provisioning/provisioning.service';
import { PrismaPasswordStore } from '../../password-auth/prisma-password-store';
import { InvitationService } from '../invitation.service';
import { PrismaInvitationStore } from '../prisma-invitation-store';

/** Gated: LEADLOOM_INTEGRATION=1 + LEADLOOM_TEST_DATABASE_URL on a migrated DB (throwaway data only). */
const URL = process.env.LEADLOOM_TEST_DATABASE_URL;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(URL);

describe.runIf(RUN)('invitations on real Postgres (gated)', () => {
  let prisma: any; const tag = randomUUID().slice(0, 8); const workspaces: string[] = [];
  beforeAll(async () => { const { PrismaClient } = await import('@leadloom/database'); prisma = new PrismaClient({ datasources: { db: { url: URL } } }); });
  afterAll(async () => { await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } }); await prisma.$disconnect(); });

  const owner = async () => {
    const svc = new ProvisioningService(new PrismaProvisioningStore(prisma));
    const o = await svc.provision(`owner-${randomUUID().slice(0, 6)}-${tag}@example.invalid`, 'Owner'); workspaces.push(o.workspaceId); return o;
  };

  const accountVia = async (email: string) => { const r = await new ProvisioningService(new PrismaProvisioningStore(prisma)).provision(email); workspaces.push(r.workspaceId); return r; };
  const invite = (o: any, email: string, role = 'member') => new InvitationService(new PrismaInvitationStore(prisma)).invite(o.workspaceId, o.userId, email, role);
  const inv = () => new InvitationService(new PrismaInvitationStore(prisma));

  it('signing up with an invited address does NOT join anything: it gets its own workspace and the invitation stays open', async () => {
    const o = await owner(); const email = `guest-${tag}@example.invalid`; expect((await invite(o, email, 'read_only')).ok).toBe(true);
    const g = await accountVia(email);
    expect(g.workspaceId).not.toBe(o.workspaceId); expect(g.role).toBe('admin');
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT accepted_at FROM workspace_invitations WHERE email = $1`, email);
    expect(rows[0].accepted_at).toBeNull();
    const ownerRows: any[] = await prisma.$queryRawUnsafe(`SELECT owner_user_id::text o FROM workspaces WHERE id = $1::uuid`, g.workspaceId);
    expect(ownerRows[0].o).toBe(g.userId);
  });
  it('explicit accept by the verified invitee moves a pristine account, deactivates the empty workspace, bumps the session', async () => {
    const o = await owner(); const email = `acc-${tag}@example.invalid`; await invite(o, email, 'read_only'); const g = await accountVia(email);
    const mine = await inv().mine(g.userId); expect(mine).toHaveLength(1); expect(mine[0]).toMatchObject({ role: 'read_only' });
    const before: any[] = await prisma.$queryRawUnsafe(`SELECT session_version v FROM users WHERE id=$1::uuid`, g.userId);
    expect(await inv().accept(g.userId, mine[0].id)).toMatchObject({ ok: true, role: 'read_only', workspaceId: o.workspaceId });
    const u: any[] = await prisma.$queryRawUnsafe(`SELECT workspace_id::text w, role, session_version v FROM users WHERE id=$1::uuid`, g.userId);
    expect(u[0]).toMatchObject({ w: o.workspaceId, role: 'read_only' }); expect(u[0].v).toBe(before[0].v + 1);
    const old: any[] = await prisma.$queryRawUnsafe(`SELECT is_active a FROM workspaces WHERE id=$1::uuid`, g.workspaceId); expect(old[0].a).toBe(false);
    expect(await inv().accept(g.userId, mine[0].id)).toMatchObject({ ok: false }); // single use
  });
  it('another account, a different address, a revoked or an expired invitation can never be accepted', async () => {
    const o = await owner(); const e = `tgt-${tag}@example.invalid`; const m: any = await invite(o, e);
    const thief = await accountVia(`thief-${tag}@example.invalid`);
    expect(await inv().accept(thief.userId, m.invitation.id)).toEqual({ ok: false, reason: 'not_found' });
    const e2 = `rv-${tag}@example.invalid`; const m2: any = await invite(o, e2); const t2 = await accountVia(e2);
    await inv().revoke(o.workspaceId, o.userId, m2.invitation.id);
    expect(await inv().accept(t2.userId, m2.invitation.id)).toEqual({ ok: false, reason: 'not_found' });
    const e3 = `xp-${tag}@example.invalid`; const m3: any = await invite(o, e3); const t3 = await accountVia(e3);
    await prisma.$executeRawUnsafe(`UPDATE workspace_invitations SET expires_at = now() - interval '1 hour' WHERE id = $1::uuid`, m3.invitation.id);
    expect(await inv().accept(t3.userId, m3.invitation.id)).toEqual({ ok: false, reason: 'not_found' });
    expect(await inv().mine(t3.userId)).toHaveLength(0);
  });
  it('an unverified password account cannot see or accept invitations; verified one can', async () => {
    const o = await owner(); const email = `pw-${tag}@example.invalid`; const m: any = await invite(o, email);
    const made: any = await new PrismaPasswordStore(prisma).createPasswordAccount({ email, name: null, workspaceName: 'x', passwordHash: 'h' });
    const w: any[] = await prisma.$queryRawUnsafe(`SELECT workspace_id::text w FROM users WHERE id=$1::uuid`, made.userId); workspaces.push(w[0].w);
    expect(await inv().mine(made.userId)).toHaveLength(0);
    expect(await inv().accept(made.userId, m.invitation.id)).toEqual({ ok: false, reason: 'unverified' });
    await prisma.$executeRawUnsafe(`UPDATE users SET email_verified_at = now() WHERE id=$1::uuid`, made.userId);
    expect(await inv().accept(made.userId, m.invitation.id)).toMatchObject({ ok: true });
  });
  it('an account that holds data, or has other members, is never moved', async () => {
    const o = await owner(); const email = `data-${tag}@example.invalid`; const m: any = await invite(o, email); const g = await accountVia(email);
    await prisma.$executeRawUnsafe(`INSERT INTO tables (id, workspace_id, name, updated_at) VALUES (gen_random_uuid(), $1::uuid, 'keep', now())`, g.workspaceId);
    expect(await inv().accept(g.userId, m.invitation.id)).toEqual({ ok: false, reason: 'has_workspace_data' });
    const u: any[] = await prisma.$queryRawUnsafe(`SELECT workspace_id::text w FROM users WHERE id=$1::uuid`, g.userId); expect(u[0].w).toBe(g.workspaceId);
  });
  it('guard: every workspace table is either checked by accept or a known child of a checked table', async () => {
    const r: any[] = await prisma.$queryRawUnsafe(`SELECT t.table_name n FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='workspace_id') ORDER BY 1`);
    // Reviewed children of workspace-scoped parents, plus auth/global tables. A new table here must be reviewed against Accept's pristine check.
    const known = ['cells', 'columns', 'email_otps', 'enrichment_cache', 'mailbox_sync_state', 'outreach_events', 'rows', 'smoke_test_pages', 'waitlist_leads', 'workspaces', '_prisma_migrations'];
    expect(r.map((x) => x.n).filter((n) => !known.includes(n))).toEqual([]);
  });
  it('a workspace with non-default settings is not pristine', async () => {
    const o = await owner(); const email = `set-${tag}@example.invalid`; const m: any = await invite(o, email); const g = await accountVia(email);
    await prisma.$executeRawUnsafe(`UPDATE workspaces SET preferences = '{"x":1}'::jsonb WHERE id = $1::uuid`, g.workspaceId);
    expect(await inv().accept(g.userId, m.invitation.id)).toEqual({ ok: false, reason: 'has_workspace_data' });
  });
  it('an address that already has an account cannot be invited; invitations are workspace-scoped', async () => {
    const a = await owner(); const b = await owner(); const existing = await accountVia(`ex-${tag}@example.invalid`);
    expect(await inv().invite(a.workspaceId, a.userId, `ex-${tag}@example.invalid`, 'member')).toEqual({ ok: false, reason: 'account_exists' });
    await invite(a, `la-${tag}@example.invalid`);
    expect(await inv().list(b.workspaceId)).toHaveLength(0); expect(existing.userId).toBeTruthy();
  });
  it('only the owner may invite an admin (checked against the engine tables)', async () => {
    const o = await owner(); const email = `adm-${tag}@example.invalid`; await invite(o, email, 'member'); const g = await accountVia(email);
    await inv().accept(g.userId, (await inv().mine(g.userId))[0].id);
    expect(await inv().invite(o.workspaceId, g.userId, `x-${tag}@example.invalid`, 'admin')).toEqual({ ok: false, reason: 'owner_only' });
    expect((await inv().invite(o.workspaceId, o.userId, `x-${tag}@example.invalid`, 'admin')).ok).toBe(true);
  });
});

describe.runIf(RUN)('members on real Postgres (gated)', () => {
  let prisma: any; const tag = randomUUID().slice(0, 8); const workspaces: string[] = [];
  beforeAll(async () => { const { PrismaClient } = await import('@leadloom/database'); prisma = new PrismaClient({ datasources: { db: { url: URL } } }); });
  afterAll(async () => { await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } }); await prisma.$disconnect(); });
  const setup = async () => {
    const { MemberService } = await import('../members'); const { PrismaMemberStore } = await import('../prisma-member-store');
    const p = new ProvisioningService(new PrismaProvisioningStore(prisma)); const inv = new InvitationService(new PrismaInvitationStore(prisma));
    const o = await p.provision(`mo-${randomUUID().slice(0, 6)}-${tag}@example.invalid`); workspaces.push(o.workspaceId);
    const g = `mg-${randomUUID().slice(0, 6)}-${tag}@example.invalid`; await inv.invite(o.workspaceId, o.userId, g, 'member');
    const m = await p.provision(g); workspaces.push(m.workspaceId); await inv.accept(m.userId, (await inv.mine(m.userId))[0].id);
    return { o, m, svc: new MemberService(new PrismaMemberStore(prisma)), p };
  };
  it('lists only its own workspace; role change bumps session_version; last admin is protected; removal suspends without deleting', async () => {
    const { o, m, svc, p } = await setup(); const stranger = await p.provision(`ms-${tag}@example.invalid`); workspaces.push(stranger.workspaceId);
    expect((await svc.list(o.workspaceId)).map((x) => x.role).sort()).toEqual(['admin', 'member']);
    expect(await svc.setRole(o.workspaceId, o.userId, stranger.userId, 'member')).toEqual({ ok: false, reason: 'not_found' });
    expect(await svc.setRole(o.workspaceId, o.userId, o.userId, 'member')).toEqual({ ok: false, reason: 'owner_protected' });
    const before: any[] = await prisma.$queryRawUnsafe(`SELECT session_version v FROM users WHERE id=$1::uuid`, m.userId);
    expect(await svc.setRole(o.workspaceId, o.userId, m.userId, 'admin')).toEqual({ ok: true });
    const after: any[] = await prisma.$queryRawUnsafe(`SELECT session_version v FROM users WHERE id=$1::uuid`, m.userId);
    expect(after[0].v).toBe(before[0].v + 1);
    // m is an admin but not the owner: cannot touch the owner, cannot grant or take admin.
    expect(await svc.setRole(o.workspaceId, m.userId, o.userId, 'member')).toEqual({ ok: false, reason: 'owner_protected' });
    expect(await svc.remove(o.workspaceId, m.userId, o.userId)).toEqual({ ok: false, reason: 'owner_protected' });
    expect(await svc.remove(o.workspaceId, m.userId, m.userId)).toEqual({ ok: false, reason: 'self' });
    expect(await svc.setRole(o.workspaceId, m.userId, m.userId, 'member')).toEqual({ ok: false, reason: 'owner_only' });
    expect(await svc.setRole(o.workspaceId, o.userId, m.userId, 'member')).toEqual({ ok: true });
    expect(await svc.remove(o.workspaceId, o.userId, m.userId)).toEqual({ ok: true });
    const u: any[] = await prisma.$queryRawUnsafe(`SELECT (disabled_at IS NOT NULL) d FROM users WHERE id=$1::uuid`, m.userId);
    expect(u[0].d).toBe(true);
  });
  it('an admin cannot promote another member to admin; owner-only', async () => {
    const { o, m, svc } = await setup(); await svc.setRole(o.workspaceId, o.userId, m.userId, 'admin');
    const mem2 = await svc.list(o.workspaceId); expect(mem2).toHaveLength(2);
    expect(await svc.setRole(o.workspaceId, m.userId, m.userId, 'admin')).toEqual({ ok: false, reason: 'owner_only' });
  });
});
