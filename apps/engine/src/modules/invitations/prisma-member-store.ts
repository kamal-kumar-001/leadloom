import type { MemberChange, MemberRow, MemberStore } from './members';
import type { Role } from '../auth/rbac';

export class PrismaMemberStore implements MemberStore {
  constructor(private readonly prisma: any) {}

  async list(workspaceId: string): Promise<MemberRow[]> {
    const r: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, email, name, role, (email_verified_at IS NOT NULL) AS verified, (disabled_at IS NULL) AS active, created_at,
              (id = (SELECT owner_user_id FROM workspaces WHERE id = $1::uuid)) AS is_owner
         FROM users WHERE workspace_id = $1::uuid ORDER BY created_at ASC LIMIT 200`, workspaceId);
    return r.map((x) => ({ id: x.id, email: x.email, name: x.name, role: x.role as Role, verified: x.verified, active: x.active, createdAt: x.created_at, isOwner: x.is_owner === true }));
  }

  private async actorIsOwner(tx: any, workspaceId: string, actorId: string) {
    const r: any[] = await tx.$queryRawUnsafe(`SELECT 1 FROM workspaces WHERE id = $1::uuid AND owner_user_id = $2::uuid`, workspaceId, actorId);
    return r.length > 0;
  }

  private async guarded(workspaceId: string, targetId: string, fn: (tx: any, target: { role: string; active: boolean; isOwner: boolean }, otherActiveAdmins: number) => Promise<MemberChange>): Promise<MemberChange> {
    return this.prisma.$transaction(async (tx: any) => {
      // Serialize every membership change in this workspace so two admins cannot demote each other to zero admins.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, `members:${workspaceId}`);
      const t: any[] = await tx.$queryRawUnsafe(`SELECT u.role, (u.disabled_at IS NULL) AS active, (w.owner_user_id = u.id) AS is_owner FROM users u JOIN workspaces w ON w.id = u.workspace_id WHERE u.id = $1::uuid AND u.workspace_id = $2::uuid`, targetId, workspaceId);
      if (!t[0]) return { ok: false, reason: 'not_found' } as const;
      const o: any[] = await tx.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM users WHERE workspace_id = $1::uuid AND role = 'admin' AND disabled_at IS NULL AND id <> $2::uuid`, workspaceId, targetId);
      return fn(tx, { role: t[0].role, active: t[0].active, isOwner: t[0].is_owner === true }, o[0]?.n ?? 0);
    });
  }

  setRole(workspaceId: string, actorId: string, targetId: string, role: Role) {
    return this.guarded(workspaceId, targetId, async (tx, t, others) => {
      // The owner is protected from everyone, and only the owner grants or takes the admin role.
      if (t.isOwner) return { ok: false, reason: 'owner_protected' };
      if ((role === 'admin' || t.role === 'admin') && !(await this.actorIsOwner(tx, workspaceId, actorId))) return { ok: false, reason: 'owner_only' };
      if (t.role === 'admin' && t.active && role !== 'admin' && others === 0) return { ok: false, reason: 'last_admin' };
      await tx.$executeRawUnsafe(`UPDATE users SET role = $3, session_version = session_version + 1 WHERE id = $1::uuid AND workspace_id = $2::uuid`, targetId, workspaceId, role);
      await tx.$executeRawUnsafe(`INSERT INTO audit_log (workspace_id, actor_user_id, action, target, metadata) VALUES ($1::uuid, $2::uuid, 'member.role_changed', $3, jsonb_build_object('from', $4::text, 'to', $5::text))`, workspaceId, actorId, targetId, t.role, role);
      return { ok: true };
    });
  }

  suspend(workspaceId: string, actorId: string, targetId: string) {
    return this.guarded(workspaceId, targetId, async (tx, t, others) => {
      if (t.isOwner) return { ok: false, reason: 'owner_protected' };
      if (t.role === 'admin' && !(await this.actorIsOwner(tx, workspaceId, actorId))) return { ok: false, reason: 'owner_only' };
      if (t.role === 'admin' && t.active && others === 0) return { ok: false, reason: 'last_admin' };
      await tx.$executeRawUnsafe(`UPDATE users SET disabled_at = coalesce(disabled_at, now()), session_version = session_version + 1 WHERE id = $1::uuid AND workspace_id = $2::uuid`, targetId, workspaceId);
      await tx.$executeRawUnsafe(`INSERT INTO audit_log (workspace_id, actor_user_id, action, target, metadata) VALUES ($1::uuid, $2::uuid, 'member.removed', $3, '{}'::jsonb)`, workspaceId, actorId, targetId);
      return { ok: true };
    });
  }
}
