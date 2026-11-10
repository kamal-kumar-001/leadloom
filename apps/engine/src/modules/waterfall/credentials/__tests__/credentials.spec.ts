import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  InMemoryConnectorCredentialStore,
  ConnectorCredentialStore,
  CredentialSecurityError,
  maskApiKey,
  sealCredential,
  unsealCredential,
  resolveKek,
} from '../index';

describe('Waterfall Connector Credentials & AES-256-GCM Sealer', () => {
  const TEST_KEK_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const ORIGINAL_ENV_KEK = process.env.LEADLOOM_CREDENTIAL_KEK;

  beforeEach(() => {
    process.env.LEADLOOM_CREDENTIAL_KEK = TEST_KEK_HEX;
  });

  afterEach(() => {
    if (ORIGINAL_ENV_KEK !== undefined) {
      process.env.LEADLOOM_CREDENTIAL_KEK = ORIGINAL_ENV_KEK;
    } else {
      delete process.env.LEADLOOM_CREDENTIAL_KEK;
    }
  });

  describe('Key Masking Utility', () => {
    it('masks standard API keys preserving only prefix and last 4 characters', () => {
      expect(maskApiKey('sk-proj-1234567890abcdef')).toBe('sk-••••••••cdef');
      expect(maskApiKey('hunter_live_9876543210')).toBe('••••••••3210');
      expect(maskApiKey('short')).toBe('••••••••');
      expect(maskApiKey('')).toBe('');
    });
  });

  describe('Write-Only ConnectorCredentialStore API', () => {
    it('stores credentials securely and returns masked status without leaking keys', async () => {
      const store: ConnectorCredentialStore = new InMemoryConnectorCredentialStore();
      const workspaceId = 'ws-corp-1';
      const secretKey = 'sk-proj-secret-token-9999';

      await store.set(workspaceId, 'apollo', secretKey);

      const status = await store.getStatus(workspaceId, 'apollo');
      expect(status.configured).toBe(true);
      expect(status.workspaceId).toBe(workspaceId);
      expect(status.connectorId).toBe('apollo');
      expect(status.maskedKey).toBe('sk-••••••••9999');
      // Public status must NEVER contain the secret key
      expect(JSON.stringify(status)).not.toContain(secretKey);

      const list = await store.listStatus(workspaceId);
      expect(list).toHaveLength(1);
      expect(list[0].maskedKey).toBe('sk-••••••••9999');
      expect(JSON.stringify(list)).not.toContain(secretKey);
    });

    it('returns configured: false for non-existent credentials', async () => {
      const store = new InMemoryConnectorCredentialStore();
      const status = await store.getStatus('ws-corp-1', 'unknown-connector');
      expect(status.configured).toBe(false);
      expect(status.maskedKey).toBeNull();
      expect(status.updatedAt).toBeNull();
    });

    it('deletes stored credentials cleanly', async () => {
      const store = new InMemoryConnectorCredentialStore();
      const workspaceId = 'ws-corp-1';

      await store.set(workspaceId, 'dropcontact', 'drop_tok_12345');
      expect((await store.getStatus(workspaceId, 'dropcontact')).configured).toBe(true);

      const deleted = await store.delete(workspaceId, 'dropcontact');
      expect(deleted).toBe(true);

      const afterDelete = await store.getStatus(workspaceId, 'dropcontact');
      expect(afterDelete.configured).toBe(false);
      expect(afterDelete.maskedKey).toBeNull();

      // Second delete returns false
      expect(await store.delete(workspaceId, 'dropcontact')).toBe(false);
    });

    it('allows worker execution loops to decrypt stored keys with workspace context', async () => {
      const store = new InMemoryConnectorCredentialStore();
      const workspaceId = 'ws-worker-test';
      const secretKey = 'live_vendor_key_abc_123';

      await store.set(workspaceId, 'hunter', secretKey);

      const decrypted = await store.getDecryptedKey(workspaceId, 'hunter');
      expect(decrypted).toBe(secretKey);
    });
  });

  describe('AES-256-GCM Sealing & Workspace Context Isolation', () => {
    it('produces unique IVs and distinct ciphertexts for identical plaintexts (nonce randomness)', () => {
      const workspaceId = 'ws-entropy-1';
      const connectorId = 'pdl';
      const key = 'identical_secret_key';

      const record1 = sealCredential(key, workspaceId, connectorId);
      const record2 = sealCredential(key, workspaceId, connectorId);

      expect(record1.iv).not.toBe(record2.iv);
      expect(record1.ciphertext).not.toBe(record2.ciphertext);
      expect(record1.authTag).not.toBe(record2.authTag);

      expect(unsealCredential(record1, workspaceId, connectorId)).toBe(key);
      expect(unsealCredential(record2, workspaceId, connectorId)).toBe(key);
    });

    it('rejects cross-workspace credential decryption (AAD tenant isolation)', () => {
      const record = sealCredential('secret_key_1', 'workspace-tenant-A', 'apollo');

      // Attempting to unseal using workspace-tenant-B must throw
      expect(() => {
        unsealCredential(record, 'workspace-tenant-B', 'apollo');
      }).toThrowError(CredentialSecurityError);
    });

    it('rejects cross-connector credential reuse', () => {
      const record = sealCredential('secret_key_1', 'workspace-tenant-A', 'apollo');

      // Attempting to unseal under different connector id must throw
      expect(() => {
        unsealCredential(record, 'workspace-tenant-A', 'zerobounce');
      }).toThrowError(CredentialSecurityError);
    });

    it('fails closed when ciphertext or authentication tag is tampered with', () => {
      const record = sealCredential('super_sensitive_api_key', 'ws-tamper', 'openai');

      // Tampered ciphertext
      const corruptedCipher = {
        ...record,
        ciphertext: Buffer.from('corrupted_data_padding_extra').toString('base64'),
      };
      expect(() => unsealCredential(corruptedCipher, 'ws-tamper', 'openai')).toThrowError(
        CredentialSecurityError
      );

      // Tampered auth tag
      const corruptedTag = {
        ...record,
        authTag: randomBytes(16).toString('base64'),
      };
      expect(() => unsealCredential(corruptedTag, 'ws-tamper', 'openai')).toThrowError(
        CredentialSecurityError
      );
    });
  });

  describe('Fails Closed on Missing / Invalid KEK', () => {
    it('fails closed when LEADLOOM_CREDENTIAL_KEK is missing or empty', () => {
      delete process.env.LEADLOOM_CREDENTIAL_KEK;

      expect(() => resolveKek()).toThrowError(/LEADLOOM_CREDENTIAL_KEK is not configured/);

      const store = new InMemoryConnectorCredentialStore();
      expect(store.set('ws-1', 'apollo', 'key')).rejects.toThrowError(
        /LEADLOOM_CREDENTIAL_KEK is not configured/
      );
    });

    it('rejects invalid KEK formats and lengths', () => {
      expect(() => resolveKek('short_key')).toThrowError(/must decode to exactly 32 bytes/);
      expect(() => resolveKek('invalid-hex-characters-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toThrowError(
        /must decode to exactly 32 bytes/
      );
    });

    it('accepts canonical base64 32-byte KEK', () => {
      const b64Key = randomBytes(32).toString('base64');
      const resolved = resolveKek(b64Key);
      expect(resolved).toHaveLength(32);
    });
  });
});
