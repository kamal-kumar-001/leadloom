import type { InvitationRow, InvitationStore } from './invitation.service';
import type { Role } from '../auth/rbac';

const status = (r: any): InvitationRow['status'] =>
  r.accepted_at ? 'accepted' : r.revoked_at ? 'revoked' : new Date(r.expires_at) <= new Date() ? 'expired' : 'pending';
const row = (r: any): InvitationRow => ({ id: r.id, email: r.email, role: r.role as Role, createdAt: r.created_at, expiresAt: r.expires_at, status: status(r) });
const COLS = `id::text AS id, email, role, created_at, expires_at, accepted_at, revoked_at`;

export class PrismaInvitationStore implements InvitationStore {
  constructor(private readonly prisma: any) {}

  async accountExists(email: string) {
    const r: any[] = await this.prisma.$queryRawUnsafe(`SELECT 1 FROM users WHERE email = $1 LIMIT 1`, email);
    return r.length > 0;
  }
  async countOpen(workspaceId: string) {
    const r: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM workspace_invitations WHERE workspace_id = $1::uuid AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`, workspaceId);
    return r[0]?.n ?? 0;
  }
  async countCreatedSince(workspaceId: string, since: Date) {
    const r: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM workspace_invitations WHERE workspace_id = $1::uuid AND created_at > $2`, workspaceId, since);
    return r[0]?.n ?? 0;
  }
  async create(i: { workspaceId: string; email: string; role: Role; invitedBy: string; expiresAt: Date }) {
    return this.prisma.$transaction(async (tx: any) => {
      // An expired but unaccepted invitation must not block a fresh one for the same address.
      await tx.$executeRawUnsafe(
        `UPDATE workspace_invitations SET revoked_at = now() WHERE workspace_id = $1::uuid AND email = $2 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= now()`, i.workspaceId, i.email);
      const r: any[] = await tx.$queryRawUnsafe(
        `INSERT INTO workspace_invitations (workspace_id, email, role, invited_by, expires_at) VALUES ($1::uuid, $2, $3, $4::uuid, $5)
         ON CONFLICT DO NOTHING RETURNING ${COLS}`, i.workspaceId, i.email, i.role, i.invitedBy, i.expiresAt);
      if (!r[0]) return null;
      await tx.$executeRawUnsafe(
        `INSERT INTO audit_log (workspace_id, actor_user_id, action, target, metadata) VALUES ($1::uuid, $2::uuid, 'invitation.created', $3, jsonb_build_object('role', $4::text))`,
        i.workspaceId, i.invitedBy, r[0].id, i.role);
      return row(r[0]);
    });
  }
  async list(workspaceId: string) {
    const r: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT ${COLS} FROM workspace_invitations WHERE workspace_id = $1::uuid ORDER BY created_at DESC LIMIT 100`, workspaceId);
    return r.map(row);
  }
  async revoke(workspaceId: string, id: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const r: any[] = await tx.$queryRawUnsafe(
        `UPDATE workspace_invitations SET revoked_at = now() WHERE id = $1::uuid AND workspace_id = $2::uuid AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id::text AS id`, id, workspaceId);
      if (!r[0]) return false;
      await tx.$executeRawUnsafe(
        `INSERT INTO audit_log (workspace_id, actor_user_id, action, target, metadata) VALUES ($1::uuid, $2::uuid, 'invitation.revoked', $3, '{}'::jsonb)`, workspaceId, actorUserId, id);
      return true;
    });
  }
}

/**
 * Called inside the account-creation transaction. Atomically claims the open,
 * unexpired invitation for this exact address in an active workspace, so two
 * concurrent sign-ups cannot both consume it. Returns null when there is none.
 */
export async function claimPendingInvite(tx: any, email: string): Promise<{ id: string; workspaceId: string; role: Role } | null> {
  const r: any[] = await tx.$queryRawUnsafe(
    `UPDATE workspace_invitations i SET accepted_at = now()
      WHERE i.id = (SELECT i2.id FROM workspace_invitations i2 JOIN workspaces w ON w.id = i2.workspace_id
                     WHERE i2.email = $1 AND i2.accepted_at IS NULL AND i2.revoked_at IS NULL AND i2.expires_at > now() AND w.is_active
                     ORDER BY i2.created_at ASC LIMIT 1 FOR UPDATE OF i2 SKIP LOCKED)
      RETURNING i.id::text AS id, i.workspace_id::text AS workspace_id, i.role`, email);
  return r[0] ? { id: r[0].id, workspaceId: r[0].workspace_id, role: r[0].role as Role } : null;
}
