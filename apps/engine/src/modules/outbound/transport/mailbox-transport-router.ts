import type { OutboundTransport, SendReservation } from '../dispatch.service';
import type { MessageComposer } from './message-composer';
import { SmtpTransport, type SmtpClient } from './smtp-transport';
import { createStrictSmtpClient, type MailboxClientConfig, type SmtpSendHooks } from './client-factories';

/** Mailbox credentials endpoint as sealed at connect time (see mailbox-connect). */
export interface MailboxEndpointReader {
  loadEndpoint(workspaceId: string, mailboxId: string): Promise<{
    email: string;
    password: string;
    smtpHost: string;
    smtpPort: number;
  } | null>;
}

export interface MailboxTransportRouterDeps {
  endpoints: MailboxEndpointReader;
  composer: MessageComposer;
  unsubscribe: { baseUrl: string; signingKey: Buffer } | null;
  /** Strict-path hooks; allowPrivateHosts is dev-only and never set by production main. */
  hooks?: SmtpSendHooks;
  /** Test hook: replaces the real nodemailer-backed factory. */
  clientFactory?: (config: MailboxClientConfig) => Promise<SmtpClient>;
}

/** Bound on cached per-mailbox clients; oldest entries are dropped first. */
const MAX_CACHED_CLIENTS = 500;

/**
 * Send-side transport: resolves each reservation to the claimed mailbox's own
 * sealed credentials (loaded tenant-scoped at send time, decrypted inside the
 * vault boundary) and sends through a per-mailbox SmtpTransport. OAuth-only
 * mailboxes have no password endpoint and fail closed here; their token-loop
 * wiring is a separate follow-up. Clients are cached per (workspace, mailbox)
 * so one mailbox's failure never shares state with another's; a failed build
 * is evicted so the next tick retries cleanly.
 */
export class MailboxTransportRouter implements OutboundTransport {
  private readonly cache = new Map<string, Promise<SmtpTransport>>();

  constructor(private readonly deps: MailboxTransportRouterDeps) {}

  async send(reservation: SendReservation): Promise<{ providerMessageId: string }> {
    const transport = await this.forMailbox(reservation.workspaceId, reservation.mailboxId);
    return transport.send(reservation);
  }

  private forMailbox(workspaceId: string, mailboxId: string): Promise<SmtpTransport> {
    const key = `${workspaceId}:${mailboxId}`;
    let transport = this.cache.get(key);
    if (!transport) {
      if (this.cache.size >= MAX_CACHED_CLIENTS) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
      transport = this.build(workspaceId, mailboxId);
      this.cache.set(key, transport);
      transport.catch(() => this.cache.delete(key));
    }
    return transport;
  }

  private async build(workspaceId: string, mailboxId: string): Promise<SmtpTransport> {
    const endpoint = await this.deps.endpoints.loadEndpoint(workspaceId, mailboxId);
    if (!endpoint) throw new Error('Mailbox has no usable password endpoint');
    const config: MailboxClientConfig = {
      host: endpoint.smtpHost,
      port: endpoint.smtpPort,
      user: endpoint.email,
      authType: 'password',
      password: endpoint.password,
    };
    const factory = this.deps.clientFactory ?? ((c: MailboxClientConfig) => createStrictSmtpClient(c, this.deps.hooks));
    const client = await factory(config);
    return new SmtpTransport(client, {
      composer: this.deps.composer,
      fromAddress: endpoint.email,
      unsubscribe: this.deps.unsubscribe,
    });
  }
}
