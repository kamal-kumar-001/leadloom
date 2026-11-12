import { describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { MailboxTransportRouter } from '../transport/mailbox-transport-router';
import { InMemoryMessageComposer, type ComposedMessage } from '../transport/message-composer';
import type { SendReservation } from '../dispatch.service';
import type { SmtpClient, SmtpSendInput } from '../transport/smtp-transport';
import type { MailboxClientConfig } from '../transport/client-factories';

const ws1 = randomUUID();
const ws2 = randomUUID();
const mb1 = randomUUID();
const mb2 = randomUUID();

function reservation(overrides: Partial<SendReservation> = {}): SendReservation {
  return { id: randomUUID(), workspaceId: ws1, campaignId: randomUUID(), mailboxId: mb1, messageRef: 'ref-1', ...overrides };
}

const composed: ComposedMessage = { to: 'ada@example.invalid', subject: 'Hi', text: 'Body', campaignId: randomUUID(), mailboxId: mb1 };

function recordingClient(sent: SmtpSendInput[]): SmtpClient {
  return { async sendMail(input: SmtpSendInput) { sent.push(input); return { messageId: '<msg-' + sent.length + '@fixture>' }; } };
}

function setup(opts: { failBuild?: boolean } = {}) {
  const endpoints: Record<string, { email: string; password: string; smtpHost: string; smtpPort: number }> = {
    [`${ws1}:${mb1}`]: { email: 'alice@brand.invalid', password: 'pw1', smtpHost: 'smtp.brand.invalid', smtpPort: 587 },
    [`${ws1}:${mb2}`]: { email: 'bob@brand.invalid', password: 'pw2', smtpHost: 'smtp.brand.invalid', smtpPort: 465 },
    [`${ws2}:${mb1}`]: { email: 'other-tenant@brand.invalid', password: 'pw3', smtpHost: 'smtp.other.invalid', smtpPort: 587 },
  };
  const configs: MailboxClientConfig[] = [];
  const sent = new Map<string, SmtpSendInput[]>();
  const factory = async (config: MailboxClientConfig) => {
    configs.push(config);
    if (opts.failBuild) throw new Error('dial failed');
    const box: SmtpSendInput[] = [];
    sent.set(config.user, box);
    return recordingClient(box);
  };
  const router = new MailboxTransportRouter({
    endpoints: { async loadEndpoint(workspaceId: string, mailboxId: string) { return endpoints[`${workspaceId}:${mailboxId}`] ?? null; } },
    composer: new InMemoryMessageComposer({ 'ref-1': composed }),
    unsubscribe: null,
    clientFactory: factory,
  });
  return { router, configs, sent };
}

describe('MailboxTransportRouter', () => {
  it('sends from the claimed mailbox identity with its own sealed credentials', async () => {
    const { router, configs, sent } = setup();
    const res = await router.send(reservation());
    expect(res.providerMessageId).toBe('<msg-1@fixture>');
    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({ host: 'smtp.brand.invalid', port: 587, user: 'alice@brand.invalid', authType: 'password', password: 'pw1' });
    const box = sent.get('alice@brand.invalid')!;
    expect(box[0].from).toBe('alice@brand.invalid');
    expect(box[0].to).toBe('ada@example.invalid');
  });

  it('caches one client per mailbox and keys the cache tenant-scoped', async () => {
    const { router, configs } = setup();
    await router.send(reservation());
    await router.send(reservation({ id: randomUUID() }));
    await router.send(reservation({ mailboxId: mb2 }));
    await router.send(reservation({ workspaceId: ws2 })); // same mailbox id, other tenant: separate credentials
    expect(configs.map((c) => c.user)).toEqual(['alice@brand.invalid', 'bob@brand.invalid', 'other-tenant@brand.invalid']);
  });

  it('fails closed for a mailbox with no password endpoint and never poisons the cache with a failed build', async () => {
    const { router } = setup();
    await expect(router.send(reservation({ mailboxId: randomUUID() }))).rejects.toThrow('no usable password endpoint');
    const broken = setup({ failBuild: true });
    await expect(broken.router.send(reservation())).rejects.toThrow('dial failed');
    expect(broken.configs).toHaveLength(1);
    await expect(broken.router.send(reservation())).rejects.toThrow('dial failed');
    expect(broken.configs).toHaveLength(2); // retried, not served from a poisoned cache
  });

  it('adds signed List-Unsubscribe headers when unsubscribe signing is configured', async () => {
    const box: SmtpSendInput[] = [];
    const router = new MailboxTransportRouter({
      endpoints: { async loadEndpoint() { return { email: 'alice@brand.invalid', password: 'pw1', smtpHost: 'h', smtpPort: 587 }; } },
      composer: new InMemoryMessageComposer({ 'ref-1': composed }),
      unsubscribe: { baseUrl: 'https://app.example.invalid', signingKey: randomBytes(32) },
      clientFactory: async () => recordingClient(box),
    });
    await router.send(reservation());
    expect(box[0].headers['List-Unsubscribe']).toContain('https://app.example.invalid');
    expect(box[0].headers['List-Unsubscribe-Post']).toBeDefined();
  });
});
