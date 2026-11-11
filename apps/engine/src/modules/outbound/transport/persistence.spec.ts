import { describe, expect, it } from 'vitest';
import { PrismaMailboxTokenVault } from './prisma-token-vault';
import { PrismaSeenMessageStore } from './prisma-seen-store';
import type { VaultService } from '../../vault/vault.service';

function buf(s: string) { return Buffer.from(s); }
function makeVault() {
  return {
    encrypt: (pt: Buffer) => ({
      ciphertext: buf('ct:' + pt.toString('utf8')), iv: buf('iv'), authTag: buf('tag'),
      wrappedDek: { ciphertext: buf('dek'), iv: buf('dekiv'), authTag: buf('dektag') },
      keyVersion: 1, algorithm: 'aes-256-gcm',
    }),
    decryptAndUse: async (payload: any, _ctx: unknown, use: (pt: Buffer) => unknown) => use(payload.ciphertext),
  } as unknown as VaultService;
}
const row = (over: Record<string, unknown> = {}) => ({
  id: 'mb-1', workspaceId: 'ws-1',
  encryptedAccessToken: buf('access-plain'), accessTokenIv: buf('iv'), accessTokenAuthTag: buf('tag'),
  wrappedAccessDek: buf('dek'), accessDekIv: buf('iv'), accessDekAuthTag: buf('tag'),
  encryptedRefreshToken: buf('refresh-plain'), refreshTokenIv: buf('iv'), refreshTokenAuthTag: buf('tag'),
  wrappedRefreshDek: buf('dek'), refreshDekIv: buf('iv'), refreshDekAuthTag: buf('tag'),
  keyVersion: 1,
  tokenExpiresAt: new Date('2026-11-10T10:00:00Z'),
  ...over,
});

describe('prisma token vault', () => {
  it('returns null when mailbox missing or token columns incomplete', async () => {
    const prisma = { mailbox: { findUnique: async ({ where: { id } }: any) => (id === 'none' ? null : row({ encryptedAccessToken: null })) } };
    const pv = new PrismaMailboxTokenVault(prisma, makeVault());
    expect(await pv.load('none')).toBeNull();
    expect(await pv.load('mb-1')).toBeNull();
  });
  it('round-trips tokens through the vault envelope columns', async () => {
    let saved: any = null;
    const prisma = {
      mailbox: {
        findUnique: async () => row(),
        update: async ({ where, data }: any) => { saved = { where, data }; },
      },
    };
    const pv = new PrismaMailboxTokenVault(prisma, makeVault());
    const tokens = await pv.load('mb-1');
    expect(tokens?.accessToken).toBe('access-plain');
    expect(tokens?.refreshToken).toBe('refresh-plain');
    expect(tokens?.expiresAt).toBe(Math.floor(Date.parse('2026-11-10T10:00:00Z') / 1000));
    await pv.save('mb-1', { accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: 1762807200 });
    expect(saved.where.id).toBe('mb-1');
    expect(saved.data.encryptedAccessToken.toString('utf8')).toBe('ct:new-access');
    expect(saved.data.encryptedRefreshToken.toString('utf8')).toBe('ct:new-refresh');
    expect(saved.data.tokenExpiresAt).toEqual(new Date(1762807200 * 1000));
  });
});

describe('prisma seen message store', () => {
  it('has() queries reply markers for the mailbox and message id', async () => {
    const calls: any[] = [];
    const prisma = { $queryRawUnsafe: async (sql: string, ...args: any[]) => { calls.push([sql, ...args]); return args[1] === 'known' ? [{ x: 1 }] : []; } };
    const store = new PrismaSeenMessageStore(prisma);
    expect(await store.has('mb-1', 'known')).toBe(true);
    expect(await store.has('mb-1', 'other')).toBe(false);
    expect(calls[0][0]).toContain("type = 'reply_received'");
  });
  it('add() inserts atomically with ON CONFLICT DO NOTHING', async () => {
    let sql = '';
    const prisma = { $executeRawUnsafe: async (s: string) => { sql = s; return 1; } };
    await new PrismaSeenMessageStore(prisma).add('mb-1', '<m@x>');
    expect(sql).toContain('ON CONFLICT DO NOTHING');
    expect(sql).toContain("type, message_id");
  });
  it('persists uid checkpoints via upsert and rejects invalid uids', async () => {
    const writes: any[] = [];
    const prisma = {
      $queryRawUnsafe: async () => [{ last_inbound_uid: 42 }],
      $executeRawUnsafe: async (sql: string, ...args: any[]) => { writes.push([sql, ...args]); return 1; },
    };
    const store = new PrismaSeenMessageStore(prisma);
    expect(await store.lastUid('mb-1')).toBe(42);
    await store.setLastUid('mb-1', 55);
    expect(writes[0][0]).toContain('ON CONFLICT (mailbox_id)');
    await expect(store.setLastUid('mb-1', -1)).rejects.toThrow('uid');
    await expect(store.setLastUid('mb-1', 1.5)).rejects.toThrow('uid');
  });
});

describe('PrismaSeenMessageStore.persistBatch', () => {
  const MB = '11111111-1111-4111-8111-111111111111';
  it('writes all markers and the watermark inside one transaction', async () => {
    const calls: string[] = [];
    let txCount = 0;
    const prisma = {
      $transaction: async (fn: any) => { txCount++; return fn({ $executeRawUnsafe: async (sql: string) => { calls.push(sql); } }); },
    };
    const store = new PrismaSeenMessageStore(prisma);
    await store.persistBatch(MB, ['k1', 'k2'], 7);
    expect(txCount).toBe(1);
    expect(calls.filter((s) => s.includes('outreach_events'))).toHaveLength(2);
    expect(calls.filter((s) => s.includes('mailbox_sync_state') && s.includes('GREATEST'))).toHaveLength(1);
  });
  it('rejects an invalid watermark', async () => {
    const store = new PrismaSeenMessageStore({ $transaction: async () => { throw new Error('should not reach'); } });
    await expect(store.persistBatch(MB, [], -1)).rejects.toThrow('watermark');
  });
});
