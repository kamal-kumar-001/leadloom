/**
 * Final access check applied to EVERY authenticated request, whichever token
 * type proved identity (engine session or NextAuth bridge). A valid signature
 * is not enough: a suspended user or a deactivated workspace must lose access
 * immediately, even while its token has not expired.
 */
export interface AccessGuard {
  /** `session` is passed only for engine-issued sessions: a token issued before the user's last credential change is refused. */
  isActive(userId: string, workspaceId: string, session?: { iat?: number }): Promise<boolean>;
}

export class PrismaAccessGuard implements AccessGuard {
  constructor(private readonly prisma: any) {}
  async isActive(userId: string, workspaceId: string, session?: { iat?: number }): Promise<boolean> {
    const rows: Array<{ ok: boolean; valid_after: Date | null }> = await this.prisma.$queryRawUnsafe(
      `SELECT (w.is_active AND u.disabled_at IS NULL) AS ok, u.sessions_valid_after AS valid_after
         FROM users u JOIN workspaces w ON w.id = u.workspace_id
        WHERE u.id = $1::uuid AND u.workspace_id = $2::uuid`, userId, workspaceId);
    if (rows[0]?.ok !== true) return false; // unknown user/workspace pair = no access
    const va = rows[0].valid_after;
    if (session && va) {
      // Password changed or reset since this token was issued: refuse it. Seconds resolution.
      if (typeof session.iat !== 'number' || session.iat < Math.floor(new Date(va).getTime() / 1000)) return false;
    }
    return true;
  }
}
