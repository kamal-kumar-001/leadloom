import { describe, expect, it } from 'vitest';
import { SmtpTransport, type SmtpClient, type SmtpSendInput } from '../transport/smtp-transport';
import { InMemoryMessageComposer } from '../transport/message-composer';
import { buildListUnsubscribeHeaders, buildUnsubscribeToken, classifyReply } from '../transport/unsubscribe';
import { ImapReplyPoller, InMemorySeenMessageStore, type ImapClient, type RawInboundMessage } from '../transport/imap-poller';
import { OAuth2TokenLoop, type MailboxTokenVault, type OAuth2TokenEndpoint, type OAuth2Tokens } from '../transport/oauth2-token-loop';

const reservation = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  campaignId: '33333333-3333-4333-8333-333333333333',
  mailboxId: '44444444-4444-4444-8444-444444444444',
  messageRef: 'ref-1',
};
const composed = {
  to: 'lead@example.com',
  subject: 'Quick question',
  text: 'Hi there',
  campaignId: reservation.campaignId,
  mailboxId: reservation.mailboxId,
};

class RecordingSmtpClient implements SmtpClient {
  sent: SmtpSendInput[] = [];
  failNext = false;
  async sendMail(input: SmtpSendInput): Promise<{ messageId: string }> {
    if (this.failNext) { this.failNext = false; throw new Error('connection reset'); }
    this.sent.push(input);
    return { messageId: `<smtp-${this.sent.length}@mx>` };
  }
}

