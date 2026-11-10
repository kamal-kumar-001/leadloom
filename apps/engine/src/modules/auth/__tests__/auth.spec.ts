import { describe, expect, it } from 'vitest';
import { canWrite, hasRole, isAdmin } from '../rbac';
import { hashPassword, verifyPassword } from '../password';
import { issueSession } from '../issuer';
import { verifySession } from '../session';
import { PrismaUserDirectory } from '../user-directory';

const key = Buffer.alloc(32, 7);

describe('rbac', () => {
  it('enforces hierarchy admin > member > read_only', () => {
    expect(hasRole({ role: 'admin' }, 'member')).toBe(true);
    expect(hasRole({ role: 'member' }, 'admin')).toBe(false);
    expect(hasRole({ role: 'read_only' }, 'member')).toBe(false);
  });
  it('gates writes to member+ and admin routes to admin', () => {
    expect(canWrite({ role: 'member' })).toBe(true);
    expect(canWrite({ role: 'read_only' })).toBe(false);
    expect(isAdmin({ role: 'admin' })).toBe(true);
    expect(isAdmin({ role: 'member' })).toBe(false);
  });
});

describe('password', () => {
  it('hashes and verifies a password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored).not.toContain('correct horse');
    await expect(verifyPassword('correct horse battery staple', stored)).resolves.toBe(true);
  });
  it('rejects a wrong password without throwing', async () => {
    const stored = await hashPassword('right-password-1');
    await expect(verifyPassword('wrong-password-2', stored)).resolves.toBe(false);
  });
  it('rejects malformed stored hashes', async () => {
    await expect(verifyPassword('whatever-123', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('whatever-123', 'scrypt$bad$bad$bad$bad$bad')).resolves.toBe(false);
  });
  it('enforces password length bounds', async () => {
    await expect(hashPassword('short')).rejects.toThrow();
    await expect(hashPassword('x'.repeat(300))).rejects.toThrow();
  });
});

describe('session issuer', () => {
  const identity = {
    userId: '2d1f6a2b-4f4a-4f7f-9d8c-0f2a1b3c4d5e',
    workspaceId: '9b5c3b6e-2b6c-4f9b-8a1d-3e5f7a9b1c2d',
    role: 'member' as const,
  };

  it('mints tokens that verifySession accepts', () => {
    const { token, claims } = issueSession(identity, key, 3600);
    const verified = verifySession(token, key);
    expect(verified.sub).toBe(identity.userId);
    expect(verified.workspaceId).toBe(identity.workspaceId);
    expect(verified.role).toBe('member');
    expect(verified.exp).toBe(claims.exp);
  });

  it('expires when past exp', () => {
    const now = Date.now();
    const { token } = issueSession(identity, key, 60, now);
    expect(() => verifySession(token, key, now + 61_000)).toThrow('Session expired');
  });

  it('rejects tampered bodies and wrong keys', () => {
    const { token } = issueSession(identity, key, 3600);
    const [body] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ ...identity, sub: identity.userId, role: 'admin', exp: 9999999999 })).toString('base64url')}.AAAA`;
    expect(() => verifySession(forged, key)).toThrow('Invalid session');
    expect(() => verifySession(`${body}.AAAA`, key)).toThrow();
    expect(() => verifySession(token, Buffer.alloc(32, 8))).toThrow('Invalid session');
  });

  it('enforces key length and TTL bounds', () => {
    expect(() => issueSession(identity, Buffer.alloc(16), 3600)).toThrow();
    expect(() => issueSession(identity, key, 30)).toThrow();
    expect(() => issueSession(identity, key, 60 * 60 * 24 * 31)).toThrow();
  });
});

describe('prisma user directory', () => {
  const makePrisma = (user: any) => ({
    user: { findUnique: async ({ where }: any) => (where.email === (user?.email ?? '') ? user : null) },
  });

  it('returns a directory user with a validated role', async () => {
    const dir = new PrismaUserDirectory(
      makePrisma({
        id: '2d1f6a2b-4f4a-4f7f-9d8c-0f2a1b3c4d5e',
        workspaceId: '9b5c3b6e-2b6c-4f9b-8a1d-3e5f7a9b1c2d',
        email: 'a@b.co',
        passwordHash: 'scrypt$1$1$1$xxxxxxxxxxxxxxxx$' + 'x'.repeat(44),
        role: 'admin',
      }),
    );
    const found = await dir.findByEmail('  A@B.CO  '); // directory normalizes case/whitespace
    expect(found?.role).toBe('admin');
  });

  it('returns null for unknown users and invalid stored roles', async () => {
    await expect(new PrismaUserDirectory(makePrisma(null)).findByEmail('a@b.co')).resolves.toBeNull();
    const dir = new PrismaUserDirectory(
      makePrisma({ id: 'x', workspaceId: 'y', email: 'a@b.co', passwordHash: null, role: 'superuser' }),
    );
    await expect(dir.findByEmail('a@b.co')).resolves.toBeNull();
  });
});
