import {
  Connector,
  ConnectorCapability,
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

export interface PdlInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  website?: string;
  email?: string;
  linkedinUrl?: string;
}

export interface PdlOutput {
  fullName: string | null;
  workEmail: string | null;
  personalEmails: string[];
  jobTitle: string | null;
  companyName: string | null;
  linkedinUrl: string | null;
  confidence: number;
}

export class PdlConnector implements Connector<PdlInput, PdlOutput> {
  readonly id = 'pdl';
  readonly name = 'People Data Labs';
  readonly capabilities: ConnectorCapability[] = ['person_enrich'];
  readonly auth = {
    type: 'custom_header' as const,
    headerName: 'X-Api-Key',
    description: 'People Data Labs API Key',
  };
  readonly rateLimit = {
    requestsPerMinute: 600,
    concurrency: 10,
  };

  async run(
    input: PdlInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<PdlOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'People Data Labs API key not configured',
          retryable: false,
        },
      };
    }

    if (!input.email && !input.linkedinUrl && !(input.fullName || (input.firstName && input.lastName))) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'PDL requires either email, linkedinUrl, or person name',
          retryable: false,
        },
      };
    }

    const start = Date.now();
    const fetchImpl = ctx.fetch ?? fetch;
    const base = ctx.baseUrl ?? 'https://api.peopledatalabs.com';

    const params = new URLSearchParams();
    if (input.email) params.set('email', input.email);
    if (input.linkedinUrl) params.set('profile', input.linkedinUrl);
    if (input.firstName) params.set('first_name', input.firstName);
    if (input.lastName) params.set('last_name', input.lastName);
    if (input.fullName) params.set('name', input.fullName);
    if (input.company) params.set('company', input.company);
    if (input.website) params.set('website', input.website);

    const url = `${base}/v5/person/enrich?${params.toString()}`;

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          'X-Api-Key': ctx.apiKey,
          Accept: 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (response.status === 429) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'RATE_LIMITED',
            status: 429,
            message: 'People Data Labs rate limit reached',
            retryable: true,
          },
        };
      }

      if (response.status === 404) {
        return {
          success: true,
          latencyMs,
          costMicrocents: 0,
          data: {
            fullName: null,
            workEmail: null,
            personalEmails: [],
            jobTitle: null,
            companyName: null,
            linkedinUrl: null,
            confidence: 0,
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
            message: `PDL HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        data?: {
          full_name?: string;
          work_email?: string;
          personal_emails?: string[];
          job_title?: string;
          job_company_name?: string;
          linkedin_url?: string;
        };
      };

      const person = json.data;
      if (!person) {
        return {
          success: true,
          latencyMs,
          costMicrocents: 150,
          data: {
            fullName: null,
            workEmail: null,
            personalEmails: [],
            jobTitle: null,
            companyName: null,
            linkedinUrl: null,
            confidence: 0,
          },
          raw: json as Record<string, unknown>,
        };
      }

      const hasWorkEmail = Boolean(person.work_email);
      const confidence = hasWorkEmail ? 0.95 : 0.7;

      return {
        success: true,
        latencyMs,
        costMicrocents: 150, // ~$0.0015
        data: {
          fullName: person.full_name ?? null,
          workEmail: person.work_email ?? null,
          personalEmails: person.personal_emails ?? [],
          jobTitle: person.job_title ?? null,
          companyName: person.job_company_name ?? input.company ?? null,
          linkedinUrl: person.linkedin_url ?? input.linkedinUrl ?? null,
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
