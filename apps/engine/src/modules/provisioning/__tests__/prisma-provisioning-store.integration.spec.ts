import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaProvisioningStore } from '../prisma-provisioning-store';
import { ProvisioningService } from '../provisioning.service';

/** Gated: LEADLOOM_INTEGRATION=1 + LEADLOOM_TEST_DATABASE_URL on a migrated DB. */
const URL = process.env.LEADLOOM_TEST_DATABASE_URL;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(URL);

describe.runIf(RUN)('provisioning on real Postgres (gated)', () => {
  let prisma: any; const tag = randomUUID().slice(0, 8); const created: string[] = []; const actors: string[] = [];
  beforeAll(async () => { const { PrismaClient } = await import('@leadloom/database'); prisma = new PrismaClient({ datasources: { db: { url: URL } } }); });
  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: created } } });
    await prisma.$executeRawUnsafe(`DELETE FROM audit_log WHERE actor_user_id = ANY($1::uuid[])`, actors);
    await prisma.$disconnect();
  });

  it('concurrent first sign-ins make exactly one workspace, one admin user and one audit row, with no orphans', async () => {
    const email = `race-${tag}@example.invalid`;
    const svc = new ProvisioningService(new PrismaProvisioningStore(prisma));
    const results = await Promise.all(Array.from({ length: 10 }, () => svc.provision(email, 'Racer')));
    const ids = new Set(results.map((r) => r.workspaceId)); created.push(...ids);
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1); expect(users[0].role).toBe('admin');
    const wsCount = await prisma.workspace.count({ where: { name: { startsWith: 'Racer' } , users: { none: {} } } });
    expect(wsCount).toBe(0); // rolled-back attempts left no orphan workspace
    actors.push(users[0].id);
    const audit: any[] = await prisma.$queryRawUnsafe(`SELECT action, workspace_id::text AS w FROM audit_log WHERE actor_user_id = $1::uuid`, users[0].id);
    expect(audit).toEqual([{ action: 'user.provisioned', w: users[0].workspaceId }]);
  });
  it('an existing user keeps role and workspace', async () => {
    const ws = randomUUID(); created.push(ws);
    await prisma.workspace.create({ data: { id: ws, name: `pre-${tag}` } });
    const email = `member-${tag}@example.invalid`;
    await prisma.user.create({ data: { id: randomUUID(), workspaceId: ws, email, role: 'read_only' } });
    const r = await new ProvisioningService(new PrismaProvisioningStore(prisma)).provision(email);
    expect(r).toMatchObject({ workspaceId: ws, role: 'read_only', created: false });
  });
});

describe.runIf(RUN)('access guard on real Postgres (gated)', () => {
  it('suspended user or inactive workspace is denied; unknown pair is denied; active is allowed', async () => {
    const { PrismaClient } = await import('@leadloom/database');
    const prisma: any = new PrismaClient({ datasources: { db: { url: URL } } });
    const { PrismaAccessGuard } = await import('../../auth/access-guard');
    const guard = new PrismaAccessGuard(prisma);
    const ws = randomUUID(), other = randomUUID(), u = randomUUID();
    try {
      await prisma.workspace.create({ data: { id: ws, name: 'guard-a' } });
      await prisma.workspace.create({ data: { id: other, name: 'guard-b' } });
      await prisma.user.create({ data: { id: u, workspaceId: ws, email: `guard-${u}@example.invalid`, role: 'member' } });
      expect(await guard.isActive(u, ws)).toBe(true);
      expect(await guard.isActive(u, other)).toBe(false); // wrong tenant pairing
      expect(await guard.isActive(randomUUID(), ws)).toBe(false);
      await prisma.user.update({ where: { id: u }, data: { disabledAt: new Date() } });
      expect(await guard.isActive(u, ws)).toBe(false);
      await prisma.user.update({ where: { id: u }, data: { disabledAt: null } });
      await prisma.workspace.update({ where: { id: ws }, data: { isActive: false } });
      expect(await guard.isActive(u, ws)).toBe(false);
      // suspended identity is not provisioned or revived
      const { PrismaProvisioningStore } = await import('../prisma-provisioning-store');
      const { ProvisioningService, AccountSuspendedError } = await import('../provisioning.service');
      await expect(new ProvisioningService(new PrismaProvisioningStore(prisma)).provision(`guard-${u}@example.invalid`)).rejects.toBeInstanceOf(AccountSuspendedError);
    } finally { await prisma.workspace.deleteMany({ where: { id: { in: [ws, other] } } }); await prisma.$disconnect(); }
  });
});
