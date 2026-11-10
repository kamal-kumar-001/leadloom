import { describe, it, expect, vi } from 'vitest';
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
  validateAndResolveBaseUrl,
  redactSecrets,
  resolveFetch,
} from '../index';

describe('Connector SDK & Registry', () => {
  it('registers and exposes the canonical 10 public connectors with fixture-tested label', () => {
    const registry = createDefaultConnectorRegistry();
    const connectors = registry.list();
    const ids = connectors.map((c) => c.id);

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

    // All connectors must be explicitly labeled fixture-tested
    for (const c of connectors) {
      expect(c.verification).toBe('fixture-tested');
    }
  });

  it('fails closed when credentials are missing on auth-requiring connectors', async () => {
    const registry = createDefaultConnectorRegistry();
    const keyRequiring = [
      'apollo',
      'hunter',
      'dropcontact',
      'pdl',
      'zerobounce',
      'neverbounce',
      'serper',
      'openai',
      'anthropic',
    ];

    for (const id of keyRequiring) {
      const connector = registry.get(id);
      expect(connector).toBeDefined();

      const result = await connector!.run({ email: 'test@example.com', query: 'test', messages: [] } as any, {});
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_CREDENTIAL');
    }
  });
});

describe('Security Controls', () => {
  describe('Base URL Redirect Protection', () => {
    it('rejects non-HTTPS URLs for external vendor connectors', async () => {
      const apollo = new ApolloConnector();
      const res = await apollo.run(
        { email: 'test@example.com' },
        {
          apiKey: 'test-key',
          baseUrl: 'http://api.apollo.io',
          fetch: vi.fn() as any,
        }
      );
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_BASE_URL');
      expect(res.error?.message).toContain('must use HTTPS');
    });

    it('rejects foreign hostname redirects for external vendors', async () => {
      const hunter = new HunterConnector();
      const res = await hunter.run(
        { domain: 'stripe.com' },
        {
          apiKey: 'test-key',
          baseUrl: 'https://attacker-controlled-host.com',
          fetch: vi.fn() as any,
        }
      );
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_BASE_URL');
      expect(res.error?.message).toContain('must match default vendor host');
    });

    it('allows loopback hostnames for Ollama local daemon', async () => {
      const ollama = new OllamaConnector();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ model: 'llama3', message: { content: 'ok' } }),
      });

      const loopbacks = [
        'http://127.0.0.1:11434',
        'http://localhost:11434',
        'http://[::1]:11434',
        'https://127.0.0.1:8443',
      ];

      for (const base of loopbacks) {
        const res = await ollama.run(
          { messages: [{ role: 'user', content: 'hi' }] },
          { baseUrl: base, fetch: mockFetch as any }
        );
        expect(res.success).toBe(true);
      }
    });

    it('strictly rejects cloud metadata and external IPs for Ollama', async () => {
      const ollama = new OllamaConnector();
      const dangerousUrls = [
        'http://169.254.169.254/latest/meta-data',
        'http://metadata.google.internal/computeMetadata/v1',
        'http://192.168.1.10:11434',
        'http://10.0.0.5:11434',
        'https://remote-ollama.example.com',
      ];

      for (const url of dangerousUrls) {
        const res = await ollama.run(
          { messages: [{ role: 'user', content: 'hi' }] },
          { baseUrl: url, fetch: vi.fn() as any }
        );
        expect(res.success).toBe(false);
        expect(res.error?.code).toBe('INVALID_BASE_URL');
      }
    });
  });

  describe('Redirect Protection (redirect: manual)', () => {
    it('blocks HTTP 302 redirects with redirect: manual and returns PROVIDER_ERROR without following', async () => {
      const sensitiveKey = 'sk-super-secret-apollo-key';
      const apollo = new ApolloConnector();
      let capturedInit: RequestInit | undefined;

      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        capturedInit = init;
        return {
          ok: false,
          status: 302,
          type: 'default',
          headers: new Headers({ Location: 'https://evil-harvest-server.com/steal' }),
        } as unknown as Response;
      });

      const res = await apollo.run(
        { email: 'target@example.com' },
        { apiKey: sensitiveKey, fetch: mockFetch as any }
      );

      expect(capturedInit?.redirect).toBe('manual');
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('PROVIDER_ERROR');
      expect(res.error?.status).toBe(302);
      expect(res.error?.message).toContain('HTTP redirect (302) blocked');
      expect(res.error?.message).not.toContain(sensitiveKey);
    });
  });

  describe('Default-Off Network Disabled Guard', () => {
    it('returns NETWORK_DISABLED when ctx.fetch is omitted and LEADLOOM_CONNECTORS_LIVE_ENABLED != true', async () => {
      const savedEnv = process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;
      try {
        delete process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED;

        const apollo = new ApolloConnector();
        const res = await apollo.run({ email: 'test@example.com' }, { apiKey: 'test-key' });

        expect(res.success).toBe(false);
        expect(res.error?.code).toBe('NETWORK_DISABLED');
        expect(res.error?.message).toContain('Live connector calls are disabled by default');
      } finally {
        if (savedEnv !== undefined) {
          process.env.LEADLOOM_CONNECTORS_LIVE_ENABLED = savedEnv;
        }
      }
    });
  });

  describe('API Key Redaction', () => {
    it('redacts query string API key when NeverBounce encounters a network error', async () => {
      const sensitiveKey = 'secret_neverbounce_token_999';
      const neverbounce = new NeverBounceConnector();
      const throwingFetch = vi.fn().mockRejectedValue(
        new Error(`Connection reset while requesting https://api.neverbounce.com/v4.2/single/check?key=${sensitiveKey}&email=x@example.com`)
      );

      const res = await neverbounce.run(
        { email: 'x@example.com' },
        { apiKey: sensitiveKey, fetch: throwingFetch as any }
      );

      expect(res.success).toBe(false);
      expect(res.error?.message).not.toContain(sensitiveKey);
      expect(res.error?.message).toContain('[REDACTED]');
    });

    it('redacts query string API key when ZeroBounce encounters an error', async () => {
      const sensitiveKey = 'zb_live_secret_key_888';
      const zerobounce = new ZeroBounceConnector();
      const throwingFetch = vi.fn().mockRejectedValue(
        new Error(`Failed to GET https://api.zerobounce.com/v2/validate?api_key=${sensitiveKey}&email=y@example.com`)
      );

      const res = await zerobounce.run(
        { email: 'y@example.com' },
        { apiKey: sensitiveKey, fetch: throwingFetch as any }
      );

      expect(res.success).toBe(false);
      expect(res.error?.message).not.toContain(sensitiveKey);
      expect(res.error?.message).toContain('[REDACTED]');
    });

    it('redacts secrets from helper directly', () => {
      const secret = 'super_secret_auth_token_42';
      const leaked = `Error: Request to https://api.vendor.com/v1?token=${secret} failed with ${secret}`;
      const safe = redactSecrets(leaked, [secret]);
      expect(safe).not.toContain(secret);
      expect(safe).toBe('Error: Request to https://api.vendor.com/v1?token=[REDACTED] failed with [REDACTED]');
    });
  });
});

