import type { AcceptResult, InvitationRow, InvitationStore, MyInvitation } from './invitation.service';
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

  async isWorkspaceOwner(workspaceId: string, userId: string) {
    const r: any[] = await this.prisma.$queryRawUnsafe(`SELECT 1 FROM workspaces WHERE id = $1::uuid AND owner_user_id = $2::uuid`, workspaceId, userId);
    return r.length > 0;
  }

  /** Open invitations addressed to the signed-in user's own address, only when that identity is verified. */
  async listForUser(userId: string): Promise<MyInvitation[]> {
    const me = await this.identity(this.prisma, userId);
    if (!me || !me.verified || !me.active) return [];
    const r: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT i.id::text AS id, i.role, i.expires_at, w.name AS workspace_name, u.name AS inviter_name
         FROM workspace_invitations i JOIN workspaces w ON w.id = i.workspace_id AND w.is_active LEFT JOIN users u ON u.id = i.invited_by
        WHERE i.email = $1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now() ORDER BY i.created_at DESC LIMIT 20`, me.email);
    return r.map((x) => ({ id: x.id, role: x.role as Role, expiresAt: x.expires_at, workspaceName: x.workspace_name, inviterName: x.inviter_name ?? null }));
  }

  private async identity(db: any, userId: string) {
    // Verified = the engine has its own proof of the mailbox: a completed email verification, or a
    // provider-verified provisioning record. A merely registered (unverified) password account is not.
    const r: any[] = await db.$queryRawUnsafe(
      `SELECT u.email, u.workspace_id::text AS workspace_id, u.role, (u.disabled_at IS NULL AND w.is_active) AS active,
              (u.email_verified_at IS NOT NULL OR EXISTS (SELECT 1 FROM audit_log a WHERE a.action = 'user.provisioned' AND a.target = u.id::text AND a.metadata ->> 'method' = 'verified_email')) AS verified
         FROM users u JOIN workspaces w ON w.id = u.workspace_id WHERE u.id = $1::uuid`, userId);
    return r[0] ? { email: String(r[0].email), workspaceId: String(r[0].workspace_id), role: String(r[0].role), active: r[0].active === true, verified: r[0].verified === true } : null;
  }

  /**
   * Explicit accept by the invited user. Moves only a pristine account: the user is the sole member and
   * creator of a workspace holding no data at all. Otherwise nothing moves (no forced migration of real data).
   * The emptied workspace is deactivated, not deleted.
   */
  async accept(userId: string, invitationId: string): Promise<AcceptResult> {
    return this.prisma.$transaction(async (tx: any): Promise<AcceptResult> => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, `accept:${userId}`);
      const me = await this.identity(tx, userId);
      if (!me || !me.active) return { ok: false, reason: 'not_found' };
      if (!me.verified) return { ok: false, reason: 'unverified' };
      const inv: any[] = await tx.$queryRawUnsafe(
        `SELECT i.id::text AS id, i.workspace_id::text AS workspace_id, i.role FROM workspace_invitations i JOIN workspaces w ON w.id = i.workspace_id AND w.is_active
          WHERE i.id = $1::uuid AND i.email = $2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now() FOR UPDATE OF i`, invitationId, me.email.toLowerCase());
      if (!inv[0]) return { ok: false, reason: 'not_found' };
      if (inv[0].workspace_id === me.workspaceId) return { ok: false, reason: 'already_member' };
      const own: any[] = await tx.$queryRawUnsafe(
        `SELECT (SELECT count(*)::int FROM users WHERE workspace_id = $1::uuid) AS members, (w.owner_user_id = $2::uuid) AS is_owner FROM workspaces w WHERE w.id = $1::uuid`, me.workspaceId, userId);
      if (!own[0] || own[0].members !== 1 || own[0].is_owner !== true) return { ok: false, reason: 'has_workspace_data' };
      const tables: Array<{ table_name: string }> = await tx.$queryRawUnsafe(
        `SELECT DISTINCT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
          WHERE c.table_schema = 'public' AND c.column_name = 'workspace_id' AND c.table_name NOT IN ('users', 'audit_log', 'workspace_invitations')`);
      for (const t of tables) {
        if (!/^[a-z_][a-z0-9_]*$/.test(t.table_name)) return { ok: false, reason: 'has_workspace_data' }; // unexpected name: refuse rather than guess
        const c: any[] = await tx.$queryRawUnsafe(`SELECT 1 FROM "${t.table_name}" WHERE workspace_id = $1::uuid LIMIT 1`, me.workspaceId);
        if (c.length > 0) return { ok: false, reason: 'has_workspace_data' };
      }
      await tx.$executeRawUnsafe(`UPDATE users SET workspace_id = $2::uuid, role = $3, session_version = session_version + 1 WHERE id = $1::uuid`, userId, inv[0].workspace_id, inv[0].role);
      await tx.$executeRawUnsafe(`UPDATE workspaces SET is_active = false WHERE id = $1::uuid`, me.workspaceId);
      await tx.$executeRawUnsafe(`UPDATE workspace_invitations SET accepted_at = now(), accepted_user_id = $2::uuid WHERE id = $1::uuid`, invitationId, userId);
      await tx.$executeRawUnsafe(
        `INSERT INTO audit_log (workspace_id, actor_user_id, action, target, metadata) VALUES ($1::uuid, $2::uuid, 'invitation.accepted', $3, jsonb_build_object('role', $4::text, 'left_empty_workspace', $5::text))`,
        inv[0].workspace_id, userId, invitationId, inv[0].role, me.workspaceId);
      return { ok: true, workspaceId: inv[0].workspace_id, role: inv[0].role as Role };
    });
  }
}
