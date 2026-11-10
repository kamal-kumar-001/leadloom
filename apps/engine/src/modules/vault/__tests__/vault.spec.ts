import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { VaultService, VaultKeyError, VaultDecryptionError, CredentialContext } from '../vault.service';

const keyV1 = randomBytes(32);
const keyV2 = randomBytes(32);
const context: CredentialContext = { workspaceId: 'tenant-a', credentialId: 'record-a', provider: 'openai' };
const secret = Buffer.from('synthetic-test-credential');
const vault = () => new VaultService({ currentVersion: 1, keys: new Map([[1, keyV1]]) });
const newer = () => new VaultService({ currentVersion: 2, keys: new Map([[1, keyV1], [2, keyV2]]) });

describe('VaultService authenticated envelope encryption', () => {
  it('round-trips with a random wrapped DEK', () => {
    const service = vault();
    const p = service.encrypt(secret, context);
    expect(service.decrypt(p, context)).toEqual(secret);
    expect(p.iv).toHaveLength(12);
    expect(p.authTag).toHaveLength(16);
    expect(p.wrappedDek.ciphertext).toHaveLength(32);
    expect(p.wrappedDek.iv).toHaveLength(12);
    expect(p.wrappedDek.authTag).toHaveLength(16);
  });
  it('uses independent random data and wrapping nonces per credential', () => {
    const service = vault();
    const a = service.encrypt(secret, context), b = service.encrypt(secret, context);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.wrappedDek.iv.equals(b.wrappedDek.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });
  for (const field of ['ciphertext', 'iv', 'authTag'] as const) {
    it(`rejects modified data ${field}`, () => {
      const service = vault(), p = service.encrypt(secret, context);
      p[field][0] ^= 1;
      expect(() => service.decrypt(p, context)).toThrow(VaultDecryptionError);
    });
    it(`rejects modified wrapped DEK ${field}`, () => {
      const service = vault(), p = service.encrypt(secret, context);
      p.wrappedDek[field][0] ^= 1;
      expect(() => service.decrypt(p, context)).toThrow(VaultDecryptionError);
    });
  }
  for (const field of ['workspaceId', 'credentialId', 'provider'] as const) {
    it(`rejects record substitution across ${field}`, () => {
      const service = vault(), p = service.encrypt(secret, context);
      expect(() => service.decrypt(p, { ...context, [field]: 'other' })).toThrow(VaultDecryptionError);
      expect(() => newer().rotate(p, { ...context, [field]: 'other' })).toThrow(VaultDecryptionError);
    });
  }
  it('rejects wrong master keys and unknown versions', () => {
    const service = vault(), p = service.encrypt(secret, context);
    const wrong = new VaultService({ currentVersion: 1, keys: new Map([[1, keyV2]]) });
    expect(() => wrong.decrypt(p, context)).toThrow(VaultDecryptionError);
    expect(() => service.decrypt({ ...p, keyVersion: 99 }, context)).toThrow(VaultDecryptionError);
  });
  it('rejects non-GCM algorithm metadata', () => {
    const service = vault(), p = service.encrypt(secret, context);
    expect(() => service.decrypt({ ...p, algorithm: 'invalid' as any }, context)).toThrow(VaultDecryptionError);
  });
  it('rewraps the DEK without changing encrypted credential bytes', () => {
    const p = vault().encrypt(secret, context), service = newer();
    const rotated = service.rotate(p, context);
    expect(rotated.keyVersion).toBe(2);
    expect(rotated.ciphertext).toEqual(p.ciphertext);
    expect(rotated.iv).toEqual(p.iv);
    const currentOnly = new VaultService({ currentVersion: 2, keys: new Map([[2, keyV2]]) });
    expect(currentOnly.decrypt(rotated, context)).toEqual(secret);
    expect(() => vault().decrypt(rotated, context)).toThrow(VaultDecryptionError);
  });
  it('overwrites the consumer buffer after success', async () => {
    const service = vault(), p = service.encrypt(secret, context);
    let observed: Buffer | undefined;
    await service.decryptAndUse(p, context, b => { observed = b; expect(b).toEqual(secret); });
    expect(observed!.every(b => b === 0)).toBe(true);
  });
  it('overwrites the consumer buffer after async failure', async () => {
    const service = vault(), p = service.encrypt(secret, context);
    let observed: Buffer | undefined;
    await expect(service.decryptAndUse(p, context, async b => {
      observed = b; throw new Error('synthetic consumer failure');
    })).rejects.toThrow('synthetic consumer failure');
    expect(observed!.every(b => b === 0)).toBe(true);
  });
  it('requires valid canonical keys and integer versions', () => {
    for (const env of [{}, { LEADLOOM_MASTER_KEY: 'short' },
      { LEADLOOM_MASTER_KEY: keyV1.toString('hex'), LEADLOOM_MASTER_KEY_VERSION: '2junk' },
      { LEADLOOM_MASTER_KEY: keyV1.toString('hex'), LEADLOOM_MASTER_KEY_PREVIOUS: keyV2.toString('hex') }]) {
      expect(() => VaultService.fromEnv(env)).toThrow(VaultKeyError);
    }
  });
  it('loads current/previous keys from environment and copies key material', () => {
    const service = VaultService.fromEnv({ LEADLOOM_MASTER_KEY: keyV2.toString('base64'),
      LEADLOOM_MASTER_KEY_VERSION: '2', LEADLOOM_MASTER_KEY_PREVIOUS: keyV1.toString('hex') });
    const p = vault().encrypt(secret, context);
    expect(service.decrypt(p, context)).toEqual(secret);
    expect(service.encrypt(secret, context).keyVersion).toBe(2);
  });
  it('destroy removes usable KEKs', () => {
    const service = vault(), p = service.encrypt(secret, context);
    service.destroy();
    expect(() => service.decrypt(p, context)).toThrow(VaultDecryptionError);
  });
  it('returns generic errors without plaintext material', () => {
    const service = vault(), p = service.encrypt(secret, context);
    p.authTag[0] ^= 1;
    expect(() => service.decrypt(p, context)).toThrow('Credential authentication failed');
  });
  it('masks all but the intended suffix', () => {
    expect(VaultService.maskKey(secret)).toBe('••••••••tial');
    expect(VaultService.maskKey(Buffer.from('short'))).toBe('••••••••');
  });
});