describe('Documented Vendor Fixtures & Endpoint Contracts', () => {
  it('Apollo: verifies POST https://api.apollo.io/api/v1/people/match with documented fixture', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders: Record<string, string> = {};

    // Documented Apollo fixture from docs.apollo.io
    const apolloDocFixture = {
      person: {
        id: '5849bedf76276d433240e53a',
        first_name: 'Tim',
        last_name: 'Zheng',
        name: 'Tim Zheng',
        linkedin_url: 'https://www.linkedin.com/in/tim-zheng',
        title: 'Founder & CEO',
        email: 'tim@apollo.io',
        email_status: 'verified',
        organization: {
          id: '5e66b6381e0f0a000155b4b1',
          name: 'Apollo.io',
          website_url: 'http://www.apollo.io',
        },
      },
    };

    const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init.method ?? 'GET';
      capturedHeaders = (init.headers ?? {}) as Record<string, string>;
      return {
        ok: true,
        status: 200,
        json: async () => apolloDocFixture,
      };
    });

    const apollo = new ApolloConnector();
    const res = await apollo.run(
      { domain: 'apollo.io', firstName: 'Tim', lastName: 'Zheng' },
      { apiKey: 'apo_key_123', fetch: mockFetch as any }
    );

    expect(capturedUrl).toBe('https://api.apollo.io/api/v1/people/match');
    expect(capturedMethod).toBe('POST');
    expect(capturedHeaders['X-Api-Key']).toBe('apo_key_123');

    expect(res.success).toBe(true);
    expect(res.data?.email).toBe('tim@apollo.io');
    expect(res.data?.emailStatus).toBe('verified');
    expect(res.data?.organizationName).toBe('Apollo.io');
    expect(res.data?.confidence).toBe(0.95);
  });

  it('Dropcontact: models async submit POST /v1/enrich/all followed by GET /v1/enrich/all/{id}', async () => {
    const urlsCalled: string[] = [];
    const methodsCalled: string[] = [];

    // Documented Dropcontact fixtures from developer.dropcontact.com
    const submitFixture = {
      request_id: 'c62e584f-723a-48a8-b615-ca8f8c25785f',
      success: true,
    };
    const getResultFixture = {
      success: true,
      data: [
        {
          first_name: 'Alexandre',
          last_name: 'Cormier',
          email: [
            {
              email: 'alexandre@dropcontact.com',
              qualification: 'nominative',
            },
          ],
          company: 'Dropcontact',
          website: 'dropcontact.com',
          phone: '+33123456789',
        },
      ],
    };

    const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
      urlsCalled.push(url);
      methodsCalled.push(init.method ?? 'GET');
      if (init.method === 'POST') {
        return { ok: true, status: 200, json: async () => submitFixture };
      }
      return { ok: true, status: 200, json: async () => getResultFixture };
    });

    const dropcontact = new DropcontactConnector();
    const res = await dropcontact.run(
      { firstName: 'Alexandre', lastName: 'Cormier', domain: 'dropcontact.com' },
      { apiKey: 'drop_token_xyz', fetch: mockFetch as any }
    );

    expect(urlsCalled[0]).toBe('https://api.dropcontact.com/v1/enrich/all');
    expect(methodsCalled[0]).toBe('POST');
    expect(urlsCalled[1]).toBe(
      'https://api.dropcontact.com/v1/enrich/all/c62e584f-723a-48a8-b615-ca8f8c25785f'
    );
    expect(methodsCalled[1]).toBe('GET');

    expect(res.success).toBe(true);
    expect(res.data?.email).toBe('alexandre@dropcontact.com');
    expect(res.data?.qualification).toBe('nominative');
    expect(res.data?.requestId).toBe('c62e584f-723a-48a8-b615-ca8f8c25785f');
    expect(res.data?.confidence).toBe(0.98);
  });

  it('Dropcontact: returns retryable NOT_READY when submit returns HTTP 200 with success: false', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        error: 'Batch queued or processing',
      }),
    }));

    const dropcontact = new DropcontactConnector();
    const res = await dropcontact.run(
      { firstName: 'Alexandre', lastName: 'Cormier', domain: 'dropcontact.com' },
      { apiKey: 'drop_token_xyz', fetch: mockFetch as any }
    );

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('NOT_READY');
    expect(res.error?.retryable).toBe(true);
    expect(res.data).toBeUndefined();
  });

  it('Dropcontact: returns retryable NOT_READY when fetch returns HTTP 200 with success: false (never success with null email)', async () => {
    const mockFetch = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            request_id: 'c62e584f-723a-48a8-b615-ca8f8c25785f',
            success: true,
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          error: 'Dropcontact results not ready (wait 30s)',
        }),
      };
    });

    const dropcontact = new DropcontactConnector();
    const res = await dropcontact.run(
      { firstName: 'Alexandre', lastName: 'Cormier', domain: 'dropcontact.com' },
      { apiKey: 'drop_token_xyz', fetch: mockFetch as any }
    );

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('NOT_READY');
    expect(res.error?.retryable).toBe(true);
    expect(res.data).toBeUndefined();
  });

  it('NeverBounce: verifies GET https://api.neverbounce.com/v4.2/single/check with documented fixture', async () => {
    let capturedUrl = '';

    // Documented NeverBounce fixture from neverbounce.com/api
    const neverbounceDocFixture = {
      status: 'success',
      result: 'valid',
      flags: ['has_dns', 'has_dns_mx'],
      suggested_correction: '',
      execution_time: 284,
    };

    const mockFetch = vi.fn(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => neverbounceDocFixture };
    });

    const neverbounce = new NeverBounceConnector();
    const res = await neverbounce.run(
      { email: 'valid@example.com' },
      { apiKey: 'nb_key_abc', fetch: mockFetch as any }
    );

    expect(capturedUrl).toContain('https://api.neverbounce.com/v4.2/single/check');
    expect(res.success).toBe(true);
    expect(res.data?.result).toBe('valid');
    expect(res.data?.confidence).toBe(0.95);
  });

  it('ZeroBounce: verifies validation with documented fixture', async () => {
    let capturedUrl = '';

    // Documented ZeroBounce fixture from zerobounce.net/docs
    const zerobounceDocFixture = {
      address: 'john.doe@example.com',
      status: 'valid',
      sub_status: '',
      free_email: false,
      did_you_mean: null,
      account: 'john.doe',
      domain: 'example.com',
      domain_age_days: '1000',
      smtp_provider: 'google',
      mx_found: 'true',
      mx_record: 'mx.example.com',
    };

    const mockFetch = vi.fn(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => zerobounceDocFixture };
    });

    const zerobounce = new ZeroBounceConnector();
    const res = await zerobounce.run(
      { email: 'john.doe@example.com' },
      { apiKey: 'zb_key_123', fetch: mockFetch as any }
    );

    expect(capturedUrl).toContain('https://api.zerobounce.com/v2/validate');
    expect(res.success).toBe(true);
    expect(res.data?.status).toBe('valid');
    expect(res.data?.mxFound).toBe(true);
    expect(res.data?.freeEmail).toBe(false);
  });

  it('Hunter: verifies GET /v2/email-finder with documented fixture', async () => {
    // Documented Hunter.io fixture from hunter.io/api-documentation
    const hunterDocFixture = {
      data: {
        first_name: 'Alexis',
        last_name: 'Tear',
        email: 'alexis@stripe.com',
        score: 92,
        domain: 'stripe.com',
        position: 'General Counsel',
        company: 'Stripe',
        sources: [],
      },
      meta: {
        params: {
          first_name: 'Alexis',
          last_name: 'Tear',
          domain: 'stripe.com',
        },
      },
    };

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => hunterDocFixture,
    }));

    const hunter = new HunterConnector();
    const res = await hunter.run(
      { firstName: 'Alexis', lastName: 'Tear', domain: 'stripe.com' },
      { apiKey: 'hunter_key_123', fetch: mockFetch as any }
    );

    expect(res.success).toBe(true);
    expect(res.data?.email).toBe('alexis@stripe.com');
    expect(res.data?.score).toBe(92);
    expect(res.data?.company).toBe('Stripe');
  });

  it('People Data Labs: verifies POST /v5/person/enrich with documented fixture', async () => {
    // Documented PDL fixture from docs.peopledatalabs.com
    const pdlDocFixture = {
      status: 200,
      data: {
        id: 'qEnOZ5Oh0poWnQ1luFBfVw_0000',
        full_name: 'Sean Thorne',
        first_name: 'Sean',
        last_name: 'Thorne',
        work_email: 'sean@peopledatalabs.com',
        job_title: 'CEO',
        job_company_name: 'People Data Labs',
        job_company_website: 'peopledatalabs.com',
        linkedin_url: 'linkedin.com/in/seanthorne',
      },
    };

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => pdlDocFixture,
    }));

    const pdl = new PdlConnector();
    const res = await pdl.run(
      { email: 'sean@peopledatalabs.com' },
      { apiKey: 'pdl_key_123', fetch: mockFetch as any }
    );

    expect(res.success).toBe(true);
    expect(res.data?.workEmail).toBe('sean@peopledatalabs.com');
    expect(res.data?.jobTitle).toBe('CEO');
    expect(res.data?.companyName).toBe('People Data Labs');
  });

  it('Serper: verifies POST /search with documented fixture', async () => {
    // Documented Serper fixture from serper.dev
    const serperDocFixture = {
      searchParameters: {
        q: 'LeadLoom',
        type: 'search',
      },
      organic: [
        {
          title: 'LeadLoom - Open Core GTM Engine',
          link: 'https://leadloom.dev',
          snippet: 'High performance go-to-market data enrichment engine.',
          position: 1,
        },
      ],
    };

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => serperDocFixture,
    }));

    const serper = new SerperConnector();
    const res = await serper.run(
      { query: 'LeadLoom' },
      { apiKey: 'serper_key_123', fetch: mockFetch as any }
    );

    expect(res.success).toBe(true);
    expect(res.data?.organic).toHaveLength(1);
    expect(res.data?.organic[0].title).toBe('LeadLoom - Open Core GTM Engine');
  });

  it('OpenAI: verifies POST /v1/chat/completions with documented fixture', async () => {
    // Documented OpenAI fixture from platform.openai.com
    const openaiDocFixture = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Lead enrichment summary...',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 20,
        total_tokens: 35,
      },
    };

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => openaiDocFixture,
    }));

    const openai = new OpenAiConnector();
    const res = await openai.run(
      { messages: [{ role: 'user', content: 'Summarize lead' }] },
      { apiKey: 'sk-proj-123', fetch: mockFetch as any }
    );

    expect(res.success).toBe(true);
    expect(res.data?.content).toBe('Lead enrichment summary...');
    expect(res.data?.usage?.totalTokens).toBe(35);
  });

  it('Anthropic: verifies POST /v1/messages with documented fixture', async () => {
    // Documented Anthropic Claude messages fixture from docs.anthropic.com
    const anthropicDocFixture = {
      id: 'msg_01X9DY2AsBoHitErHGvDegY1',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: 'Lead research insights...',
        },
      ],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 25,
        output_tokens: 30,
      },
    };

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => anthropicDocFixture,
    }));

    const anthropic = new AnthropicConnector();
    const res = await anthropic.run(
      { messages: [{ role: 'user', content: 'Analyze lead' }] },
      { apiKey: 'sk-ant-123', fetch: mockFetch as any }
    );

    expect(res.success).toBe(true);
    expect(res.data?.content).toBe('Lead research insights...');
    expect(res.data?.usage?.outputTokens).toBe(30);
  });

  it('Ollama: verifies POST /api/chat with documented local fixture ($0 spend)', async () => {
    // Documented Ollama /api/chat response
    const ollamaDocFixture = {
      model: 'llama3',
      created_at: '2023-08-04T19:22:45.499127Z',
      message: {
        role: 'assistant',
        content: 'Local model summary',
      },
      done: true,
      total_duration: 4883583458,
      prompt_eval_count: 26,
      eval_count: 35,
    };

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ollamaDocFixture,
    }));

    const ollama = new OllamaConnector();
    const res = await ollama.run(
      { messages: [{ role: 'user', content: 'Summarize locally' }] },
      { fetch: mockFetch as any }
    );

    expect(res.success).toBe(true);
    expect(res.costMicrocents).toBe(0);
    expect(res.data?.content).toBe('Local model summary');
  });

  describe('Raw Payload Privacy & PII Isolation', () => {
    const testApiKey = 'secret_test_key_xyz987';
    const testEmail = 'lead.target@enterprise.com';

    it('Dropcontact: raw contains only allowlisted non-personal metadata, no email or key', async () => {
      const dropcontact = new DropcontactConnector();
      const mockFetch = vi.fn(async (_url: string, init: RequestInit) => {
        if (init.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              request_id: 'c62e584f-723a-48a8-b615-ca8f8c25785f',
              success: true,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [
              {
                first_name: 'Alexandre',
                last_name: 'Cormier',
                email: [{ email: testEmail, qualification: 'nominative' }],
              },
            ],
          }),
        };
      });

      const res = await dropcontact.run(
        { email: testEmail, company: 'Acme' },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({
        success: true,
        requestId: 'c62e584f-723a-48a8-b615-ca8f8c25785f',
      });
    });

    it('Hunter: raw contains only allowlisted non-personal metadata, no email or key', async () => {
      const hunter = new HunterConnector();
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            first_name: 'John',
            last_name: 'Doe',
            email: testEmail,
            score: 85,
            verification: { status: 'valid' },
            sources: [],
          },
        }),
      }));

      const res = await hunter.run(
        { domain: 'enterprise.com', firstName: 'John', lastName: 'Doe' },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({
        score: 85,
        verificationStatus: 'valid',
      });
    });

    it('People Data Labs: raw contains only allowlisted non-personal metadata, no email or key', async () => {
      const pdl = new PdlConnector();
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          data: {
            full_name: 'John Doe',
            work_email: testEmail,
            personal_emails: ['personal@gmail.com'],
          },
        }),
      }));

      const res = await pdl.run(
        { email: testEmail },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({ status: 200 });
    });

    it('ZeroBounce: raw contains only allowlisted non-personal metadata, no email or key', async () => {
      const zb = new ZeroBounceConnector();
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          address: testEmail,
          account: 'lead.target',
          domain: 'enterprise.com',
          status: 'valid',
          sub_status: '',
          free_email: false,
          mx_found: 'true',
        }),
      }));

      const res = await zb.run(
        { email: testEmail },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({
        status: 'valid',
        subStatus: '',
        domain: 'enterprise.com',
        freeEmail: false,
        mxFound: true,
      });
    });

    it('NeverBounce: raw contains only allowlisted non-personal metadata, no email or key', async () => {
      const nb = new NeverBounceConnector();
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          result: 'valid',
          flags: ['has_dns_mx'],
          suggested_correction: 'corrected@enterprise.com',
          execution_time: 120,
        }),
      }));

      const res = await nb.run(
        { email: testEmail },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({
        status: 'success',
        result: 'valid',
        flags: ['has_dns_mx'],
        executionTime: 120,
      });
    });

    it('Serper: raw contains only allowlisted non-personal metadata, no email or key', async () => {
      const serper = new SerperConnector();
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          searchParameters: { q: `find ${testEmail}` },
          organic: [{ title: 'Profile', link: 'https://example.com' }],
        }),
      }));

      const res = await serper.run(
        { query: `find ${testEmail}` },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({ totalResults: 1 });
    });

    it('Anthropic: raw contains only allowlisted non-personal metadata, no prompt/email or key', async () => {
      const anthropic = new AnthropicConnector();
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'msg_123',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: `Lead email is ${testEmail}` }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      }));

      const res = await anthropic.run(
        { messages: [{ role: 'user', content: `Analyze ${testEmail}` }] },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({
        id: 'msg_123',
        model: 'claude-3-5-sonnet-20241022',
        stopReason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      });
    });

    it('Apollo: raw contains only allowlisted non-personal metadata, no email or key', async () => {
      const apollo = new ApolloConnector();
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          person: {
            first_name: 'Tim',
            last_name: 'Cook',
            email: testEmail,
            email_status: 'verified',
            organization: { name: 'Apple' },
          },
        }),
      }));

      const res = await apollo.run(
        { email: testEmail, domain: 'apple.com' },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({
        emailStatus: 'verified',
        confidence: 0.95,
      });
    });

    it('OpenAI: raw contains only allowlisted non-personal metadata, no prompt/email or key', async () => {
      const openai = new OpenAiConnector();
      const promptContent = `Target lead email is ${testEmail}`;
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-999',
          model: 'gpt-4o-mini',
          choices: [{ message: { content: `Analysis of ${testEmail}` }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
        }),
      }));

      const res = await openai.run(
        { messages: [{ role: 'user', content: promptContent }] },
        { apiKey: testApiKey, fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(rawStr).not.toContain(testApiKey);
      expect(res.raw).toEqual({
        id: 'chatcmpl-999',
        model: 'gpt-4o-mini',
        finishReason: 'stop',
        usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
      });
    });

    it('Ollama: raw contains only allowlisted non-personal metadata, no prompt or email', async () => {
      const ollama = new OllamaConnector();
      const promptContent = `Local prompt regarding ${testEmail}`;
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'llama3',
          message: { content: `Local response with ${testEmail}` },
          done: true,
          total_duration: 123456,
          eval_count: 42,
        }),
      }));

      const res = await ollama.run(
        { messages: [{ role: 'user', content: promptContent }] },
        { fetch: mockFetch as any }
      );

      expect(res.success).toBe(true);
      expect(res.raw).toBeDefined();
      const rawStr = JSON.stringify(res.raw);
      expect(rawStr).not.toContain(testEmail);
      expect(rawStr).not.toContain('@');
      expect(res.raw).toEqual({
        model: 'llama3',
        totalDuration: 123456,
        evalCount: 42,
      });
    });
  });
});
