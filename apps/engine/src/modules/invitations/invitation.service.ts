import type { Role } from '../auth/rbac';

export const INVITE_ROLES: readonly Role[] = ['read_only', 'member', 'admin'];
export const INVITE_TTL_DAYS = 7;
export const MAX_OPEN_INVITES = 25;
export const MAX_INVITES_PER_DAY = 20;

export interface InvitationRow { id: string; email: string; role: Role; createdAt: Date; expiresAt: Date; status: 'pending' | 'expired' | 'accepted' | 'revoked' }

export type InviteResult =
  | { ok: true; invitation: InvitationRow }
  | { ok: false; reason: 'invalid_email' | 'invalid_role' | 'already_member' | 'already_invited' | 'limit_reached' };

/** Persistence port. Every method is scoped by workspaceId; nothing accepts a workspace from the caller's body. */
export interface InvitationStore {
  accountExists(email: string): Promise<boolean>;
  countOpen(workspaceId: string): Promise<number>;
  countCreatedSince(workspaceId: string, since: Date): Promise<number>;
  /** Returns null when an open invitation for this workspace and address already exists. */
  create(i: { workspaceId: string; email: string; role: Role; invitedBy: string; expiresAt: Date }): Promise<InvitationRow | null>;
  list(workspaceId: string): Promise<InvitationRow[]>;
  /** True only when an open invitation in THIS workspace was revoked. */
  revoke(workspaceId: string, id: string, actorUserId: string): Promise<boolean>;
}

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
export const normalizeInviteEmail = (e: string) => e.trim().toLowerCase();

/**
 * Admin-only by the caller (route checks isAdmin). The service has no way to pick a
 * workspace other than the one the session carries, and it never sends mail.
 */
export class InvitationService {
  constructor(private readonly store: InvitationStore, private readonly now: () => Date = () => new Date()) {}

  async invite(workspaceId: string, actorUserId: string, emailIn: string, role: string): Promise<InviteResult> {
    const email = normalizeInviteEmail(emailIn);
    if (!EMAIL.test(email) || email.length > 320) return { ok: false, reason: 'invalid_email' };
    if (!INVITE_ROLES.includes(role as Role)) return { ok: false, reason: 'invalid_role' };
    const now = this.now();
    if ((await this.store.countOpen(workspaceId)) >= MAX_OPEN_INVITES) return { ok: false, reason: 'limit_reached' };
    if ((await this.store.countCreatedSince(workspaceId, new Date(now.getTime() - 86_400_000))) >= MAX_INVITES_PER_DAY) return { ok: false, reason: 'limit_reached' };
    if (await this.store.accountExists(email)) return { ok: false, reason: 'already_member' };
    const made = await this.store.create({ workspaceId, email, role: role as Role, invitedBy: actorUserId, expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000) });
    return made ? { ok: true, invitation: made } : { ok: false, reason: 'already_invited' };
  }

  list(workspaceId: string) { return this.store.list(workspaceId); }
  revoke(workspaceId: string, actorUserId: string, id: string) { return this.store.revoke(workspaceId, id, actorUserId); }
}
