import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { CredentialService, type CredentialRepository, type StoredCredential } from '../credential.service';
import { VaultService } from '../vault.service';
class MemoryRepo implements CredentialRepository {
  rows = new Map<string, StoredCredential>();
  async insert(record: StoredCredential) { this.rows.set(record.id, record); }
  async find(workspaceId: string, id: string) { const r = this.rows.get(id); return r?.workspaceId === workspaceId ? r : null; }
  async list(workspaceId: string) { return [...this.rows.values()].filter(r => r.workspaceId === workspaceId); }
  async delete(workspaceId: string, id: string) { const r = await this.find(workspaceId, id); return r ? this.rows.delete(id) : false; }
}
const setup = () => {
  const repo = new MemoryRepo(), vault = new VaultService({ currentVersion: 1, keys: new Map([[1, randomBytes(32)]]) });
  return { repo, service: new CredentialService(repo, vault) };
};
const body = { provider: 'openai', apiKey: 'synthetic-test-credential', label: 'Synthetic only' };
describe('Credential service repository and public-contract boundary', () => {
  it('stores ciphertext only and returns a contract-valid masked response', async () => {
    const { repo, service } = setup(), response = await service.save('tenant-a', body);
    expect(response.maskedKey).toBe('••••••••tial'); expect(response.isValid).toBe(false);
    expect(JSON.stringify(response)).not.toContain(body.apiKey);
    const stored = repo.rows.get(response.id)!;
    expect(stored.payload.ciphertext.toString('utf8')).not.toBe(body.apiKey);
    expect(Object.keys(stored)).not.toContain('apiKey');
  });
  it('isolates list, use and deletion by tenant', async () => {
    const { service } = setup(), record = await service.save('tenant-a', body);
    expect(await service.list('tenant-b')).toEqual([]);
    await expect(service.use('tenant-b', record.id, () => 'bad')).rejects.toThrow('Credential not found');
    expect(await service.delete('tenant-b', record.id)).toBe(false);
    const result = await service.use('tenant-a', record.id, b => b.toString());
    expect(result).toBe(body.apiKey);
  });
  it('rejects repository scope leakage before invoking a consumer', async () => {
    const { repo, service } = setup(), record = await service.save('tenant-a', body);
    repo.find = async () => repo.rows.get(record.id)!;
    await expect(service.use('tenant-b', record.id, () => 'never')).rejects.toThrow('Credential not found');
    repo.list = async () => [...repo.rows.values()];
    await expect(service.list('tenant-b')).rejects.toThrow('scope mismatch');
  });
  it('authenticates tenant context even if the stored row metadata is substituted', async () => {
    const { repo, service } = setup(), record = await service.save('tenant-a', body);
    repo.rows.get(record.id)!.workspaceId = 'tenant-b';
    await expect(service.use('tenant-b', record.id, () => 'never')).rejects.toThrow('authentication failed');
  });
  it('rejects invalid requests and empty scope before storing', async () => {
    const { repo, service } = setup();
    await expect(service.save('tenant-a', { ...body, provider: 'unknown' })).rejects.toThrow();
    await expect(service.save('', body)).rejects.toThrow('Authenticated workspace');
    expect(repo.rows.size).toBe(0);
  });
});
