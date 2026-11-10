import type { PrismaClient } from '@leadloom/database';
import type { BYOKProvider } from '@leadloom/contracts';
import type { CredentialRepository, StoredCredential } from './credential.service';
import { VAULT_ALGORITHM } from './vault.service';

type CredentialRow = Awaited<ReturnType<PrismaClient['byokCredential']['findFirst']>>;

/** Tenant-scoped persistence adapter. Construct with the shared Prisma client. */
export class PrismaCredentialRepository implements CredentialRepository {
  constructor(private readonly client: PrismaClient) {}

  async insert(record: StoredCredential): Promise<void> {
    const p = record.payload;
    await this.client.byokCredential.create({ data: {
      id: record.id, workspaceId: record.workspaceId, provider: record.provider,
      label: record.label, maskedKey: record.maskedKey, createdAt: record.createdAt,
      encryptedKeyCiphertext: p.ciphertext, iv: p.iv, authTag: p.authTag,
      wrappedDek: p.wrappedDek.ciphertext, dekIv: p.wrappedDek.iv, dekAuthTag: p.wrappedDek.authTag,
      keyVersion: p.keyVersion, algorithm: p.algorithm, isValid: false,
    } });
  }

  async find(workspaceId: string, credentialId: string): Promise<StoredCredential | null> {
    const row = await this.client.byokCredential.findFirst({ where: { id: credentialId, workspaceId } });
    return row ? this.fromRow(row) : null;
  }

  async list(workspaceId: string): Promise<StoredCredential[]> {
    const rows = await this.client.byokCredential.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => this.fromRow(row));
  }

  async delete(workspaceId: string, credentialId: string): Promise<boolean> {
    const result = await this.client.byokCredential.deleteMany({ where: { id: credentialId, workspaceId } });
    return result.count > 0;
  }

  /** Compare-and-swap avoids overwriting a concurrent rotation/update. */
  async replaceEnvelope(workspaceId: string, credentialId: string, previousVersion: number, record: StoredCredential): Promise<boolean> {
    if (record.workspaceId !== workspaceId || record.id !== credentialId) throw new Error('Credential scope mismatch');
    const p = record.payload;
    const result = await this.client.byokCredential.updateMany({
      where: { id: credentialId, workspaceId, keyVersion: previousVersion },
      data: { encryptedKeyCiphertext: p.ciphertext, iv: p.iv, authTag: p.authTag,
        wrappedDek: p.wrappedDek.ciphertext, dekIv: p.wrappedDek.iv, dekAuthTag: p.wrappedDek.authTag,
        keyVersion: p.keyVersion, algorithm: p.algorithm },
    });
    return result.count === 1;
  }

  private fromRow(row: NonNullable<CredentialRow>): StoredCredential {
    if (row.algorithm !== VAULT_ALGORITHM) throw new Error('Unsupported credential envelope');
    return {
      id: row.id, workspaceId: row.workspaceId, provider: row.provider as BYOKProvider,
      label: row.label, maskedKey: row.maskedKey, createdAt: row.createdAt,
      payload: {
        algorithm: VAULT_ALGORITHM, keyVersion: row.keyVersion,
        ciphertext: Buffer.from(row.encryptedKeyCiphertext), iv: Buffer.from(row.iv), authTag: Buffer.from(row.authTag),
        wrappedDek: { ciphertext: Buffer.from(row.wrappedDek), iv: Buffer.from(row.dekIv), authTag: Buffer.from(row.dekAuthTag) },
      },
    };
  }
}
