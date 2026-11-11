import { fetchAuthMe } from './engine-client';

export type TeamRole = 'read_only' | 'member' | 'admin';

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: TeamRole;
  verified: boolean;
  active: boolean;
  createdAt: string;
}

export type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'revoked';

export interface TeamInvitation {
  id: string;
  email: string;
  role: TeamRole;
  createdAt: string;
  expiresAt: string;
  status: InvitationStatus;
}

export interface MyInvitation {
  id: string;
  role: TeamRole;
  expiresAt: string;
  workspaceName: string;
  inviterName: string | null;
}

export interface InviteCreateResponse {
  invitation?: TeamInvitation;
  emailSent: boolean;
}

export interface AcceptInvitationResponse {
  accepted: boolean;
  role: TeamRole;
  reauthenticate: boolean;
}

export interface TeamApiResult<T> {
  data: T | null;
  ok: boolean;
  unavailable?: boolean;
  code?: string;
  error?: string;
  status?: number;
}

const INVITE_ERROR_MESSAGES: Record<string, string> = {
  invalid_email: 'Please enter a valid email address.',
  invalid_role: 'Please select a valid role (Read-only, Member, or Admin).',
  account_exists: 'An account already exists for this email address. Existing accounts cannot be invited.',
  already_invited: 'An invitation is already pending for this email address.',
  limit_reached: 'Invitation limit reached. Please wait before creating more invitations.',
  owner_only: 'Only the workspace owner may invite an admin.',
  invalid_request: 'Invalid invitation request. Please check the values and try again.',
};

const MEMBER_ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Member was not found.',
  owner_protected: 'The workspace owner cannot be modified or removed.',
  owner_only: 'Only the workspace owner may assign or revoke the admin role.',
  last_admin: 'Cannot modify or remove the last active admin.',
  self: 'You cannot remove yourself from the workspace.',
  invalid_role: 'Invalid role specified.',
};

const ACCEPT_ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Invitation not found, already accepted, or expired.',
  unverified: 'Your email address must be verified before accepting invitations.',
  already_member: 'You are already a member of this workspace.',
  has_workspace_data:
    'Cannot accept invitation because your current workspace already contains data. Accepting is only supported for accounts with no data.',
};

export function mapInviteErrorCode(code?: string): string {
  if (code && INVITE_ERROR_MESSAGES[code]) return INVITE_ERROR_MESSAGES[code];
  return 'Unable to create invitation. Please check the details and try again.';
}

export function mapMemberErrorCode(code?: string): string {
  if (code && MEMBER_ERROR_MESSAGES[code]) return MEMBER_ERROR_MESSAGES[code];
  return 'Unable to update member. Please try again.';
}

export function mapAcceptErrorCode(code?: string): string {
  if (code && ACCEPT_ERROR_MESSAGES[code]) return ACCEPT_ERROR_MESSAGES[code];
  return 'Unable to accept invitation. Please try again.';
}

/**
 * Common fetch helper for same-origin proxy engine routes
 */
async function callEngine<T>(
  path: string,
  options: RequestInit = {}
): Promise<TeamApiResult<T>> {
  try {
    const res = await fetch(`/api/engine${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (res.status === 404) {
      // Feature flag disabled or route not mounted
      return { data: null, ok: false, unavailable: true, status: 404 };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const code = errJson.code as string | undefined;
      return {
        data: null,
        ok: false,
        code,
        error: errJson.error || errJson.message,
        status: res.status,
      };
    }

    const data = (await res.json().catch(() => null)) as T;
    return { data, ok: true, status: res.status };
  } catch (err: unknown) {
    return {
      data: null,
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * Fetch all members of the current workspace (Admin only).
 */
export async function fetchWorkspaceMembers(): Promise<TeamApiResult<TeamMember[]>> {
  return callEngine<TeamMember[]>('/workspace/members');
}

/**
 * Update member role (Admin only; owner-only for admin role changes).
 */
export async function updateWorkspaceMemberRole(
  memberId: string,
  role: TeamRole
): Promise<TeamApiResult<{ updated: boolean }>> {
  return callEngine<{ updated: boolean }>(`/workspace/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/**
 * Suspend/remove member from workspace (Admin only; owner-only for admin members).
 */
export async function removeWorkspaceMember(
  memberId: string
): Promise<TeamApiResult<{ removed: boolean }>> {
  return callEngine<{ removed: boolean }>(`/workspace/members/${memberId}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch all workspace invitations (Admin only).
 */
export async function fetchWorkspaceInvitations(): Promise<TeamApiResult<TeamInvitation[]>> {
  return callEngine<TeamInvitation[]>('/workspace/invitations');
}

/**
 * Create a new workspace invitation (Admin only; owner-only for admin role).
 * Note: No email is sent.
 */
export async function createWorkspaceInvitation(
  email: string,
  role: TeamRole
): Promise<TeamApiResult<InviteCreateResponse>> {
  return callEngine<InviteCreateResponse>('/workspace/invitations', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
  });
}

/**
 * Revoke an open invitation (Admin only).
 */
export async function revokeWorkspaceInvitation(
  invitationId: string
): Promise<TeamApiResult<{ revoked: boolean }>> {
  return callEngine<{ revoked: boolean }>(`/workspace/invitations/${invitationId}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch invitations addressed to the current verified user (/me/invitations).
 * Available for any authenticated role.
 */
export async function fetchMyInvitations(): Promise<TeamApiResult<MyInvitation[]>> {
  return callEngine<MyInvitation[]>('/me/invitations');
}

/**
 * Accept an invitation addressed to the current user.
 * Moves only an empty workspace with no data.
 */
export async function acceptMyInvitation(
  invitationId: string
): Promise<TeamApiResult<AcceptInvitationResponse>> {
  return callEngine<AcceptInvitationResponse>(`/me/invitations/${invitationId}/accept`, {
    method: 'POST',
  });
}

export { fetchAuthMe };
