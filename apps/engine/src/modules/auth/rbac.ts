import type { SessionClaims } from './session';

/**
 * Workspace RBAC boundary per docs/prd.md (users.role: admin | member | read_only).
 * Hierarchy: admin > member > read_only. Write operations require at least
 * `member`; user/administration routes require `admin`.
 */
export const ROLES = ['read_only', 'member', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const rank: Record<Role, number> = { read_only: 1, member: 2, admin: 3 };

export function hasRole(claims: Pick<SessionClaims, 'role'>, required: Role): boolean {
  return rank[claims.role] >= rank[required];
}

/** Write (mutating) routes require at least member. */
export function canWrite(claims: Pick<SessionClaims, 'role'>): boolean {
  return hasRole(claims, 'member');
}

/** Administrative routes (user management, workspace settings) require admin. */
export function isAdmin(claims: Pick<SessionClaims, 'role'>): boolean {
  return hasRole(claims, 'admin');
}
