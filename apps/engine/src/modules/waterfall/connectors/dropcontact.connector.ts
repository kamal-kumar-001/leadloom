import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

export interface DropcontactInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  website?: string;
  email?: string;
}

export interface DropcontactOutput {
  email: string | null;
  qualification: 'nominative' | 'generic' | 'catch_all' | null;
  company?: string;
  website?: string;
  siren?: string;
  linkedinUrl?: string;
  confidence: number;
}

export class DropcontactConnector implements Connector<DropcontactInput, DropcontactOutput> {
  readonly id = 'dropcontact';
  readonly name = 'Dropcontact';
  readonly capabilities: ConnectorCapability[] = ['person_enrich', 'company_enrich'];
  readonly auth = {
    type: 'custom_header' as const,
    headerName: 'X-Access-Token',
    description: 'Dropcontact API token',
  };
  readonly rateLimit = {
    requestsPerMinute: 200,
    concurrency: 5,
  };

  async run(
    input: DropcontactInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<DropcontactOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'Dropcontact API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.website && !input.company && !input.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'At least website, company, or email must be provided for Dropcontact enrichment',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const url = ctx.baseUrl ? `${ctx.baseUrl}/batch` : 'https://api.dropcontact.io/batch';

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Token': ctx.apiKey,
        },
        body: JSON.stringify({
          data: [
            {
              first_name: input.firstName,
              last_name: input.lastName,
              full_name: input.fullName,
              company: input.company,
              website: input.website,
              email: input.email,
            },
          ],
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
            message: 'Dropcontact rate limit reached',
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
            message: `Dropcontact HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        data?: Array<{
          email?: Array<{ email?: string; qualification?: string }>;
          company?: string;
          website?: string;
          siren?: string;
          linkedin?: string;
        }>;
      };

      const record = json.data?.[0];
      const primaryEmail = record?.email?.[0];

      if (!primaryEmail?.email) {
        return {
          success: true,
          latencyMs,
          costMicrocents: 120,
          data: {
            email: null,
            qualification: null,
            company: record?.company ?? input.company,
            website: record?.website ?? input.website,
            siren: record?.siren,
            linkedinUrl: record?.linkedin,
            confidence: 0,
          },
          raw: json as Record<string, unknown>,
        };
      }

      const qual = primaryEmail.qualification as DropcontactOutput['qualification'] ?? null;
      const confidence = qual === 'nominative' ? 0.95 : qual === 'catch_all' ? 0.6 : 0.8;

      return {
        success: true,
        latencyMs,
        costMicrocents: 120, // ~$0.0012
        data: {
          email: primaryEmail.email,
          qualification: qual,
          company: record?.company ?? input.company,
          website: record?.website ?? input.website,
          siren: record?.siren,
          linkedinUrl: record?.linkedin,
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
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        },
      };
    }
  }
}
