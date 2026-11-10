import { randomUUID } from 'node:crypto';
import type { ProvisioningStore } from './provisioning.service';
import type { Role } from '../auth/rbac';

export class PrismaProvisioningStore implements ProvisioningStore {
  constructor(private readonly prisma: any) {}

  async findByEmail(email: string) {
    const u = await this.prisma.user.findUnique({ where: { email }, select: { id: true, workspaceId: true, role: true } });
    return u ? { userId: u.id as string, workspaceId: u.workspaceId as string, role: u.role as Role } : null;
  }

  async createWorkspaceWithAdmin(input: { email: string; name: string | null; workspaceName: string }) {
    const workspaceId = randomUUID(), userId = randomUUID();
    try {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.workspace.create({ data: { id: workspaceId, name: input.workspaceName } });
        await tx.user.create({ data: { id: userId, workspaceId, email: input.email, name: input.name, role: 'admin' } });
        await tx.$executeRawUnsafe(
          `INSERT INTO audit_log (workspace_id, actor_user_id, action, target, metadata) VALUES ($1::uuid, $2::uuid, 'user.provisioned', $3, '{"method":"verified_email"}'::jsonb)`,
          workspaceId, userId, userId);
      });
      return { userId, workspaceId };
    } catch (e: any) {
      if (e?.code === 'P2002') return null; // email already exists: transaction rolled back, no orphan workspace
      throw e;
    }
  }
}
