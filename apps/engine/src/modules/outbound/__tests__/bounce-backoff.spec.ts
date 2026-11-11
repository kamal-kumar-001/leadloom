import { describe, expect, it } from 'vitest';
import { detectBounce } from '../transport/bounce';
import { PollBackoff } from '../transport/backoff';
import { ImapReplyPoller, InMemorySeenMessageStore, type ImapClient } from '../transport/imap-poller';

/**
 * Synthetic RFC 3464-style DSN fixture. Not copied from any real mailbox:
 * hand-written to the RFC's field shapes (Final-Recipient, Status,
 * Diagnostic-Code, Action).
 */
const DSN_BODY = [
  'This is an automated message from the mail delivery subsystem.',
  '',
  '--boundary-1',
  'Content-Type: message/delivery-status',
  '',
  'Reporting-MTA: dns; mx.example.test',
  '',
  'Final-Recipient: rfc822; no.such.user@example.test',
  'Action: failed',
  'Status: 5.1.1',
  'Diagnostic-Code: smtp; 550 5.1.1 user unknown',
  '',
  '--boundary-1',
  'Content-Type: text/rfc822-headers',
  '',
  'Subject: our original pitch',
  'Sounds great, let us talk', // quoted original text must NOT be read as "interested"
].join('\r\n');

const ctx = { mailboxId: '11111111-1111-4111-8111-111111111111', campaignId: '22222222-2222-4222-8222-222222222222' };

describe('detectBounce', () => {
  it('detects a full RFC 3464 DSN and extracts the failed recipient and status', () => {
    const report = detectBounce({
      fromEmail: 'MAILER-DAEMON@mx.example.test',
      subject: 'Delivery Status Notification (Failure)',
      bodyText: DSN_BODY,
    });
    expect(report).not.toBeNull();
    expect(report!.failedRecipients).toEqual(['no.such.user@example.test']);
    expect(report!.diagnosticCode).toBe('5.1.1');
    expect(report!.kind).toBe('hard');
  });

  it('treats a 4.x status as a soft bounce', () => {
    const report = detectBounce({
      fromEmail: 'postmaster@mx.example.test',
      subject: 'Undelivered Mail Returned to Sender',
      bodyText: 'Final-Recipient: rfc822; full@example.test\nAction: failed\nStatus: 4.2.2\nmessage/delivery-status',
    });
    expect(report!.kind).toBe('soft');
    expect(report!.failedRecipients).toEqual(['full@example.test']);
  });

  it('rejects a human reply that quotes a bounce-related phrase only once', () => {
    const report = detectBounce({
      fromEmail: 'prospect@example.test',
      subject: 'RE: our chat',
      bodyText: 'Your mail to my colleague was undeliverable, but you can reach me here.',
    });
    expect(report).toBeNull();
  });

  it('rejects an ordinary interested reply', () => {
    expect(
      detectBounce({ fromEmail: 'buyer@example.test', subject: 'RE: demo', bodyText: "Sounds great, let's talk Thursday" }),
    ).toBeNull();
  });
});

describe('poller bounce classification', () => {
  it('classifies a DSN as bounce, not by the quoted original keywords', async () => {
    const client: ImapClient = {
      async fetchSince() {
        return [
          {
            uid: 1,
            messageId: '<dsn-1@mx.example.test>',
            fromEmail: 'mailer-daemon@mx.example.test',
            subject: 'Delivery Status Notification (Failure)',
            bodyText: DSN_BODY,
            receivedAt: new Date('2026-11-11T12:00:00Z'),
          },
        ];
      },
    };
    const poller = new ImapReplyPoller(client, new InMemorySeenMessageStore());
    const events = await poller.pollOnce(ctx);
    expect(events).toHaveLength(1);
    expect(events[0].classification).toBe('bounce');
    expect(events[0].confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe('PollBackoff', () => {
  it('doubles the delay per failure and caps it', () => {
    const b = new PollBackoff({ initialMs: 1000, maxMs: 4000, jitter: 0 });
    expect(b.recordFailure()).toBe(1000);
    expect(b.recordFailure()).toBe(2000);
    expect(b.recordFailure()).toBe(4000);
    expect(b.recordFailure()).toBe(4000);
    expect(b.currentFailures()).toBe(4);
  });

  it('resets after a success', () => {
    const b = new PollBackoff({ initialMs: 1000, jitter: 0 });
    b.recordFailure();
    b.recordFailure();
    b.recordSuccess();
    expect(b.currentFailures()).toBe(0);
    expect(b.recordFailure()).toBe(1000);
  });

  it('adds jitter within the configured fraction', () => {
    const b = new PollBackoff({ initialMs: 1000, jitter: 0.5, random: () => 1 });
    expect(b.recordFailure()).toBe(1500);
  });

  it('rejects invalid options', () => {
    expect(() => new PollBackoff({ initialMs: 0 })).toThrow();
    expect(() => new PollBackoff({ initialMs: 5000, maxMs: 1000 })).toThrow();
  });
});
