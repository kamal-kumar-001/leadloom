/**
 * Final access check applied to EVERY authenticated request, whichever token
 * type proved identity (engine session or NextAuth bridge). A valid signature
 * is not enough: a suspended user or a deactivated workspace must lose access
 * immediately, even while its token has not expired.
 */
export interface AccessGuard {
  isActive(userId: string, workspaceId: string): Promise<boolean>;
}

export class PrismaAccessGuard implements AccessGuard {
  constructor(private readonly prisma: any) {}
  async isActive(userId: string, workspaceId: string): Promise<boolean> {
    const rows: Array<{ ok: boolean }> = await this.prisma.$queryRawUnsafe(
      `SELECT (w.is_active AND u.disabled_at IS NULL) AS ok
         FROM users u JOIN workspaces w ON w.id = u.workspace_id
        WHERE u.id = $1::uuid AND u.workspace_id = $2::uuid`, userId, workspaceId);
    return rows[0]?.ok === true; // unknown user/workspace pair = no access
  }
}
