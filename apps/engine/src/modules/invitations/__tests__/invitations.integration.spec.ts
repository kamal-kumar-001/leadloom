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

  it('provider sign-in with an invited address joins the inviting workspace at the invited role, once', async () => {
    const o = await owner(); const inv = new InvitationService(new PrismaInvitationStore(prisma));
    const email = `guest-${tag}@example.invalid`;
    const made = await inv.invite(o.workspaceId, o.userId, email, 'read_only'); expect(made.ok).toBe(true);
    const svc = new ProvisioningService(new PrismaProvisioningStore(prisma));
    const joined = await svc.provision(email, 'Guest');
    expect(joined).toMatchObject({ workspaceId: o.workspaceId, role: 'read_only', created: true });
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT accepted_user_id::text AS u FROM workspace_invitations WHERE email = $1`, email);
    expect(rows[0].u).toBe(joined.userId);
    expect(await inv.invite(o.workspaceId, o.userId, email, 'member')).toEqual({ ok: false, reason: 'already_member' });
  });
  it('concurrent sign-ins of one invited address yield exactly one account', async () => {
    const o = await owner(); const email = `race-${tag}@example.invalid`;
    await new InvitationService(new PrismaInvitationStore(prisma)).invite(o.workspaceId, o.userId, email, 'member');
    const svc = new ProvisioningService(new PrismaProvisioningStore(prisma));
    const rs = await Promise.all(Array.from({ length: 8 }, () => svc.provision(email)));
    rs.forEach((r) => workspaces.push(r.workspaceId));
    expect(new Set(rs.map((r) => r.workspaceId)).size).toBe(1);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });
  it('an address without an invitation still gets its own workspace as admin; other workspaces never claim it', async () => {
    const o = await owner(); const other = await owner(); const inv = new InvitationService(new PrismaInvitationStore(prisma));
    const email = `plain-${tag}@example.invalid`;
    await inv.invite(other.workspaceId, other.userId, `someone-else-${tag}@example.invalid`, 'admin');
    const r = await new ProvisioningService(new PrismaProvisioningStore(prisma)).provision(email); workspaces.push(r.workspaceId);
    expect(r.workspaceId).not.toBe(o.workspaceId); expect(r.workspaceId).not.toBe(other.workspaceId); expect(r.role).toBe('admin');
  });
  it('revoked and expired invitations are not claimed; revoke is workspace-scoped', async () => {
    const o = await owner(); const other = await owner(); const store = new PrismaInvitationStore(prisma); const inv = new InvitationService(store);
    const e1 = `rev-${tag}@example.invalid`, e2 = `exp-${tag}@example.invalid`;
    const m: any = await inv.invite(o.workspaceId, o.userId, e1, 'member');
    expect(await inv.revoke(other.workspaceId, other.userId, m.invitation.id)).toBe(false);
    expect(await inv.revoke(o.workspaceId, o.userId, m.invitation.id)).toBe(true);
    await inv.invite(o.workspaceId, o.userId, e2, 'member');
    await prisma.$executeRawUnsafe(`UPDATE workspace_invitations SET expires_at = now() - interval '1 hour' WHERE email = $1`, e2);
    const svc = new ProvisioningService(new PrismaProvisioningStore(prisma));
    for (const e of [e1, e2]) { const r = await svc.provision(e); workspaces.push(r.workspaceId); expect(r.workspaceId).not.toBe(o.workspaceId); expect(r.role).toBe('admin'); }
  });
  it('password signup of an invited address joins the workspace, unverified', async () => {
    const o = await owner(); const email = `pw-${tag}@example.invalid`;
    await new InvitationService(new PrismaInvitationStore(prisma)).invite(o.workspaceId, o.userId, email, 'member');
    const made = await new PrismaPasswordStore(prisma).createPasswordAccount({ email, name: null, workspaceName: 'x', passwordHash: 'h' });
    expect(made).not.toBeNull();
    const u: any[] = await prisma.$queryRawUnsafe(`SELECT workspace_id::text AS w, role, (email_verified_at IS NULL) AS unverified FROM users WHERE email = $1`, email);
    expect(u[0]).toEqual({ w: o.workspaceId, role: 'member', unverified: true });
  });
  it('listing and creating are scoped to the workspace', async () => {
    const a = await owner(); const b = await owner(); const inv = new InvitationService(new PrismaInvitationStore(prisma));
    await inv.invite(a.workspaceId, a.userId, `la-${tag}@example.invalid`, 'member');
    expect(await inv.list(b.workspaceId)).toHaveLength(0);
    expect((await inv.list(a.workspaceId)).length).toBe(1);
  });
});
