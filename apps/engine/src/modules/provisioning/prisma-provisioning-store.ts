import { randomUUID } from 'node:crypto';
import type { ProvisioningStore } from './provisioning.service';
import type { Role } from '../auth/rbac';
import { claimPendingInvite } from '../invitations/prisma-invitation-store';

export class PrismaProvisioningStore implements ProvisioningStore {
  constructor(private readonly prisma: any) {}

  async findByEmail(email: string) {
    const rows: Array<{ id: string; workspace_id: string; role: string; ok: boolean }> = await this.prisma.$queryRawUnsafe(
      `SELECT u.id::text AS id, u.workspace_id::text AS workspace_id, u.role, (w.is_active AND u.disabled_at IS NULL) AS ok
         FROM users u JOIN workspaces w ON w.id = u.workspace_id WHERE u.email = $1`, email);
    const u = rows[0];
    return u ? { userId: u.id, workspaceId: u.workspace_id, role: u.role as Role, active: u.ok === true } : null;
  }

  async createWorkspaceWithAdmin(input: { email: string; name: string | null; workspaceName: string }) {
    let workspaceId: string = randomUUID(); const userId = randomUUID(); let role: Role = 'admin';
    try {
      await this.prisma.$transaction(async (tx: any) => {
        // A pending invitation for this exact, provider-verified address joins the inviting workspace
        // at the invited role instead of creating a new workspace.
        const invite = await claimPendingInvite(tx, input.email);
        if (invite) { workspaceId = invite.workspaceId; role = invite.role; }
        else await tx.workspace.create({ data: { id: workspaceId, name: input.workspaceName } });
        await tx.user.create({ data: { id: userId, workspaceId, email: input.email, name: input.name, role } });
        if (invite) await tx.$executeRawUnsafe(`UPDATE workspace_invitations SET accepted_user_id = $2::uuid WHERE id = $1::uuid`, invite.id, userId);
        await tx.$executeRawUnsafe(
          `INSERT INTO audit_log (workspace_id, actor_user_id, action, target, metadata) VALUES ($1::uuid, $2::uuid, 'user.provisioned', $3, $4::jsonb)`,
          workspaceId, userId, userId, JSON.stringify(invite ? { method: 'verified_email', invitation: invite.id } : { method: 'verified_email' }));
      });
      return { userId, workspaceId, role };
    } catch (e: any) {
      if (e?.code === 'P2002') return null; // email already exists: transaction rolled back, no orphan workspace, invitation not consumed
      throw e;
    }
  }
}
