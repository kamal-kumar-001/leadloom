import type { Role } from './rbac';

/**
 * User directory port: how the login issuer resolves an identity.
 * The Prisma adapter backs it in production; tests use in-memory doubles.
 * Login method is password-based per the schema (users.password_hash);
 * additional methods (OAuth, magic link) plug in behind this port later.
 */
export interface DirectoryUser {
  id: string;
  workspaceId: string;
  email: string;
  passwordHash: string | null;
  role: Role;
}

export interface UserDirectory {
  findByEmail(email: string): Promise<DirectoryUser | null>;
}

const ROLE_SET = new Set(['admin', 'member', 'read_only']);

export class PrismaUserDirectory implements UserDirectory {
  constructor(private readonly prisma: any) {}

  async findByEmail(email: string): Promise<DirectoryUser | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized.length > 320) return null;
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, workspaceId: true, email: true, passwordHash: true, role: true },
    });
    if (!user || !ROLE_SET.has(user.role)) return null;
    return {
      id: user.id,
      workspaceId: user.workspaceId,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role as Role,
    };
  }
}
