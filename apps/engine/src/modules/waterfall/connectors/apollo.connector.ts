import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';
import {
  validateAndResolveBaseUrl,
  resolveFetch,
  redactSecrets,
} from './security';

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

const DEFAULT_BASE_URL = 'https://api.apollo.io';

/**
 * Apollo.io People Match Connector (fixture-tested, not live-verified)
 * Official endpoint: POST https://api.apollo.io/api/v1/people/match
 */
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
  readonly verification = 'fixture-tested' as const;

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

    const baseCheck = validateAndResolveBaseUrl(DEFAULT_BASE_URL, ctx.baseUrl);
    if (baseCheck.error) {
      return { success: false, error: baseCheck.error };
    }

    const fetchCheck = resolveFetch(ctx);
    if (fetchCheck.error || !fetchCheck.fetchFn) {
      return { success: false, error: fetchCheck.error };
    }
    const fetchImpl = fetchCheck.fetchFn;

    const start = Date.now();
    const url = `${baseCheck.url}/api/v1/people/match`;

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
          linkedin_url?: string;
          organization?: { name?: string };
        };
      };

      const person = json.person;
      if (!person || !person.email) {
        return {
          success: true,
          latencyMs,
          data: {
            email: null,
            emailStatus: null,
            firstName: person?.first_name,
            lastName: person?.last_name,
            title: person?.title,
            organizationName: person?.organization?.name,
            linkedinUrl: person?.linkedin_url,
            confidence: 0,
          },
          raw: json as Record<string, unknown>,
        };
      }

      let emailStatus: ApolloPersonOutput['emailStatus'] = 'unknown';
      if (person.email_status === 'verified') emailStatus = 'verified';
      else if (person.email_status === 'extrapolated') emailStatus = 'extrapolated';
      else if (person.email_status === 'catchall') emailStatus = 'catchall';

      const confidence = emailStatus === 'verified' ? 0.95 : emailStatus === 'extrapolated' ? 0.7 : 0.4;

      return {
        success: true,
        latencyMs,
        data: {
          email: person.email,
          emailStatus,
          firstName: person.first_name,
          lastName: person.last_name,
          title: person.title,
          organizationName: person.organization?.name,
          linkedinUrl: person.linkedin_url,
          confidence,
        },
        raw: json as Record<string, unknown>,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown network failure', [ctx.apiKey]),
          retryable: true,
        },
      };
    }
  }
}
