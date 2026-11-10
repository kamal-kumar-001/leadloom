import { appendFileSync } from 'node:fs';
import type { SendResult, TransactionalEmail, TransactionalMessage } from './transactional';

/**
 * LOCAL DEV ONLY. Appends each message as one JSON line to a local file so the
 * verification and reset links can be followed in a browser without sending
 * mail. It must never be created in production: main refuses NODE_ENV=production.
 */
export class FileDevMailSink implements TransactionalEmail {
  constructor(private readonly path: string) {
    if (process.env.NODE_ENV === 'production') throw new Error('Dev mail sink is not allowed in production');
  }
  async send(m: TransactionalMessage): Promise<SendResult> {
    appendFileSync(this.path, JSON.stringify({ at: new Date().toISOString(), kind: m.kind, to: m.to, subject: m.subject, text: m.text }) + '\n', { mode: 0o600 });
    return { sent: true, providerId: 'dev-sink' };
  }
}
