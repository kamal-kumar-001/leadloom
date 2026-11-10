import { describe, it, expect } from 'vitest';
import {
  createDefaultConnectorRegistry,
  ConnectorRegistry,
  ApolloConnector,
  HunterConnector,
  DropcontactConnector,
  PdlConnector,
  ZeroBounceConnector,
  NeverBounceConnector,
  SerperConnector,
  OpenAiConnector,
  AnthropicConnector,
  OllamaConnector,
  ConnectorContext,
} from '../index';

function mockFetch(status: number, body: unknown): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

function mockThrowFetch(error: Error): typeof fetch {
  return (async () => {
    throw error;
  }) as unknown as typeof fetch;
}

describe('Connector SDK & Registry', () => {
  it('registers and exposes the canonical 10 public connectors', () => {
    const registry = createDefaultConnectorRegistry();
    const ids = registry.list().map((c) => c.id);

    expect(ids).toEqual([
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

    expect(registry.has('apollo')).toBe(true);
    expect(registry.has('hunter')).toBe(true);
    expect(registry.has('dropcontact')).toBe(true);
    expect(registry.has('pdl')).toBe(true);
    expect(registry.has('zerobounce')).toBe(true);
    expect(registry.has('neverbounce')).toBe(true);
    expect(registry.has('serper')).toBe(true);
    expect(registry.has('openai')).toBe(true);
    expect(registry.has('anthropic')).toBe(true);
    expect(registry.has('ollama')).toBe(true);
  });

  it('filters connectors by capability', () => {
    const registry = createDefaultConnectorRegistry();
    const enrichers = registry.findByCapability('person_enrich').map((c) => c.id);
    expect(enrichers).toContain('apollo');
    expect(enrichers).toContain('hunter');
    expect(enrichers).toContain('dropcontact');
    expect(enrichers).toContain('pdl');

    const verifiers = registry.findByCapability('email_verify').map((c) => c.id);
    expect(verifiers).toContain('zerobounce');
    expect(verifiers).toContain('neverbounce');
    expect(verifiers).toContain('hunter');

    const searchers = registry.findByCapability('search').map((c) => c.id);
    expect(searchers).toEqual(['serper']);

    const aiModels = registry.findByCapability('ai_chat').map((c) => c.id);
    expect(aiModels).toContain('openai');
    expect(aiModels).toContain('anthropic');
    expect(aiModels).toContain('ollama');
  });

  it('strictly returns MISSING_CREDENTIAL when no key is present (never fakes success)', async () => {
    const registry = createDefaultConnectorRegistry();
    const emptyCtx: ConnectorContext = {};

    const apollo = registry.get<any, any>('apollo')!;
    const apolloRes = await apollo.run({ domain: 'example.com' }, emptyCtx);
    expect(apolloRes.success).toBe(false);
    expect(apolloRes.error?.code).toBe('MISSING_CREDENTIAL');

    const hunter = registry.get<any, any>('hunter')!;
    const hunterRes = await hunter.run({ domain: 'example.com' }, emptyCtx);
    expect(hunterRes.success).toBe(false);
    expect(hunterRes.error?.code).toBe('MISSING_CREDENTIAL');

    const dropcontact = registry.get<any, any>('dropcontact')!;
    const dropcontactRes = await dropcontact.run({ website: 'example.com' }, emptyCtx);
    expect(dropcontactRes.success).toBe(false);
    expect(dropcontactRes.error?.code).toBe('MISSING_CREDENTIAL');

    const pdl = registry.get<any, any>('pdl')!;
    const pdlRes = await pdl.run({ email: 'test@example.com' }, emptyCtx);
    expect(pdlRes.success).toBe(false);
    expect(pdlRes.error?.code).toBe('MISSING_CREDENTIAL');

    const zerobounce = registry.get<any, any>('zerobounce')!;
    const zbRes = await zerobounce.run({ email: 'test@example.com' }, emptyCtx);
    expect(zbRes.success).toBe(false);
    expect(zbRes.error?.code).toBe('MISSING_CREDENTIAL');

    const neverbounce = registry.get<any, any>('neverbounce')!;
    const nbRes = await neverbounce.run({ email: 'test@example.com' }, emptyCtx);
    expect(nbRes.success).toBe(false);
    expect(nbRes.error?.code).toBe('MISSING_CREDENTIAL');

    const serper = registry.get<any, any>('serper')!;
    const serperRes = await serper.run({ query: 'acme corp' }, emptyCtx);
    expect(serperRes.success).toBe(false);
    expect(serperRes.error?.code).toBe('MISSING_CREDENTIAL');

    const openai = registry.get<any, any>('openai')!;
    const openaiRes = await openai.run({ messages: [{ role: 'user', content: 'hi' }] }, emptyCtx);
    expect(openaiRes.success).toBe(false);
    expect(openaiRes.error?.code).toBe('MISSING_CREDENTIAL');

    const anthropic = registry.get<any, any>('anthropic')!;
    const anthropicRes = await anthropic.run({ messages: [{ role: 'user', content: 'hi' }] }, emptyCtx);
    expect(anthropicRes.success).toBe(false);
    expect(anthropicRes.error?.code).toBe('MISSING_CREDENTIAL');
  });
});

describe('Individual Connector Implementations (Recorded Fixtures)', () => {
  it('ApolloConnector: parses verified match and handles rate limit', async () => {
    const connector = new ApolloConnector();

    // 1. Success match fixture
    const successFixture = {
      person: {
        email: 'alex@apollo.io',
        email_status: 'verified',
        first_name: 'Alex',
        last_name: 'Zheng',
        title: 'VP of Engineering',
        organization: { name: 'Apollo.io' },
      },
    };
    const ctx: ConnectorContext = {
      apiKey: 'test-apollo-key',
      fetch: mockFetch(200, successFixture),
    };

    const res = await connector.run({ domain: 'apollo.io', firstName: 'Alex', lastName: 'Zheng' }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.email).toBe('alex@apollo.io');
    expect(res.data?.emailStatus).toBe('verified');
    expect(res.data?.confidence).toBe(0.95);
    expect(res.costMicrocents).toBe(100);

    // 2. Rate limit fixture
    const rateLimitCtx: ConnectorContext = {
      apiKey: 'test-apollo-key',
      fetch: mockFetch(429, { error: 'Rate limit exceeded' }),
    };
    const rateLimitRes = await connector.run({ domain: 'apollo.io' }, rateLimitCtx);
    expect(rateLimitRes.success).toBe(false);
    expect(rateLimitRes.error?.code).toBe('RATE_LIMITED');
    expect(rateLimitRes.error?.retryable).toBe(true);
  });

  it('HunterConnector: parses email finder result and confidence score', async () => {
    const connector = new HunterConnector();
    const fixture = {
      data: {
        email: 'alexis@hunter.io',
        score: 92,
        verification: { status: 'valid' },
        position: 'CEO',
        company: 'Hunter',
      },
    };

    const ctx: ConnectorContext = {
      apiKey: 'test-hunter-key',
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ domain: 'hunter.io', firstName: 'Alexis' }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.email).toBe('alexis@hunter.io');
    expect(res.data?.score).toBe(92);
    expect(res.data?.confidence).toBe(0.92);
    expect(res.data?.verificationStatus).toBe('valid');
  });

  it('DropcontactConnector: parses batch result with qualification', async () => {
    const connector = new DropcontactConnector();
    const fixture = {
      data: [
        {
          email: [{ email: 'denis@dropcontact.io', qualification: 'nominative' }],
          company: 'Dropcontact',
          website: 'dropcontact.io',
          siren: '820491029',
        },
      ],
    };

    const ctx: ConnectorContext = {
      apiKey: 'test-dropcontact-key',
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ website: 'dropcontact.io', firstName: 'Denis' }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.email).toBe('denis@dropcontact.io');
    expect(res.data?.qualification).toBe('nominative');
    expect(res.data?.confidence).toBe(0.95);
    expect(res.data?.siren).toBe('820491029');
  });

  it('PdlConnector: parses person enrichment data', async () => {
    const connector = new PdlConnector();
    const fixture = {
      data: {
        full_name: 'Sean Thorne',
        work_email: 'sean@peopledatalabs.com',
        personal_emails: ['sean.personal@example.com'],
        job_title: 'CEO & Co-Founder',
        job_company_name: 'People Data Labs',
        linkedin_url: 'linkedin.com/in/seanthorne',
      },
    };

    const ctx: ConnectorContext = {
      apiKey: 'test-pdl-key',
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ email: 'sean@peopledatalabs.com' }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.fullName).toBe('Sean Thorne');
    expect(res.data?.workEmail).toBe('sean@peopledatalabs.com');
    expect(res.data?.personalEmails).toContain('sean.personal@example.com');
    expect(res.data?.confidence).toBe(0.95);
  });

  it('ZeroBounceConnector: parses email verification status', async () => {
    const connector = new ZeroBounceConnector();
    const fixture = {
      status: 'valid',
      sub_status: '',
      account: 'sales',
      domain: 'leadloom.com',
      free_email: false,
      mx_found: true,
    };

    const ctx: ConnectorContext = {
      apiKey: 'test-zb-key',
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ email: 'sales@leadloom.com' }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.status).toBe('valid');
    expect(res.data?.mxFound).toBe(true);
    expect(res.data?.confidence).toBe(1.0);
  });

  it('NeverBounceConnector: parses verification result and flags', async () => {
    const connector = new NeverBounceConnector();
    const fixture = {
      status: 'success',
      result: 'valid',
      flags: ['has_dns', 'has_dns_mx'],
      suggested_correction: '',
    };

    const ctx: ConnectorContext = {
      apiKey: 'test-nb-key',
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ email: 'founder@acme.corp' }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.result).toBe('valid');
    expect(res.data?.flags).toContain('has_dns_mx');
    expect(res.data?.confidence).toBe(1.0);
  });

  it('SerperConnector: executes search and extracts organic results', async () => {
    const connector = new SerperConnector();
    const fixture = {
      searchParameters: { q: 'Acme Corp Series A' },
      organic: [
        {
          title: 'Acme Corp Raises $15M Series A',
          link: 'https://techcrunch.com/2026/acme-series-a',
          snippet: 'Acme Corp announced their $15M Series A round...',
          position: 1,
        },
      ],
      knowledgeGraph: {
        title: 'Acme Corp',
        type: 'Software company',
      },
    };

    const ctx: ConnectorContext = {
      apiKey: 'test-serper-key',
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ query: 'Acme Corp Series A' }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.organic.length).toBe(1);
    expect(res.data?.organic[0].title).toBe('Acme Corp Raises $15M Series A');
    expect(res.data?.knowledgeGraph?.title).toBe('Acme Corp');
  });

  it('OpenAiConnector: parses chat completion and usage telemetry', async () => {
    const connector = new OpenAiConnector();
    const fixture = {
      id: 'chatcmpl-test',
      model: 'gpt-4o-mini',
      choices: [
        {
          message: { content: 'Candidate works on Kubernetes infrastructure.' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 25,
        completion_tokens: 12,
        total_tokens: 37,
      },
    };

    const ctx: ConnectorContext = {
      apiKey: 'sk-test-openai-key',
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ messages: [{ role: 'user', content: 'Analyze lead' }] }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.content).toBe('Candidate works on Kubernetes infrastructure.');
    expect(res.data?.usage?.totalTokens).toBe(37);
    expect(res.costMicrocents).toBeGreaterThan(0);
  });

  it('AnthropicConnector: parses message response and usage tokens', async () => {
    const connector = new AnthropicConnector();
    const fixture = {
      id: 'msg_test',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: 'Verified: Lead has intent signals for cloud migration.',
        },
      ],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 30,
        output_tokens: 15,
      },
    };

    const ctx: ConnectorContext = {
      apiKey: 'sk-ant-test-key',
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ messages: [{ role: 'user', content: 'Classify lead' }] }, ctx);
    expect(res.success).toBe(true);
    expect(res.data?.content).toBe('Verified: Lead has intent signals for cloud migration.');
    expect(res.data?.usage?.inputTokens).toBe(30);
  });

  it('OllamaConnector: runs without API key, reports $0 cost and handles unreachable daemon', async () => {
    const connector = new OllamaConnector();
    expect(connector.auth.type).toBe('none');

    // 1. Successful local generation
    const fixture = {
      model: 'llama3.2',
      message: { content: 'Local synthesis result' },
      total_duration: 450000000,
      eval_count: 24,
    };

    const localCtx: ConnectorContext = {
      fetch: mockFetch(200, fixture),
    };

    const res = await connector.run({ messages: [{ role: 'user', content: 'Summarize profile' }] }, localCtx);
    expect(res.success).toBe(true);
    expect(res.data?.content).toBe('Local synthesis result');
    expect(res.costMicrocents).toBe(0);

    // 2. Unreachable local server
    const offlineCtx: ConnectorContext = {
      fetch: mockThrowFetch(new Error('ECONNREFUSED 127.0.0.1:11434')),
    };

    const offlineRes = await connector.run({ messages: [{ role: 'user', content: 'Test' }] }, offlineCtx);
    expect(offlineRes.success).toBe(false);
    expect(offlineRes.error?.code).toBe('NETWORK_ERROR');
    expect(offlineRes.error?.message).toContain('Ollama local daemon unreachable');
  });
});
