import { describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApplication } from '../../../main';
import { issueSession } from '../../auth/issuer';
import { InvitationService, MAX_INVITES_PER_DAY, type InvitationRow, type InvitationStore } from '../invitation.service';

class MemStore implements InvitationStore {
  rows: Array<InvitationRow & { workspaceId: string }> = []; accounts = new Set<string>();
  async accountExists(e: string) { return this.accounts.has(e); }
  async countOpen(w: string) { return this.rows.filter((r) => r.workspaceId === w && r.status === 'pending').length; }
  async countCreatedSince(w: string, since: Date) { return this.rows.filter((r) => r.workspaceId === w && r.createdAt > since).length; }
  async create(i: any) {
    if (this.rows.some((r) => r.workspaceId === i.workspaceId && r.email === i.email && r.status === 'pending')) return null;
    const r = { id: randomUUID(), workspaceId: i.workspaceId, email: i.email, role: i.role, createdAt: new Date(), expiresAt: i.expiresAt, status: 'pending' as const };
    this.rows.push(r); return r;
  }
  owners = new Set<string>();
  async isWorkspaceOwner(_w: string, u: string) { return this.owners.has(u); }
  async listForUser() { return []; }
  async accept() { return { ok: false as const, reason: 'not_found' as const }; }
  async list(w: string) { return this.rows.filter((r) => r.workspaceId === w); }
  async revoke(w: string, id: string) { const r = this.rows.find((x) => x.id === id && x.workspaceId === w && x.status === 'pending'); if (!r) return false; r.status = 'revoked'; return true; }
}

describe('InvitationService', () => {
  it('normalizes the address, validates role and email, and blocks existing accounts and duplicates', async () => {
    const st = new MemStore(); const svc = new InvitationService(st); const w = randomUUID(), a = randomUUID();
    expect(await svc.invite(w, a, 'not-an-email', 'member')).toEqual({ ok: false, reason: 'invalid_email' });
    expect(await svc.invite(w, a, 'x@y.example', 'owner')).toEqual({ ok: false, reason: 'invalid_role' });
    const ok = await svc.invite(w, a, '  New@Y.Example ', 'read_only');
    expect(ok.ok && ok.invitation.email).toBe('new@y.example');
    expect(await svc.invite(w, a, 'new@y.example', 'member')).toEqual({ ok: false, reason: 'already_invited' });
    st.accounts.add('taken@y.example');
    expect(await svc.invite(w, a, 'taken@y.example', 'member')).toEqual({ ok: false, reason: 'account_exists' });
  });
  it('only the workspace owner may invite an admin', async () => {
    const st = new MemStore(); const svc = new InvitationService(st); const w = randomUUID(), owner = randomUUID(), admin = randomUUID(); st.owners.add(owner);
    expect(await svc.invite(w, admin, 'a@y.example', 'admin')).toEqual({ ok: false, reason: 'owner_only' });
    expect((await svc.invite(w, admin, 'a@y.example', 'member')).ok).toBe(true);
    expect((await svc.invite(w, owner, 'b@y.example', 'admin')).ok).toBe(true);
  });
  it('caps invitations per workspace per day', async () => {
    const st = new MemStore(); const svc = new InvitationService(st); const w = randomUUID(), a = randomUUID();
    for (let i = 0; i < MAX_INVITES_PER_DAY; i++) expect((await svc.invite(w, a, `u${i}@y.example`, 'member')).ok).toBe(true);
    expect(await svc.invite(w, a, 'extra@y.example', 'member')).toEqual({ ok: false, reason: 'limit_reached' });
  });
  it('revokes only inside its own workspace', async () => {
    const st = new MemStore(); const svc = new InvitationService(st); const w1 = randomUUID(), w2 = randomUUID(), a = randomUUID();
    const r: any = await svc.invite(w1, a, 'a@y.example', 'member');
    expect(await svc.revoke(w2, a, r.invitation.id)).toBe(false);
    expect(await svc.revoke(w1, a, r.invitation.id)).toBe(true);
  });
});

describe('invitation routes', () => {
  const key = randomBytes(32);
  const mk = async (role: 'admin' | 'member' | 'read_only') => {
    const st = new MemStore(); const wid = randomUUID(); const uid = randomUUID();
    const app = await createApplication({
      credentials: { save: async () => ({}) as any, list: async () => [], delete: async () => false }, outbound: { enqueue: async () => 'x', suppress: async () => {} } as any,
      sessionKey: key, invitations: new InvitationService(st),
    } as any);
    const { token } = issueSession({ userId: uid, workspaceId: wid, role }, key, 600);
    return { app, st, wid, h: { authorization: `Bearer ${token}` } };
  };
  it('requires a session, and an admin role, for every route', async () => {
    const { app, h } = await mk('member');
    const f = app.getHttpAdapter().getInstance();
    try {
      expect((await f.inject({ method: 'GET', url: '/workspace/invitations' })).statusCode).toBe(401);
      expect((await f.inject({ method: 'GET', url: '/workspace/invitations', headers: h })).statusCode).toBe(403);
      expect((await f.inject({ method: 'POST', url: '/workspace/invitations', headers: h, payload: { email: 'a@y.example', role: 'member' } })).statusCode).toBe(403);
      expect((await f.inject({ method: 'DELETE', url: `/workspace/invitations/${randomUUID()}`, headers: h })).statusCode).toBe(403);
    } finally { await app.close(); }
  });
  it('admin creates, lists and revokes; workspace comes from the session and the body cannot supply one; no mail is sent', async () => {
    const { app, h, st, wid } = await mk('admin');
    const f = app.getHttpAdapter().getInstance();
    try {
      const spoof = await f.inject({ method: 'POST', url: '/workspace/invitations', headers: h, payload: { email: 'a@y.example', role: 'member', workspaceId: randomUUID() } });
      expect(spoof.statusCode).toBe(400);
      const bad = await f.inject({ method: 'POST', url: '/workspace/invitations', headers: h, payload: { email: 'a@y.example', role: 'owner' } });
      expect(bad.statusCode).toBe(400);
      const made = await f.inject({ method: 'POST', url: '/workspace/invitations', headers: h, payload: { email: 'a@y.example', role: 'member' } });
      expect(made.statusCode).toBe(201); expect(made.json().emailSent).toBe(false);
      expect(st.rows[0].workspaceId).toBe(wid);
      expect((await f.inject({ method: 'POST', url: '/workspace/invitations', headers: h, payload: { email: 'a@y.example', role: 'member' } })).statusCode).toBe(409);
      const id = made.json().invitation.id;
      expect((await f.inject({ method: 'GET', url: '/workspace/invitations', headers: h })).json()).toHaveLength(1);
      expect((await f.inject({ method: 'DELETE', url: `/workspace/invitations/${id}`, headers: h })).statusCode).toBe(200);
      expect((await f.inject({ method: 'DELETE', url: `/workspace/invitations/${id}`, headers: h })).statusCode).toBe(404);
    } finally { await app.close(); }
  });
});
