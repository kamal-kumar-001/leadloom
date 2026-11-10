import type { PlanDefinition } from '@leadloom/contracts';

/**
 * DEVELOPMENT FIXTURE catalog (plan names and caps are NOT approved commercial terms). Prices are null on purpose: pricing is a product
 * decision that has not been made. Edit this data (or load the same shape from
 * config) to change plans; enforcement code does not change.
 */
export const DEFAULT_PLANS: PlanDefinition[] = [
  { id: 'free', name: 'Free', priceMonthlyUsd: null,
    features: { waterfall: true, validator: true, ai_researcher: false, csv_import: true, mailbox_connect: false, outbound_sending: false, api_access: false, team_members: false },
    limits: { seats: 1, mailboxes: 0, tables: 3, enrichment_credits_per_month: 100, emails_per_month: 0 } },
  { id: 'pro', name: 'Pro', priceMonthlyUsd: null,
    features: { waterfall: true, validator: true, ai_researcher: true, csv_import: true, mailbox_connect: true, outbound_sending: true, api_access: true, team_members: true },
    limits: { seats: 5, mailboxes: 5, tables: 50, enrichment_credits_per_month: 5000, emails_per_month: 5000 } },
];
