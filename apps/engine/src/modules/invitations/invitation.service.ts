import type { Role } from '../auth/rbac';

export const INVITE_ROLES: readonly Role[] = ['read_only', 'member', 'admin'];
export const INVITE_TTL_DAYS = 7;
export const MAX_OPEN_INVITES = 25;
export const MAX_INVITES_PER_DAY = 20;

export interface InvitationRow { id: string; email: string; role: Role; createdAt: Date; expiresAt: Date; status: 'pending' | 'expired' | 'accepted' | 'revoked' }

export interface MyInvitation { id: string; role: Role; expiresAt: Date; workspaceName: string; inviterName: string | null }
export type AcceptResult =
  | { ok: true; workspaceId: string; role: Role }
  | { ok: false; reason: 'not_found' | 'unverified' | 'already_member' | 'has_workspace_data' };

export type InviteResult =
  | { ok: true; invitation: InvitationRow }
  | { ok: false; reason: 'invalid_email' | 'invalid_role' | 'account_exists' | 'already_invited' | 'limit_reached' | 'owner_only' };

/** Persistence port. Every method is scoped by workspaceId; nothing accepts a workspace from the caller's body. */
export interface InvitationStore {
  accountExists(email: string): Promise<boolean>;
  isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean>;
  listForUser(userId: string): Promise<MyInvitation[]>;
  accept(userId: string, invitationId: string): Promise<AcceptResult>;
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
 * Admin-only by the caller (route checks isAdmin); only the workspace owner may invite an admin.
 * The service cannot pick a workspace other than the session's, never sends mail, and an invitation
 * does nothing until the invited user explicitly accepts it while signed in with a verified identity.
 */
export class InvitationService {
  constructor(private readonly store: InvitationStore, private readonly now: () => Date = () => new Date()) {}

  async invite(workspaceId: string, actorUserId: string, emailIn: string, role: string): Promise<InviteResult> {
    const email = normalizeInviteEmail(emailIn);
    if (!EMAIL.test(email) || email.length > 320) return { ok: false, reason: 'invalid_email' };
    if (!INVITE_ROLES.includes(role as Role)) return { ok: false, reason: 'invalid_role' };
    if (role === 'admin' && !(await this.store.isWorkspaceOwner(workspaceId, actorUserId))) return { ok: false, reason: 'owner_only' };
    const now = this.now();
    if ((await this.store.countOpen(workspaceId)) >= MAX_OPEN_INVITES) return { ok: false, reason: 'limit_reached' };
    if ((await this.store.countCreatedSince(workspaceId, new Date(now.getTime() - 86_400_000))) >= MAX_INVITES_PER_DAY) return { ok: false, reason: 'limit_reached' };
    // An address that already has an account may be invited: nothing moves until that user accepts while
    // signed in with a verified identity, and accept refuses unless their own workspace is pristine.
    const made = await this.store.create({ workspaceId, email, role: role as Role, invitedBy: actorUserId, expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000) });
    return made ? { ok: true, invitation: made } : { ok: false, reason: 'already_invited' };
  }

  mine(userId: string) { return this.store.listForUser(userId); }
  accept(userId: string, invitationId: string) { return this.store.accept(userId, invitationId); }
  list(workspaceId: string) { return this.store.list(workspaceId); }
  revoke(workspaceId: string, actorUserId: string, id: string) { return this.store.revoke(workspaceId, id, actorUserId); }
}