describe('smtp transport', () => {
  const key = Buffer.alloc(32, 3);

  it('sends the composed message with one-click unsubscribe headers', async () => {
    const client = new RecordingSmtpClient();
    const transport = new SmtpTransport(client, {
      composer: new InMemoryMessageComposer({ 'ref-1': composed }),
      fromAddress: 'sender@example.com',
      unsubscribe: { baseUrl: 'https://api.example.com/unsubscribe', signingKey: key },
    });
    const result = await transport.send(reservation);
    expect(result.providerMessageId).toBe('<smtp-1@mx>');
    expect(client.sent).toHaveLength(1);
    const msg = client.sent[0];
    expect(msg.from).toBe('sender@example.com');
    expect(msg.to).toBe('lead@example.com');
    expect(msg.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(msg.headers['List-Unsubscribe']).toMatch(/^<https:\/\/api\.example\.com\/unsubscribe\?c=.+&e=.+&t=.+>$/);
  });

  it('omits unsubscribe headers when not configured', async () => {
    const client = new RecordingSmtpClient();
    const transport = new SmtpTransport(client, {
      composer: new InMemoryMessageComposer({ 'ref-1': composed }),
      fromAddress: 'sender@example.com',
      unsubscribe: null,
    });
    await transport.send(reservation);
    expect(client.sent[0].headers).toEqual({});
  });

  it('propagates client failures so the dispatcher marks the send uncertain', async () => {
    const client = new RecordingSmtpClient();
    client.failNext = true;
    const transport = new SmtpTransport(client, {
      composer: new InMemoryMessageComposer({ 'ref-1': composed }),
      fromAddress: 'sender@example.com',
      unsubscribe: null,
    });
    await expect(transport.send(reservation)).rejects.toThrow('connection reset');
  });

  it('rejects unknown message references', async () => {
    const client = new RecordingSmtpClient();
    const transport = new SmtpTransport(client, {
      composer: new InMemoryMessageComposer({}),
      fromAddress: 'sender@example.com',
      unsubscribe: null,
    });
    await expect(transport.send(reservation)).rejects.toThrow('Unknown message reference');
    expect(client.sent).toHaveLength(0);
  });
});

describe('unsubscribe builder and classification', () => {
  const input = {
    baseUrl: 'https://api.example.com/unsubscribe',
    campaignId: '33333333-3333-4333-8333-333333333333',
    recipientEmail: 'Lead@Example.com',
    signingKey: Buffer.alloc(32, 3),
  };

  it('builds a deterministic HMAC token (lowercase-normalized email)', () => {
    expect(buildUnsubscribeToken(input)).toBe(buildUnsubscribeToken({ ...input, recipientEmail: 'lead@example.com' }));
    expect(buildUnsubscribeToken(input)).not.toBe(buildUnsubscribeToken({ ...input, campaignId: 'x' }));
  });

  it('rejects short signing keys', () => {
    expect(() => buildListUnsubscribeHeaders({ ...input, signingKey: Buffer.alloc(8) })).toThrow();
  });

  it('classifies unsubscribe above every other signal', () => {
    expect(classifyReply('This sounds great but please unsubscribe me').classification).toBe('unsubscribe');
    expect(classifyReply('Please remove me from your list').classification).toBe('unsubscribe');
  });
  it('classifies out-of-office, objection, interested, neutral', () => {
    expect(classifyReply('I am out of the office until Monday').classification).toBe('out_of_office');
    expect(classifyReply('Not interested, we already use a vendor').classification).toBe('objection');
    expect(classifyReply("Sounds great, let's talk Thursday").classification).toBe('interested');
    expect(classifyReply('Ok').classification).toBe('neutral');
  });
});

describe('imap reply poller', () => {
  const ctx = { mailboxId: '44444444-4444-4444-8444-444444444444', campaignId: '33333333-3333-4333-8333-333333333333' };
  const msg = (uid: number, id: string, body: string): RawInboundMessage => ({
    uid, messageId: id, fromEmail: 'lead@example.com', subject: 'Re: Quick question',
    bodyText: body, receivedAt: new Date('2026-11-10T10:00:00Z'),
  });
  const client = (batch: RawInboundMessage[]): ImapClient => ({ fetchSince: async () => batch });

  it('converts new messages to contract-valid reply events', async () => {
    const poller = new ImapReplyPoller(client([msg(1, '<a@x>', 'sounds great, demo please'), msg(2, '<b@x>', 'unsubscribe')]), new InMemorySeenMessageStore());
    const events = await poller.pollOnce(ctx);
    expect(events).toHaveLength(2);
    expect(events[0].classification).toBe('interested');
    expect(events[1].classification).toBe('unsubscribe');
    expect(events[0].mailboxId).toBe(ctx.mailboxId);
  });

  it('dedupes by message id and advances uid only after recording', async () => {
    const seen = new InMemorySeenMessageStore();
    const poller = new ImapReplyPoller(client([msg(1, '<a@x>', 'ok')]), seen);
    await poller.pollOnce(ctx);
    const again = await poller.pollOnce(ctx);
    expect(again).toHaveLength(0);
  });

  it('skips already-seen ids within a replayed batch', async () => {
    const seen = new InMemorySeenMessageStore();
    await seen.add(ctx.mailboxId, '<a@x>');
    const poller = new ImapReplyPoller(client([msg(1, '<a@x>', 'ok'), msg(2, '<b@x>', 'interested demo')]), seen);
    const events = await poller.pollOnce(ctx);
    expect(events.map((e) => e.messageId)).toEqual(['<b@x>']);
    expect(await seen.lastUid(ctx.mailboxId)).toBe(2);
  });
});

describe('oauth2 token loop', () => {
  const now = 1_760_000_000;
  const vault = (tokens: OAuth2Tokens | null): MailboxTokenVault & { saved: OAuth2Tokens[] } => ({
    saved: [],
    async load() { return tokens; },
    async save(_id: string, t: OAuth2Tokens) { this.saved.push(t); },
  });

  it('returns the cached token outside the jittered expiry window', async () => {
    const v = vault({ accessToken: 'cached', refreshToken: 'rt', expiresAt: now + 3600 });
    const endpoint: OAuth2TokenEndpoint = { refresh: async () => { throw new Error('must not refresh'); } };
    const loop = new OAuth2TokenLoop(endpoint, v, () => now, () => 0);
    await expect(loop.getAccessToken('mbx')).resolves.toBe('cached');
  });

  it('refreshes inside the window and preserves an unrotated refresh token', async () => {
    const v = vault({ accessToken: 'stale', refreshToken: 'rt-1', expiresAt: now + 60 });
    const endpoint: OAuth2TokenEndpoint = { refresh: async (rt) => ({ accessToken: `fresh-for-${rt}`, expiresInSec: 3600 }) };
    const loop = new OAuth2TokenLoop(endpoint, v, () => now, () => 0);
    await expect(loop.getAccessToken('mbx')).resolves.toBe('fresh-for-rt-1');
    expect(v.saved[0].refreshToken).toBe('rt-1');
    expect(v.saved[0].expiresAt).toBe(now + 3600);
  });

  it('stores a rotated refresh token when the provider returns one', async () => {
    const v = vault({ accessToken: 'stale', refreshToken: 'rt-1', expiresAt: now + 60 });
    const endpoint: OAuth2TokenEndpoint = { refresh: async () => ({ accessToken: 'fresh', refreshToken: 'rt-2', expiresInSec: 3600 }) };
    const loop = new OAuth2TokenLoop(endpoint, v, () => now, () => 0);
    await loop.getAccessToken('mbx');
    expect(v.saved[0].refreshToken).toBe('rt-2');
  });

  it('fails closed when no tokens are stored or the provider errors', async () => {
    const loop = new OAuth2TokenLoop({ refresh: async () => ({ accessToken: 'x', expiresInSec: 1 }) }, vault(null), () => now, () => 0);
    await expect(loop.getAccessToken('mbx')).rejects.toThrow('no stored OAuth2 tokens');
    const failing = new OAuth2TokenLoop(
      { refresh: async () => { throw new Error('invalid_grant'); } },
      vault({ accessToken: 'stale', refreshToken: 'rt', expiresAt: now + 60 }),
      () => now, () => 0,
    );
    await expect(failing.getAccessToken('mbx')).rejects.toThrow('invalid_grant');
  });
});
