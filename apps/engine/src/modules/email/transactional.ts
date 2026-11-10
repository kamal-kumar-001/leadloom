/**
 * Transactional email port for app mail only (verification, password reset,
 * invites, billing notices). Not for outreach: single recipient, fixed kinds,
 * no bulk. Default OFF. Outreach sending stays in modules/outbound behind its
 * own gates. This adapter must never share a sender identity or API key with any
 * other product: it only reads LEADLOOM_* variables, and the from-address is
 * explicit configuration with no default.
 */
export const TRANSACTIONAL_KINDS = ['auth_verification', 'password_reset', 'team_invite', 'billing_notice'] as const;
export type TransactionalKind = (typeof TRANSACTIONAL_KINDS)[number];

export interface TransactionalMessage { kind: TransactionalKind; to: string; subject: string; text: string; html?: string }
export type SendResult =
  | { sent: true; providerId: string }
  | { sent: false; reason: 'disabled' | 'invalid_message' | 'provider_error' | 'rate_limited' };
export interface TransactionalEmail { send(message: TransactionalMessage): Promise<SendResult> }

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const validMessage = (m: TransactionalMessage) =>
  TRANSACTIONAL_KINDS.includes(m.kind) && EMAIL.test(m.to) && m.to.length <= 320 &&
  m.subject.length > 0 && m.subject.length <= 200 && !/[\r\n]/.test(m.subject) && m.text.length > 0 && m.text.length <= 20000 && (m.html === undefined || m.html.length <= 60000);

export class DisabledTransactionalEmail implements TransactionalEmail {
  async send(): Promise<SendResult> { return { sent: false, reason: 'disabled' }; }
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; json(): Promise<any> }>;

export class ResendTransactionalEmail implements TransactionalEmail {
  private windowStart = 0; private count = 0;
  constructor(private readonly cfg: { apiKey: string; from: string; maxPerMinute?: number }, private readonly fetchImpl: FetchLike, private readonly now: () => number = Date.now) {}
  async send(m: TransactionalMessage): Promise<SendResult> {
    if (!validMessage(m)) return { sent: false, reason: 'invalid_message' };
    const t = this.now();
    if (t - this.windowStart >= 60_000) { this.windowStart = t; this.count = 0; }
    if (this.count >= (this.cfg.maxPerMinute ?? 30)) return { sent: false, reason: 'rate_limited' };
    this.count++;
    try {
      const res = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.cfg.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: this.cfg.from, to: [m.to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}), tags: [{ name: 'kind', value: m.kind }] }),
      });
      const body = await res.json().catch(() => ({}));
      return res.ok && typeof body?.id === 'string' ? { sent: true, providerId: body.id } : { sent: false, reason: 'provider_error' };
    } catch { return { sent: false, reason: 'provider_error' }; }
  }
}

/** Enabled only with all three variables; otherwise a disabled adapter. Never logs the key. */
export function createTransactionalEmail(env: Record<string, string | undefined>, fetchImpl: FetchLike): TransactionalEmail {
  if (env.LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED !== 'true') return new DisabledTransactionalEmail();
  const apiKey = env.LEADLOOM_RESEND_API_KEY, from = env.LEADLOOM_EMAIL_FROM;
  if (!apiKey || !from || /[\r\n]/.test(from)) throw new Error('LEADLOOM_RESEND_API_KEY and LEADLOOM_EMAIL_FROM are required when transactional email is enabled');
  return new ResendTransactionalEmail({ apiKey, from }, fetchImpl);
}
