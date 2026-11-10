import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

export interface ApolloInput {
  domain?: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
}

export interface ApolloPersonOutput {
  email: string | null;
  emailStatus: 'verified' | 'extrapolated' | 'catchall' | 'unknown' | null;
  firstName?: string;
  lastName?: string;
  title?: string;
  organizationName?: string;
  linkedinUrl?: string;
  confidence: number;
}

export class ApolloConnector implements Connector<ApolloInput, ApolloPersonOutput> {
  readonly id = 'apollo';
  readonly name = 'Apollo.io';
  readonly capabilities: ConnectorCapability[] = ['person_enrich', 'company_enrich'];
  readonly auth = {
    type: 'custom_header' as const,
    headerName: 'X-Api-Key',
    description: 'Apollo API key',
  };
  readonly rateLimit = {
    requestsPerMinute: 600,
    concurrency: 10,
  };

  async run(
    input: ApolloInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<ApolloPersonOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'Apollo API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.domain && !input.organizationName && !input.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'At least domain, organizationName, or email must be provided',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const url = ctx.baseUrl ? `${ctx.baseUrl}/v1/people/match` : 'https://api.apollo.io/v1/people/match';

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': ctx.apiKey,
        },
        body: JSON.stringify({
          domain: input.domain,
          first_name: input.firstName,
          last_name: input.lastName,
          organization_name: input.organizationName,
          email: input.email,
        }),
      });

      const latencyMs = Date.now() - start;

      if (response.status === 429) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'RATE_LIMITED',
            status: 429,
            message: 'Apollo rate limit reached',
            retryable: true,
          },
        };
      }

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'PROVIDER_ERROR',
            status: response.status,
            message: `Apollo HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        person?: {
          email?: string;
          email_status?: string;
          first_name?: string;
          last_name?: string;
          title?: string;
          organization?: { name?: string };
          linkedin_url?: string;
        };
      };

      const person = json.person;
      if (!person) {
        return {
          success: true,
          latencyMs,
          costMicrocents: 100,
          data: {
            email: null,
            emailStatus: null,
            confidence: 0,
          },
          raw: json as Record<string, unknown>,
        };
      }

      const email = person.email ?? null;
      const isVerified = person.email_status === 'verified';

      return {
        success: true,
        latencyMs,
        costMicrocents: 100, // Nominal ~$0.001
        data: {
          email,
          emailStatus: (person.email_status as ApolloPersonOutput['emailStatus']) ?? (email ? 'unknown' : null),
          firstName: person.first_name,
          lastName: person.last_name,
          title: person.title,
          organizationName: person.organization?.name ?? input.organizationName,
          linkedinUrl: person.linkedin_url,
          confidence: isVerified ? 0.95 : email ? 0.7 : 0,
        },
        raw: json as Record<string, unknown>,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        },
      };
    }
  }
}
