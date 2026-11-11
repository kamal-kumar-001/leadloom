import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { PasswordAccountStore, PasswordUser } from './password-account.service';
import type { Role } from '../auth/rbac';

export class PrismaPasswordStore implements PasswordAccountStore {
  constructor(private readonly prisma: any) {}

  async findByEmail(email: string): Promise<PasswordUser | null> {
    const rows: Array<{ id: string; workspace_id: string; role: string; password_hash: string | null; session_version: number; verified: boolean; ok: boolean }> = await this.prisma.$queryRawUnsafe(
      `SELECT u.id::text AS id, u.workspace_id::text AS workspace_id, u.role, u.password_hash, u.session_version,
              (u.email_verified_at IS NOT NULL) AS verified, (w.is_active AND u.disabled_at IS NULL) AS ok
         FROM users u JOIN workspaces w ON w.id = u.workspace_id WHERE u.email = $1`, email);
    const u = rows[0];
    return u ? { id: u.id, workspaceId: u.workspace_id, role: u.role as Role, sessionVersion: u.session_version, passwordHash: u.password_hash, verified: u.verified === true, active: u.ok === true } : null;
  }

  async createPasswordAccount(input: { email: string; name: string | null; workspaceName: string; passwordHash: string }) {
    const workspaceId = randomUUID(), userId = randomUUID();
    try {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.workspace.create({ data: { id: workspaceId, name: input.workspaceName } });
        await tx.user.create({ data: { id: userId, workspaceId, email: input.email, name: input.name, role: 'admin', passwordHash: input.passwordHash } });
        await tx.$executeRawUnsafe(`UPDATE workspaces SET owner_user_id = $2::uuid WHERE id = $1::uuid`, workspaceId, userId);
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

  async replaceUnverifiedPassword(email: string, passwordHash: string) {
    const rows: Array<{ id: string }> = await this.prisma.$queryRawUnsafe(
      `UPDATE users SET password_hash = $2 WHERE email = $1 AND email_verified_at IS NULL AND disabled_at IS NULL RETURNING id::text AS id`, email, passwordHash);
    return rows[0]?.id ?? null;
  }

  async putOtpUnlessRecent(i: { userId: string; purpose: 'signup' | 'reset'; codeHash: string; expiresAt: Date }, cooldownSeconds: number) {
    return this.prisma.$transaction(async (tx: any) => {
      // Serialize per account and purpose: concurrent resends queue here, so the cooldown check and the insert are one step.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, `${i.userId}:${i.purpose}`);
      const recent: Array<{ n: number }> = await tx.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM email_otps WHERE user_id = $1::uuid AND purpose = $2 AND created_at > now() - make_interval(secs => $3::int)`, i.userId, i.purpose, cooldownSeconds);
      if ((recent[0]?.n ?? 0) > 0) return false;
      await tx.$executeRawUnsafe(`DELETE FROM email_otps WHERE user_id = $1::uuid AND purpose = $2 AND consumed_at IS NULL`, i.userId, i.purpose);
      await tx.$executeRawUnsafe(`INSERT INTO email_otps (user_id, purpose, code_hash, expires_at) VALUES ($1::uuid, $2, $3, $4)`, i.userId, i.purpose, i.codeHash, i.expiresAt);
      return true;
    });
  }

  async discardOtp(userId: string, purpose: 'signup' | 'reset') {
    await this.prisma.$executeRawUnsafe(`DELETE FROM email_otps WHERE user_id = $1::uuid AND purpose = $2 AND consumed_at IS NULL`, userId, purpose);
  }

  async checkOtp(userId: string, purpose: 'signup' | 'reset', candidateHash: string, maxAttempts: number) {
    return this.prisma.$transaction(async (tx: any) => {
      const rows: Array<{ id: string; code_hash: string; attempts: number }> = await tx.$queryRawUnsafe(
        `SELECT id::text AS id, code_hash, attempts FROM email_otps
          WHERE user_id = $1::uuid AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, userId, purpose);
      const o = rows[0];
      if (!o || o.attempts >= maxAttempts) return false;
      const a = Buffer.from(o.code_hash), b = Buffer.from(candidateHash);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        await tx.$executeRawUnsafe(`UPDATE email_otps SET consumed_at = now() WHERE id = $1::uuid`, o.id);
        return true;
      }
      await tx.$executeRawUnsafe(`UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1::uuid`, o.id);
      return false;
    });
  }

  async markVerified(userId: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1::uuid`, userId);
  }

  // A reset link proves control of the mailbox, so it also verifies the address.
  async setPassword(userId: string, passwordHash: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE users SET password_hash = $2, email_verified_at = COALESCE(email_verified_at, now()), session_version = session_version + 1 WHERE id = $1::uuid`, userId, passwordHash);
  }

  async claimByProvider(email: string) {
    const rows: Array<{ id: string }> = await this.prisma.$queryRawUnsafe(
      `UPDATE users SET email_verified_at = now(), password_hash = NULL, session_version = session_version + 1
        WHERE email = $1 AND email_verified_at IS NULL RETURNING id::text AS id`, email);
    if (rows[0]) await this.audit('user.claimed_by_provider', rows[0].id);
  }

  async audit(action: string, userId: string | null) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (workspace_id, actor_user_id, action, target) SELECT workspace_id, id, $2, id::text FROM users WHERE id = $1::uuid`, userId, action);
  }
}
