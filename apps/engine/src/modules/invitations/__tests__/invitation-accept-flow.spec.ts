import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Role } from '../../auth/rbac';
import {
  InvitationService,
  type AcceptResult,
  type InvitationRow,
  type InvitationStore,
  type MyInvitation,
} from '../invitation.service';

interface UserRecord {
  id: string;
  email: string;
  workspaceId: string;
  role: Role;
  verified: boolean;
  active: boolean;
  sessionVersion: number;
  hasData?: boolean;
}

interface WorkspaceRecord {
  id: string;
  name: string;
  isActive: boolean;
  ownerUserId: string;
}

class IsolatedInMemoryInvitationStore implements InvitationStore {
  invitations: Map<string, InvitationRow & { workspaceId: string; invitedBy: string }> = new Map();
  users: Map<string, UserRecord> = new Map();
  workspaces: Map<string, WorkspaceRecord> = new Map();

  async accountExists(email: string): Promise<boolean> {
    return Array.from(this.users.values()).some((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  async isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
    const ws = this.workspaces.get(workspaceId);
    return ws?.ownerUserId === userId;
  }

  async countOpen(workspaceId: string): Promise<number> {
    return Array.from(this.invitations.values()).filter(
      (i) => i.workspaceId === workspaceId && i.status === 'pending'
    ).length;
  }

  async countCreatedSince(workspaceId: string, since: Date): Promise<number> {
    return Array.from(this.invitations.values()).filter(
      (i) => i.workspaceId === workspaceId && i.createdAt > since
    ).length;
  }

  async create(i: {
    workspaceId: string;
    email: string;
    role: Role;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<InvitationRow | null> {
    const norm = i.email.trim().toLowerCase();
    const existing = Array.from(this.invitations.values()).find(
      (inv) => inv.workspaceId === i.workspaceId && inv.email === norm && inv.status === 'pending'
    );
    if (existing) return null;

    const id = randomUUID();
    const row: InvitationRow & { workspaceId: string; invitedBy: string } = {
      id,
      workspaceId: i.workspaceId,
      email: norm,
      role: i.role,
      invitedBy: i.invitedBy,
      createdAt: new Date(),
      expiresAt: i.expiresAt,
      status: 'pending',
    };
    this.invitations.set(id, row);
    return row;
  }

  async list(workspaceId: string): Promise<InvitationRow[]> {
    return Array.from(this.invitations.values()).filter((i) => i.workspaceId === workspaceId);
  }

  async listForUser(userId: string): Promise<MyInvitation[]> {
    const user = this.users.get(userId);
    if (!user || !user.verified || !user.active) return [];
    return Array.from(this.invitations.values())
      .filter((i) => i.email === user.email.toLowerCase() && i.status === 'pending' && i.expiresAt > new Date())
      .map((i) => ({
        id: i.id,
        role: i.role,
        expiresAt: i.expiresAt,
        workspaceName: this.workspaces.get(i.workspaceId)?.name || 'Target Workspace',
        inviterName: 'Inviter',
      }));
  }

  async revoke(workspaceId: string, id: string, _actorUserId: string): Promise<boolean> {
    const inv = this.invitations.get(id);
    if (!inv || inv.workspaceId !== workspaceId || inv.status !== 'pending') return false;
    inv.status = 'revoked';
    return true;
  }

  async accept(userId: string, invitationId: string): Promise<AcceptResult> {
    const user = this.users.get(userId);
    if (!user || !user.active) return { ok: false, reason: 'not_found' };
    if (!user.verified) return { ok: false, reason: 'unverified' };

    const inv = this.invitations.get(invitationId);
    if (!inv) return { ok: false, reason: 'not_found' };

    // Wrong email guard: User email must strictly match invitation email
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
      return { ok: false, reason: 'not_found' };
    }

    // Expiry guard
    if (inv.expiresAt <= new Date() || inv.status === 'expired') {
      inv.status = 'expired';
      return { ok: false, reason: 'not_found' };
    }

    // Reuse & revoke guard
    if (inv.status !== 'pending') {
      return { ok: false, reason: 'not_found' };
    }

    // Tenant guard: already member
    if (inv.workspaceId === user.workspaceId) {
      return { ok: false, reason: 'already_member' };
    }

    // Workspace data safety guard: user must be sole owner of a pristine empty workspace
    if (user.hasData) {
      return { ok: false, reason: 'has_workspace_data' };
    }

    // Transition:
    inv.status = 'accepted';
    const oldWorkspaceId = user.workspaceId;
    user.workspaceId = inv.workspaceId;
    user.role = inv.role;
    user.sessionVersion += 1;

    // Deactivate previous pristine workspace
    const oldWs = this.workspaces.get(oldWorkspaceId);
    if (oldWs) {
      oldWs.isActive = false;
    }

    return { ok: true, workspaceId: inv.workspaceId, role: inv.role };
  }
}

describe('Isolated Invitation Accept, Expiry, Reuse & Tenant RBAC Specification', () => {
  it('successfully accepts valid invitation, transfers tenant, deactivates old workspace, and bumps session_version', async () => {
    const store = new IsolatedInMemoryInvitationStore();
    const svc = new InvitationService(store);

    const targetWsId = randomUUID();
    const inviterId = randomUUID();
    store.workspaces.set(targetWsId, {
      id: targetWsId,
      name: 'Acme Enterprise',
      isActive: true,
      ownerUserId: inviterId,
    });

    const inviteeEmail = 'alice@example.com';
    const createRes = await svc.invite(targetWsId, inviterId, inviteeEmail, 'member');
    expect(createRes.ok).toBe(true);
    const inviteId = (createRes as any).invitation.id;

    // Pristine user signs up in their own empty workspace
    const aliceUserId = randomUUID();
    const aliceInitialWs = randomUUID();
    store.workspaces.set(aliceInitialWs, {
      id: aliceInitialWs,
      name: "Alice's Workspace",
      isActive: true,
      ownerUserId: aliceUserId,
    });
    store.users.set(aliceUserId, {
      id: aliceUserId,
      email: inviteeEmail,
      workspaceId: aliceInitialWs,
      role: 'admin',
      verified: true,
      active: true,
      sessionVersion: 1,
      hasData: false,
    });

    // Accept invitation
    const acceptRes = await svc.accept(aliceUserId, inviteId);
    expect(acceptRes).toEqual({
      ok: true,
      workspaceId: targetWsId,
      role: 'member',
    });

    // Verify user moved to target workspace and session version bumped
    const updatedAlice = store.users.get(aliceUserId)!;
    expect(updatedAlice.workspaceId).toBe(targetWsId);
    expect(updatedAlice.role).toBe('member');
    expect(updatedAlice.sessionVersion).toBe(2);

    // Verify initial empty workspace was deactivated (not deleted)
    expect(store.workspaces.get(aliceInitialWs)?.isActive).toBe(false);
  });

  it('rejects reuse: an already accepted invitation cannot be accepted a second time', async () => {
    const store = new IsolatedInMemoryInvitationStore();
    const svc = new InvitationService(store);

    const targetWsId = randomUUID();
    const inviterId = randomUUID();
    store.workspaces.set(targetWsId, { id: targetWsId, name: 'Acme', isActive: true, ownerUserId: inviterId });

    const createRes = await svc.invite(targetWsId, inviterId, 'bob@example.com', 'read_only');
    const inviteId = (createRes as any).invitation.id;

    const bobId = randomUUID();
    const bobWs = randomUUID();
    store.workspaces.set(bobWs, { id: bobWs, name: 'Bob WS', isActive: true, ownerUserId: bobId });
    store.users.set(bobId, {
      id: bobId,
      email: 'bob@example.com',
      workspaceId: bobWs,
      role: 'admin',
      verified: true,
      active: true,
      sessionVersion: 0,
      hasData: false,
    });

    // First accept succeeds
    expect((await svc.accept(bobId, inviteId)).ok).toBe(true);

    // Second accept fails closed
    const secondTry = await svc.accept(bobId, inviteId);
    expect(secondTry).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects expired invitations', async () => {
    const store = new IsolatedInMemoryInvitationStore();
    const svc = new InvitationService(store);

    const targetWsId = randomUUID();
    const inviterId = randomUUID();
    store.workspaces.set(targetWsId, { id: targetWsId, name: 'Acme', isActive: true, ownerUserId: inviterId });

    // Create an invitation that expired 1 hour ago
    const expiredInviteId = randomUUID();
    store.invitations.set(expiredInviteId, {
      id: expiredInviteId,
      workspaceId: targetWsId,
      email: 'charlie@example.com',
      role: 'member',
      invitedBy: inviterId,
      createdAt: new Date(Date.now() - 86400000 * 8),
      expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      status: 'pending',
    });

    const charlieId = randomUUID();
    const charlieWs = randomUUID();
    store.users.set(charlieId, {
      id: charlieId,
      email: 'charlie@example.com',
      workspaceId: charlieWs,
      role: 'admin',
      verified: true,
      active: true,
      sessionVersion: 0,
    });

    const res = await svc.accept(charlieId, expiredInviteId);
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });

  it('wrong-email guard: user B cannot accept an invitation issued to user A', async () => {
    const store = new IsolatedInMemoryInvitationStore();
    const svc = new InvitationService(store);

    const targetWsId = randomUUID();
    const inviterId = randomUUID();
    store.workspaces.set(targetWsId, { id: targetWsId, name: 'Acme', isActive: true, ownerUserId: inviterId });

    const createRes = await svc.invite(targetWsId, inviterId, 'intended@example.com', 'member');
    const inviteId = (createRes as any).invitation.id;

    // Attacker signs in with attacker@example.com
    const attackerId = randomUUID();
    const attackerWs = randomUUID();
    store.users.set(attackerId, {
      id: attackerId,
      email: 'attacker@example.com',
      workspaceId: attackerWs,
      role: 'admin',
      verified: true,
      active: true,
      sessionVersion: 0,
    });

    const res = await svc.accept(attackerId, inviteId);
    expect(res).toEqual({ ok: false, reason: 'not_found' });
    expect(store.users.get(attackerId)?.workspaceId).toBe(attackerWs);
  });

  it('tenant isolation guard: cannot accept invitation if already a member of the target workspace', async () => {
    const store = new IsolatedInMemoryInvitationStore();
    const svc = new InvitationService(store);

    const targetWsId = randomUUID();
    const inviterId = randomUUID();
    store.workspaces.set(targetWsId, { id: targetWsId, name: 'Acme', isActive: true, ownerUserId: inviterId });

    const createRes = await svc.invite(targetWsId, inviterId, 'existing@example.com', 'admin');
    const inviteId = (createRes as any).invitation.id;

    const existingUserId = randomUUID();
    store.users.set(existingUserId, {
      id: existingUserId,
      email: 'existing@example.com',
      workspaceId: targetWsId, // Already in target workspace
      role: 'member',
      verified: true,
      active: true,
      sessionVersion: 0,
    });

    const res = await svc.accept(existingUserId, inviteId);
    expect(res).toEqual({ ok: false, reason: 'already_member' });
  });

  it('unverified guard: unverified accounts cannot see or accept invitations', async () => {
    const store = new IsolatedInMemoryInvitationStore();
    const svc = new InvitationService(store);

    const targetWsId = randomUUID();
    const inviterId = randomUUID();
    store.workspaces.set(targetWsId, { id: targetWsId, name: 'Acme', isActive: true, ownerUserId: inviterId });

    const createRes = await svc.invite(targetWsId, inviterId, 'unverified@example.com', 'member');
    const inviteId = (createRes as any).invitation.id;

    const unverifiedId = randomUUID();
    store.users.set(unverifiedId, {
      id: unverifiedId,
      email: 'unverified@example.com',
      workspaceId: randomUUID(),
      role: 'admin',
      verified: false, // NOT verified
      active: true,
      sessionVersion: 0,
    });

    // listForUser returns empty
    expect(await svc.mine(unverifiedId)).toHaveLength(0);

    // accept returns unverified
    const res = await svc.accept(unverifiedId, inviteId);
    expect(res).toEqual({ ok: false, reason: 'unverified' });
  });

  it('data safety guard: accounts with existing workspace data cannot accept (no data loss)', async () => {
    const store = new IsolatedInMemoryInvitationStore();
    const svc = new InvitationService(store);

    const targetWsId = randomUUID();
    const inviterId = randomUUID();
    store.workspaces.set(targetWsId, { id: targetWsId, name: 'Acme', isActive: true, ownerUserId: inviterId });

    const createRes = await svc.invite(targetWsId, inviterId, 'busy@example.com', 'member');
    const inviteId = (createRes as any).invitation.id;

    const busyUserId = randomUUID();
    const busyWsId = randomUUID();
    store.users.set(busyUserId, {
      id: busyUserId,
      email: 'busy@example.com',
      workspaceId: busyWsId,
      role: 'admin',
      verified: true,
      active: true,
      sessionVersion: 0,
      hasData: true, // Has existing tables/leads/campaigns
    });

    const res = await svc.accept(busyUserId, inviteId);
    expect(res).toEqual({ ok: false, reason: 'has_workspace_data' });
    expect(store.users.get(busyUserId)?.workspaceId).toBe(busyWsId);
  });
});
