import { providerSessionAfterCutoff } from './provider-session-cutoff';
/**
 * Final access check applied to EVERY authenticated request, whichever token
 * type proved identity (engine session or NextAuth bridge). A valid signature
 * is not enough: a suspended user or a deactivated workspace must lose access
 * immediately, even while its token has not expired.
 */
export interface AccessGuard {
  /** Session proof identifies engine tokens or original provider sign-in time. For engine sessions: a token whose version differs from the user's current session_version (bumped on password reset) is refused. Exact match, no clock involved. */
  isActive(userId: string, workspaceId: string, session?: { ver?: number; kind?: 'engine' | 'provider'; authTime?: number }): Promise<boolean>;
}

export class PrismaAccessGuard implements AccessGuard {
  constructor(private readonly prisma: any) {}
  async isActive(userId: string, workspaceId: string, session?: { ver?: number; kind?: 'engine' | 'provider'; authTime?: number }): Promise<boolean> {
    const rows: Array<{ ok: boolean; ver: number; cutoff: Date | null }> = await this.prisma.$queryRawUnsafe(
      `SELECT (w.is_active AND u.disabled_at IS NULL) AS ok, u.session_version AS ver, u.credentials_revoked_at AS cutoff
         FROM users u JOIN workspaces w ON w.id = u.workspace_id
        WHERE u.id = $1::uuid AND u.workspace_id = $2::uuid`, userId, workspaceId);
    if (rows[0]?.ok !== true) return false; // unknown user/workspace pair = no access
    if (session?.kind === 'provider') return providerSessionAfterCutoff(session, rows[0].cutoff);
    if (session && (session.ver ?? 0) !== rows[0].ver) return false; // credentials changed since issue
    return true;
  }
}
