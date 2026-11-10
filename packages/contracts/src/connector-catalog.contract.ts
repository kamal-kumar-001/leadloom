import { z } from 'zod';

export const ConnectorIdSchema = z.enum([
  'apollo',
  'hunter',
  'dropcontact',
  'pdl',
  'zerobounce',
  'neverbounce',
  'serper',
  'openai',
  'anthropic',
  'ollama',
]);
export type ConnectorId = z.infer<typeof ConnectorIdSchema>;

export const ConnectorCapabilitySchema = z.enum([
  'person_enrich',
  'company_enrich',
  'email_verify',
  'search',
  'ai_chat',
  'ai_completion',
]);
export type ConnectorCapability = z.infer<typeof ConnectorCapabilitySchema>;

export const ConnectorCatalogItemSchema = z.object({
  id: ConnectorIdSchema,
  label: z.string().min(1),
  description: z.string(),
  capabilities: z.array(ConnectorCapabilitySchema).min(1),
  needsKey: z.boolean(),
  localOnly: z.boolean(),
  authHeaderName: z.string().optional(),
  docsUrl: z.string().url().optional(),
  verification: z.literal('fixture-tested').default('fixture-tested'),
});
export type ConnectorCatalogItem = z.infer<typeof ConnectorCatalogItemSchema>;

export const ConnectorCatalogSchema = z.array(ConnectorCatalogItemSchema);
export type ConnectorCatalog = z.infer<typeof ConnectorCatalogSchema>;

/**
 * Builds the canonical catalog of the 10 LeadLoom connectors for UI hubs and registration.
 */
export function buildConnectorCatalog(): ConnectorCatalog {
  return [
    {
      id: 'apollo',
      label: 'Apollo.io',
      description: 'B2B people and company search and enrichment via people/match endpoint.',
      capabilities: ['person_enrich', 'email_verify'],
      needsKey: true,
      localOnly: false,
      authHeaderName: 'X-Api-Key',
      docsUrl: 'https://docs.apollo.io',
      verification: 'fixture-tested',
    },
    {
      id: 'hunter',
      label: 'Hunter.io',
      description: 'Domain email finder and verification with confidence scoring.',
      capabilities: ['person_enrich', 'email_verify'],
      needsKey: true,
      localOnly: false,
      authHeaderName: 'X-API-KEY',
      docsUrl: 'https://hunter.io/api-documentation',
      verification: 'fixture-tested',
    },
    {
      id: 'dropcontact',
      label: 'Dropcontact',
      description: 'Asynchronous B2B email enrichment with nominative qualification.',
      capabilities: ['person_enrich', 'company_enrich', 'email_verify'],
      needsKey: true,
      localOnly: false,
      authHeaderName: 'X-Access-Token',
      docsUrl: 'https://developer.dropcontact.com',
      verification: 'fixture-tested',
    },
    {
      id: 'pdl',
      label: 'People Data Labs',
      description: 'Enterprise person profile enrichment by work email or name.',
      capabilities: ['person_enrich', 'company_enrich'],
      needsKey: true,
      localOnly: false,
      authHeaderName: 'X-Api-Key',
      docsUrl: 'https://docs.peopledatalabs.com',
      verification: 'fixture-tested',
    },
    {
      id: 'zerobounce',
      label: 'ZeroBounce',
      description: 'Email address deliverability validation with MX and disposable checks.',
      capabilities: ['email_verify'],
      needsKey: true,
      localOnly: false,
      docsUrl: 'https://www.zerobounce.net/docs',
      verification: 'fixture-tested',
    },
    {
      id: 'neverbounce',
      label: 'NeverBounce',
      description: 'Single and batch email validation via v4.2 check endpoint.',
      capabilities: ['email_verify'],
      needsKey: true,
      localOnly: false,
      docsUrl: 'https://neverbounce.com/api',
      verification: 'fixture-tested',
    },
    {
      id: 'serper',
      label: 'Serper (Google Search)',
      description: 'Fast Google search API for discovery and social profile research.',
      capabilities: ['search'],
      needsKey: true,
      localOnly: false,
      authHeaderName: 'X-API-KEY',
      docsUrl: 'https://serper.dev',
      verification: 'fixture-tested',
    },
    {
      id: 'openai',
      label: 'OpenAI',
      description: 'Cloud LLM chat completions for lead summarization and research.',
      capabilities: ['ai_chat', 'ai_completion'],
      needsKey: true,
      localOnly: false,
      authHeaderName: 'Authorization',
      docsUrl: 'https://platform.openai.com/docs',
      verification: 'fixture-tested',
    },
    {
      id: 'anthropic',
      label: 'Anthropic Claude',
      description: 'Claude 3.5 Sonnet messages for deep lead analysis and synthesis.',
      capabilities: ['ai_chat', 'ai_completion'],
      needsKey: true,
      localOnly: false,
      authHeaderName: 'x-api-key',
      docsUrl: 'https://docs.anthropic.com',
      verification: 'fixture-tested',
    },
    {
      id: 'ollama',
      label: 'Ollama (Local LLM)',
      description: 'Local private models (Llama 3, Mistral) with $0 spend and zero external egress.',
      capabilities: ['ai_chat', 'ai_completion'],
      needsKey: false,
      localOnly: true,
      docsUrl: 'https://ollama.com',
      verification: 'fixture-tested',
    },
  ];
}
