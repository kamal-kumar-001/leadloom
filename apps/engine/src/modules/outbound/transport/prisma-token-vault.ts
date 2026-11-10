import type { MailboxTokenVault, OAuth2Tokens } from './oauth2-token-loop';
import type { EncryptedPayload, VaultService } from '../../vault/vault.service';

/**
 * MailboxTokenVault over the Mailbox ADR-001 envelope columns. Decryption is
 * tenant/record-bound through the vault's AAD context; plaintext tokens exist
 * only inside the worker and buffers are zeroed best-effort after use.
 */
const PROVIDER = 'mailbox-oauth2';

export class PrismaMailboxTokenVault implements MailboxTokenVault {
  constructor(
    private readonly prisma: any,
    private readonly vault: VaultService,
  ) {}

  private context(workspaceId: string, mailboxId: string) {
    return { workspaceId, credentialId: mailboxId, provider: PROVIDER };
  }

  private toPayload(row: any, kind: 'access' | 'refresh'): EncryptedPayload | null {
    const cap = kind === 'access' ? 'access' : 'refresh';
    const data = row[kind === 'access' ? 'encryptedAccessToken' : 'encryptedRefreshToken'];
    const iv = row[`${cap}TokenIv`];
    const authTag = row[`${cap}TokenAuthTag`];
    const wrappedDek = row[kind === 'access' ? 'wrappedAccessDek' : 'wrappedRefreshDek'];
    const dekIv = row[`${cap}DekIv`];
    const dekAuthTag = row[`${cap}DekAuthTag`];
    if (!data || !iv || !authTag || !wrappedDek || !dekIv || !dekAuthTag) return null;
    return {
      ciphertext: Buffer.from(data),
      iv: Buffer.from(iv),
      authTag: Buffer.from(authTag),
      wrappedDek: { ciphertext: Buffer.from(wrappedDek), iv: Buffer.from(dekIv), authTag: Buffer.from(dekAuthTag) },
      keyVersion: row.keyVersion,
      algorithm: 'aes-256-gcm',
    };
  }

  async load(mailboxId: string): Promise<OAuth2Tokens | null> {
    const row = await this.prisma.mailbox.findUnique({ where: { id: mailboxId } });
    if (!row) return null;
    const ctx = this.context(row.workspaceId, mailboxId);
    const accessPayload = this.toPayload(row, 'access');
    const refreshPayload = this.toPayload(row, 'refresh');
    if (!accessPayload || !refreshPayload || !row.tokenExpiresAt) return null;
    const accessToken = await this.vault.decryptAndUse(accessPayload, ctx, (b) => b.toString('utf8'));
    const refreshToken = await this.vault.decryptAndUse(refreshPayload, ctx, (b) => b.toString('utf8'));
    return { accessToken, refreshToken, expiresAt: Math.floor(row.tokenExpiresAt.getTime() / 1000) };
  }

  async save(mailboxId: string, tokens: OAuth2Tokens): Promise<void> {
    const row = await this.prisma.mailbox.findUnique({ where: { id: mailboxId }, select: { workspaceId: true } });
    if (!row) throw new Error('Mailbox not found');
    const ctx = this.context(row.workspaceId, mailboxId);
    const access = this.vault.encrypt(Buffer.from(tokens.accessToken, 'utf8'), ctx);
    const refresh = this.vault.encrypt(Buffer.from(tokens.refreshToken, 'utf8'), ctx);
    await this.prisma.mailbox.update({
      where: { id: mailboxId },
      data: {
        encryptedAccessToken: access.ciphertext,
        accessTokenIv: access.iv,
        accessTokenAuthTag: access.authTag,
        wrappedAccessDek: access.wrappedDek.ciphertext,
        accessDekIv: access.wrappedDek.iv,
        accessDekAuthTag: access.wrappedDek.authTag,
        encryptedRefreshToken: refresh.ciphertext,
        refreshTokenIv: refresh.iv,
        refreshTokenAuthTag: refresh.authTag,
        wrappedRefreshDek: refresh.wrappedDek.ciphertext,
        refreshDekIv: refresh.wrappedDek.iv,
        refreshDekAuthTag: refresh.wrappedDek.authTag,
        keyVersion: access.keyVersion,
        tokenExpiresAt: new Date(tokens.expiresAt * 1000),
      },
    });
  }
}
