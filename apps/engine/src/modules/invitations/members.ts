import type { Role } from '../auth/rbac';

export interface MemberRow { id: string; email: string; name: string | null; role: Role; verified: boolean; active: boolean; createdAt: Date; isOwner?: boolean }
export type MemberChange = { ok: true } | { ok: false; reason: 'not_found' | 'last_admin' | 'self' | 'invalid_role' | 'owner_protected' | 'owner_only' };

/** Persistence port. Every method is scoped by workspaceId; a target outside it is simply "not found". */
export interface MemberStore {
  list(workspaceId: string): Promise<MemberRow[]>;
  /** Atomic: locks the workspace's admins, applies the change, bumps the target's session_version, writes audit. */
  setRole(workspaceId: string, actorId: string, targetId: string, role: Role): Promise<MemberChange>;
  /** Suspends (non-destructive: disabled_at, session_version bump, audit). Data is never deleted. */
  suspend(workspaceId: string, actorId: string, targetId: string): Promise<MemberChange>;
}

const ROLES: readonly string[] = ['read_only', 'member', 'admin'];

export class MemberService {
  constructor(private readonly store: MemberStore) {}
  list(workspaceId: string) { return this.store.list(workspaceId); }
  async setRole(workspaceId: string, actorId: string, targetId: string, role: string): Promise<MemberChange> {
    if (!ROLES.includes(role)) return { ok: false, reason: 'invalid_role' };
    return this.store.setRole(workspaceId, actorId, targetId, role as Role);
  }
  async remove(workspaceId: string, actorId: string, targetId: string): Promise<MemberChange> {
    if (actorId === targetId) return { ok: false, reason: 'self' };
    return this.store.suspend(workspaceId, actorId, targetId);
  }
}
