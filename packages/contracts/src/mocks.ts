import { TableMetadata } from './grid.contract';
import { PreFlightEstimateResponse } from './waterfall.contract';
import { ValidationScorecardResponse } from './validation.contract';
import { MailboxHealthStatus } from './outbound.contract';

export const MOCK_TABLE_METADATA: TableMetadata = {
  id: '00000000-0000-4000-8000-000000000001',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  name: 'Series A DevOps & Infrastructure Targets',
  rowCount: 1420,
  columns: [
    {
      id: '00000000-0000-4000-8000-000000000101',
      tableId: '00000000-0000-4000-8000-000000000001',
      name: 'Company',
      type: 'text',
      orderIndex: 0,
      width: 180,
      isVisible: true,
      config: {},
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      tableId: '00000000-0000-4000-8000-000000000001',
      name: 'Domain',
      type: 'url',
      orderIndex: 1,
      width: 180,
      isVisible: true,
      config: {},
    },
    {
      id: '00000000-0000-4000-8000-000000000103',
      tableId: '00000000-0000-4000-8000-000000000001',
      name: 'Trigger Signal',
      type: 'intent_signal',
      orderIndex: 2,
      width: 220,
      isVisible: true,
      config: { source: 'github_stars' },
    },
    {
      id: '00000000-0000-4000-8000-000000000104',
      tableId: '00000000-0000-4000-8000-000000000001',
      name: 'Email Waterfall (3)',
      type: 'waterfall',
      orderIndex: 3,
      width: 240,
      isVisible: true,
      config: {
        tiers: ['apollo', 'hunter', 'dropcontact'],
        exitPredicate: 'deliverable',
      },
    },
  ],
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

export const MOCK_PREFLIGHT_RESPONSE: PreFlightEstimateResponse = {
  estimatedCostUSD: 0.96,
  estimatedSeconds: 45,
  totalRows: 240,
  tiers: [
    { tierIndex: 1, provider: 'apollo', unitCostUSD: 0.001, estimatedHitRate: 0.58 },
    { tierIndex: 2, provider: 'hunter', unitCostUSD: 0.003, estimatedHitRate: 0.28 },
    { tierIndex: 3, provider: 'dropcontact', unitCostUSD: 0.02, estimatedHitRate: 0.10 },
  ],
  guaranteeNotice: 'Zero unnecessary external API calls guaranteed via early-exit short-circuiting',
};

export const MOCK_VALIDATION_SCORECARD: ValidationScorecardResponse = {
  experimentId: '22222222-2222-4222-8222-222222222222',
  hypothesis: 'Automated Kubernetes cost-cutter for Series A startups',
  verdict: 'high_pull',
  verdictScore: 84.5,
  metrics: {
    visitors: 240,
    pageConversions: 18,
    pageConversionRate: 0.075,
    outreachSent: 120,
    replies: 10,
    replyRate: 0.083,
    positiveReplies: 6,
    positiveResonanceRate: 0.60,
    waitlistCount: 18,
  },
  actionableSummary: 'High customer pull detected. 60% of replies confirmed AWS EKS bill shock. Recommend building MVP.',
  pageUrl: 'https://leadloom.com/v/k8s-cutter',
  sequenceSubject: 'Quick question about {{company}}\'s Kubernetes clusters',
  sequenceBody: 'Hey {{first_name}}, noticed you are scaling platform engineering at {{company}}...',
};

export const MOCK_MAILBOX_HEALTH: MailboxHealthStatus[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'alex-outreach@loom.dev',
    spfStatus: 'verified',
    dkimStatus: 'verified',
    dmarcStatus: 'verified',
    healthScore: 98,
    dailySendLimit: 35,
    sentToday: 18,
    isPaused: false,
    lastHealthCheckAt: '2026-11-10T12:30:00.000Z',
  },
];
