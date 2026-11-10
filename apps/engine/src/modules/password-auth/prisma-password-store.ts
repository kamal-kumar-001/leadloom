import { randomUUID } from 'node:crypto';
import type { PasswordAccountStore, PasswordUser } from './password-account.service';
import type { Role } from '../auth/rbac';

export class PrismaPasswordStore implements PasswordAccountStore {
  constructor(private readonly prisma: any) {}

  async findByEmail(email: string): Promise<PasswordUser | null> {
    const rows: Array<{ id: string; workspace_id: string; role: string; password_hash: string | null; verified: boolean; ok: boolean }> = await this.prisma.$queryRawUnsafe(
      `SELECT u.id::text AS id, u.workspace_id::text AS workspace_id, u.role, u.password_hash,
              (u.email_verified_at IS NOT NULL) AS verified, (w.is_active AND u.disabled_at IS NULL) AS ok
         FROM users u JOIN workspaces w ON w.id = u.workspace_id WHERE u.email = $1`, email);
    const u = rows[0];
    return u ? { id: u.id, workspaceId: u.workspace_id, role: u.role as Role, passwordHash: u.password_hash, verified: u.verified === true, active: u.ok === true } : null;
  }

  async createPasswordAccount(input: { email: string; name: string | null; workspaceName: string; passwordHash: string }) {
    const workspaceId = randomUUID(), userId = randomUUID();
    try {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.workspace.create({ data: { id: workspaceId, name: input.workspaceName } });
        await tx.user.create({ data: { id: userId, workspaceId, email: input.email, name: input.name, role: 'admin', passwordHash: input.passwordHash } });
        await tx.$executeRawUnsafe(
          `INSERT INTO audit_log (workspace_id, actor_user_id, action, target, metadata) VALUES ($1::uuid, $2::uuid, 'user.registered', $3, '{"method":"password"}'::jsonb)`,
          workspaceId, userId, userId);
      });
      return { userId };
    } catch (e: any) {
      if (e?.code === 'P2002') return null;
      throw e;
    }
  }

  async putToken(i: { userId: string; kind: 'verify' | 'reset'; tokenHash: string; expiresAt: Date }) {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`DELETE FROM email_tokens WHERE user_id = $1::uuid AND kind = $2 AND used_at IS NULL`, i.userId, i.kind);
      await tx.$executeRawUnsafe(`INSERT INTO email_tokens (user_id, kind, token_hash, expires_at) VALUES ($1::uuid, $2, $3, $4)`, i.userId, i.kind, i.tokenHash, i.expiresAt);
    });
  }

  async consumeToken(tokenHash: string, kind: 'verify' | 'reset') {
    const rows: Array<{ user_id: string }> = await this.prisma.$queryRawUnsafe(
      `UPDATE email_tokens SET used_at = now() WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > now() RETURNING user_id::text AS user_id`, tokenHash, kind);
    return rows[0]?.user_id ?? null;
  }

  async markVerified(userId: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1::uuid`, userId);
  }

  // A reset link proves control of the mailbox, so it also verifies the address.
  async setPassword(userId: string, passwordHash: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE users SET password_hash = $2, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1::uuid`, userId, passwordHash);
  }

  async audit(action: string, userId: string | null) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (workspace_id, actor_user_id, action, target) SELECT workspace_id, id, $2, id::text FROM users WHERE id = $1::uuid`, userId, action);
  }
}
