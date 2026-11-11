import { randomUUID } from 'node:crypto';
import type { VaultService } from '../vault/vault.service';
import type { MailboxConnectStore, MailboxStatus } from './mailbox-connect.service';
import type { MailboxEndpoint } from './verifier';

/** Sealed with the existing ADR-001 envelope (access-token columns), bound to workspace + mailbox id + provider. */
export const MAILBOX_PASSWORD_PROVIDER = 'mailbox-password';
const SELECT = { id: true, email: true, connectionStatus: true, connectionErrorCode: true, connectionCheckedAt: true } as const;

export class PrismaMailboxConnectStore implements MailboxConnectStore {
  constructor(private readonly prisma: any, private readonly vault: VaultService) {}

  async create(workspaceId: string, ep: MailboxEndpoint, checkedAt: Date): Promise<MailboxStatus | null> {
    const exists = await this.prisma.mailbox.findFirst({ where: { workspaceId, email: ep.email }, select: { id: true } });
    if (exists) return null;
    const id = randomUUID();
    const p = this.vault.encrypt(Buffer.from(ep.password, 'utf8'), { workspaceId, credentialId: id, provider: MAILBOX_PASSWORD_PROVIDER });
    try {
      return await this.prisma.mailbox.create({
        data: {
          id, workspaceId, email: ep.email, smtpHost: ep.smtpHost, smtpPort: ep.smtpPort, imapHost: ep.imapHost, imapPort: ep.imapPort,
          authType: 'password', connectionStatus: 'ok', connectionCheckedAt: checkedAt, connectionErrorCode: null,
          encryptedAccessToken: p.ciphertext, accessTokenIv: p.iv, accessTokenAuthTag: p.authTag,
          wrappedAccessDek: p.wrappedDek.ciphertext, accessDekIv: p.wrappedDek.iv, accessDekAuthTag: p.wrappedDek.authTag,
          keyVersion: p.keyVersion,
        },
        select: SELECT,
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return null; // concurrent connect of the same address
      throw e;
    }
  }

  async loadEndpoint(workspaceId: string, mailboxId: string): Promise<MailboxEndpoint | null> {
    const row = await this.prisma.mailbox.findFirst({ where: { id: mailboxId, workspaceId, authType: 'password' } });
    if (!row || !row.encryptedAccessToken) return null;
    const payload = {
      ciphertext: Buffer.from(row.encryptedAccessToken), iv: Buffer.from(row.accessTokenIv), authTag: Buffer.from(row.accessTokenAuthTag),
      wrappedDek: { ciphertext: Buffer.from(row.wrappedAccessDek), iv: Buffer.from(row.accessDekIv), authTag: Buffer.from(row.accessDekAuthTag) },
      keyVersion: row.keyVersion, algorithm: 'aes-256-gcm' as const,
    };
    const password = await this.vault.decryptAndUse(payload, { workspaceId, credentialId: mailboxId, provider: MAILBOX_PASSWORD_PROVIDER }, (b: Buffer) => b.toString('utf8'));
    return { email: row.email, password, smtpHost: row.smtpHost, smtpPort: row.smtpPort, imapHost: row.imapHost, imapPort: row.imapPort };
  }

  async recordCheck(workspaceId: string, mailboxId: string, status: 'ok' | 'failed', code: string | null, at: Date): Promise<MailboxStatus | null> {
    const r = await this.prisma.mailbox.updateMany({ where: { id: mailboxId, workspaceId }, data: { connectionStatus: status, connectionErrorCode: code, connectionCheckedAt: at } });
    if (!r.count) return null;
    return this.prisma.mailbox.findFirst({ where: { id: mailboxId, workspaceId }, select: SELECT });
  }

  async remove(workspaceId: string, mailboxId: string): Promise<boolean> {
    const r = await this.prisma.mailbox.deleteMany({ where: { id: mailboxId, workspaceId } });
    return r.count > 0;
  }
}
