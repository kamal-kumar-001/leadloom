import { createHmac } from 'node:crypto';
import type { OutreachReplyClassification } from '@leadloom/contracts';

/**
 * RFC 8058 one-click List-Unsubscribe support plus a deterministic keyword
 * baseline for reply classification. The AI researcher module owns deeper
 * classification later; this baseline keeps unsubscribe compliance
 * deterministic and testable.
 */
export interface UnsubscribeLinkInput {
  /** Public base URL of the suppression endpoint, e.g. https://api.example.com/outbound/unsubscribe */
  baseUrl: string;
  campaignId: string;
  recipientEmail: string;
  /** HMAC key so suppression links are unforgeable without a login. */
  signingKey: Buffer;
}

export function buildUnsubscribeToken(input: UnsubscribeLinkInput): string {
  if (input.signingKey.length < 16) throw new Error('Unsubscribe signing key must have at least 16 bytes');
  const payload = `${input.campaignId}:${input.recipientEmail.toLowerCase()}`;
  return createHmac('sha256', input.signingKey).update(payload).digest('base64url');
}

export function buildListUnsubscribeHeaders(input: UnsubscribeLinkInput): Record<string, string> {
  const token = buildUnsubscribeToken(input);
  const email = encodeURIComponent(input.recipientEmail.toLowerCase());
  const url = `${input.baseUrl}?c=${encodeURIComponent(input.campaignId)}&e=${email}&t=${token}`;
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

const UNSUBSCRIBE_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\bstop (emailing|contacting|sending)\b/i,
  /\bopt[ -]?out\b/i,
  /\btake me off\b/i,
];
const OOO_PATTERNS = [
  /\bout of (the )?office\b/i,
  /\bautomatic reply\b/i,
  /\bauto-?reply\b/i,
  /\bon (vacation|leave|holiday)\b/i,
  /\baway from (my )?(desk|email)\b/i,
];
const INTERESTED_PATTERNS = [
  /\b(sounds|looks) (good|great|interesting)\b/i,
  /\blet'?s (talk|chat|schedule|book)\b/i,
  /\binterested\b/i,
  /\bsend (me )?(over )?(the )?(deck|details|pricing|info)\b/i,
  /\bdemo\b/i,
];
const OBJECTION_PATTERNS = [
  /\bnot interested\b/i,
  /\bno thanks?\b/i,
  /\btoo expensive\b/i,
  /\b(already|we) use[sd]?\b/i,
  /\bnot a (good )?(fit|priority)\b/i,
];

export interface ReplyClassificationResult {
  classification: OutreachReplyClassification;
  confidence: number;
}

/**
 * Deterministic keyword baseline. Unsubscribe wins over every other signal:
 * compliance is never overridden by a positive-sounding keyword.
 */
export function classifyReply(bodyText: string): ReplyClassificationResult {
  const text = bodyText ?? '';
  if (UNSUBSCRIBE_PATTERNS.some((p) => p.test(text))) return { classification: 'unsubscribe', confidence: 0.95 };
  if (OOO_PATTERNS.some((p) => p.test(text))) return { classification: 'out_of_office', confidence: 0.9 };
  if (OBJECTION_PATTERNS.some((p) => p.test(text))) return { classification: 'objection', confidence: 0.7 };
  if (INTERESTED_PATTERNS.some((p) => p.test(text))) return { classification: 'interested', confidence: 0.6 };
  return { classification: 'neutral', confidence: 0.3 };
}
