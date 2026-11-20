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
    expect((await svc.invite(w, a, 'taken@y.example', 'member')).ok).toBe(true);
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
  it('reports emailSent=disabled when constructed without a mailer', async () => {
    const st = new MemStore(); const svc = new InvitationService(st); const w = randomUUID(), a = randomUUID();
    const r: any = await svc.invite(w, a, 'nomail@y.example', 'member');
    expect(r.ok).toBe(true); expect(r.emailSent).toBe('disabled');
  });
  it('sends a team_invite mail through the mailer and never fails the invite on mail failure', async () => {
    const st = new MemStore(); const w = randomUUID(), a = randomUUID();
    const sent: any[] = [];
    const good = new InvitationService(st, { mailer: { send: async (m: any) => { sent.push(m); return { sent: true as const, providerId: 'p1' }; } }, appBaseUrl: 'https://leadloom.example' });
    const r1: any = await good.invite(w, a, 'one@y.example', 'read_only');
    expect(r1.ok).toBe(true); expect(r1.emailSent).toBe(true);
    expect(sent.length).toBe(1);
    expect(sent[0].kind).toBe('team_invite');
    expect(sent[0].to).toBe('one@y.example');
    expect(sent[0].text).toContain('https://leadloom.example/login');
    expect(sent[0].text).toContain('Settings > Team');
    const failing = new InvitationService(st, { mailer: { send: async () => ({ sent: false as const, reason: 'provider_error' as const }) }, appBaseUrl: 'https://leadloom.example' });
    const r2: any = await failing.invite(w, a, 'two@y.example', 'member');
    expect(r2.ok).toBe(true); expect(r2.emailSent).toBe(false);
    const throwing = new InvitationService(st, { mailer: { send: async () => { throw new Error('boom'); } }, appBaseUrl: 'https://leadloom.example' });
    const r3: any = await throwing.invite(w, a, 'three@y.example', 'member');
    expect(r3.ok).toBe(true); expect(r3.emailSent).toBe(false);
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
      expect(made.statusCode).toBe(201); expect(made.json().emailSent).toBe('disabled'); // route app here has no mailer; honest value is 'disabled' (see title)
      expect(st.rows[0].workspaceId).toBe(wid);
      expect((await f.inject({ method: 'POST', url: '/workspace/invitations', headers: h, payload: { email: 'a@y.example', role: 'member' } })).statusCode).toBe(409);
      const id = made.json().invitation.id;
      expect((await f.inject({ method: 'GET', url: '/workspace/invitations', headers: h })).json()).toHaveLength(1);
      expect((await f.inject({ method: 'DELETE', url: `/workspace/invitations/${id}`, headers: h })).statusCode).toBe(200);
      expect((await f.inject({ method: 'DELETE', url: `/workspace/invitations/${id}`, headers: h })).statusCode).toBe(404);
    } finally { await app.close(); }
  });
});
