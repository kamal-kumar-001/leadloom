import { ProductProfile } from './types';

/**
 * Seed profiles for Kamal's products. Terms are grounded in each product's
 * actual capabilities (memory entity files + repo docs, Nov 19 2026) so a
 * match never implies a capability the product does not have. Keep claims
 * narrow: DMPilot is Instagram-only; FeeFree is UPI/India, pilot-scale;
 * BakeryPOS targets bakeries/cafes; Leadloom is GTM lead discovery/outreach.
 */
export const PRODUCT_PROFILES: ProductProfile[] = [
  {
    productId: 'dmpilot',
    displayName: 'DMPilot',
    // Actual: Instagram comment-to-DM, keyword auto-reply, Welcome DM,
    // follow checks, message variations, Reply Desk, multi-account analytics.
    problemPhrases: [
      'instagram dm automation',
      'comment to dm',
      'auto reply to instagram comments',
      'instagram auto reply',
      'manage instagram dms',
    ],
    keywords: ['instagram inbox', 'creators', 'instagram comments', 'reply desk'],
  },
  {
    productId: 'feefree',
    displayName: 'FeeFree',
    // Actual: UPI QR checkout with payment detection from bank alert
    // email/SMS; multi-tenant gateway for small Indian merchants (pilot).
    problemPhrases: [
      'upi payment gateway',
      'upi checkout',
      'razorpay alternative',
      'payment confirmation without webhook',
      'accept upi payments',
    ],
    keywords: ['upi', 'payment gateway', 'india payments', 'small merchant'],
  },
  {
    productId: 'bakerypos',
    displayName: 'BakeryPOS',
    // Actual: bakery/cafe POS - billing, recipe ingredient deduction,
    // batches, wastage, purchasing, kitchen display, WhatsApp PDF invoices.
    problemPhrases: [
      'bakery pos',
      'cafe pos',
      'bakery billing software',
      'recipe costing',
      'ingredient inventory tracking',
    ],
    keywords: ['kitchen display', 'wastage', 'cafe billing', 'whatsapp invoice'],
  },
  {
    productId: 'leadloom',
    displayName: 'Leadloom',
    // Actual (in build): GTM lead discovery + outreach with human-approved
    // replies and signup/conversation tracking.
    problemPhrases: [
      'find leads on reddit',
      'lead generation tool',
      'gtm tool',
      'find people asking for my product',
      'social listening for leads',
    ],
    keywords: ['lead discovery', 'outreach', 'prospect', 'social listening'],
  },
];
