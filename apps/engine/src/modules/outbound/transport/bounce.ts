/**
 * DSN (delivery status notification, RFC 3464) / bounce detection for the
 * IMAP reply poller. Deterministic baseline: a bounce is a machine-generated
 * delivery report, NOT a human reply, so it must never reach the keyword
 * reply classifier (a DSN body often quotes the original message and would
 * be misread as, e.g., "interested").
 *
 * Fixture-tested only. Live mailbox reads are not enabled; see
 * docs/plan/IMAP_SYNC.md.
 */
import type { RawInboundMessage } from './imap-poller';

export interface BounceReport {
  /** Recipient addresses parsed from Final-Recipient / Original-Recipient DSN fields. */
  failedRecipients: string[];
  /** RFC 3463 enhanced status code, e.g. "5.1.1". */
  diagnosticCode?: string;
  /** 5.x = hard (permanent), 4.x = soft (temporary). */
  kind: 'hard' | 'soft' | 'unknown';
}

const DSN_SENDERS = /^(mailer-?daemon|postmaster)@/i;
const DSN_SUBJECTS = [
  /delivery status notification/i,
  /undeliverable/i,
  /undelivered mail returned/i,
  /failure notice/i,
  /returned mail/i,
  /message delivery failed/i,
];
/** Signals inside the body that this is a machine delivery report. */
const DSN_BODY_SIGNALS = [
  /message\/delivery-status/i,
  /multipart\/report/i,
  /^Action:\s*failed\b/im,
  /^Final-Recipient:/im,
  /this is an? (automated|automatic) (message|notification)/i,
];

const FINAL_RECIPIENT_RE = /^(?:Final-Recipient|Original-Recipient):\s*(?:rfc822|x-[^;]+)?;?\s*(\S+@\S+)\s*$/gim;
const STATUS_RE = /^Status:\s*(\d\.\d+\.\d+)/im;
const DIAGNOSTIC_RE = /Diagnostic-Code:\s*[^;\n]*?(\d\.\d+\.\d+)/im;

/**
 * Returns a BounceReport when the message looks like a DSN, else null.
 * Requires at least two independent DSN signals (sender/subject/body) so an
 * ordinary human reply that happens to quote one phrase is not misclassified.
 */
export function detectBounce(raw: Pick<RawInboundMessage, 'fromEmail' | 'subject' | 'bodyText'>): BounceReport | null {
  let signals = 0;
  if (DSN_SENDERS.test(raw.fromEmail.trim())) signals++;
  if (DSN_SUBJECTS.some((p) => p.test(raw.subject))) signals++;
  const body = raw.bodyText ?? '';
  const bodySignals = DSN_BODY_SIGNALS.some((p) => p.test(body));
  if (bodySignals) signals++;
  if (signals < 2) return null;

  const failedRecipients = [...body.matchAll(FINAL_RECIPIENT_RE)].map((m) => m[1].toLowerCase());
  const status = STATUS_RE.exec(body)?.[1] ?? DIAGNOSTIC_RE.exec(body)?.[1];
  const kind: BounceReport['kind'] = status?.startsWith('5.') ? 'hard' : status?.startsWith('4.') ? 'soft' : 'unknown';
  return { failedRecipients, diagnosticCode: status, kind };
}
