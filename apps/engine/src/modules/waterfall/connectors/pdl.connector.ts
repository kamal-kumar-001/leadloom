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
  safeFetch,
  checkRedirectResponse,
} from './security';

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

const DEFAULT_BASE_URL = 'https://api.peopledatalabs.com';

/**
 * People Data Labs (PDL) Person Enrichment Connector (fixture-tested, not live-verified)
 * Official endpoint: POST https://api.peopledatalabs.com/v5/person/enrich
 */
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
  readonly verification = 'fixture-tested' as const;

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
          message: 'At least email, linkedinUrl, or person name must be provided for PDL search',
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
    const url = `${baseCheck.url}/v5/person/enrich`;

    try {
      const response = await safeFetch(fetchImpl, url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': ctx.apiKey,
        },
        body: JSON.stringify({
          email: input.email,
          profile: input.linkedinUrl,
          first_name: input.firstName,
          last_name: input.lastName,
          name: input.fullName,
          company: input.company,
          website: input.website,
        }),
      });

      const latencyMs = Date.now() - start;

      const redirectErr = checkRedirectResponse(response);
      if (redirectErr) {
        return { success: false, latencyMs, error: redirectErr };
      }

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
          data: {
            fullName: null,
            workEmail: null,
            personalEmails: [],
            jobTitle: null,
            companyName: null,
            linkedinUrl: null,
            confidence: 0,
          },
          raw: { status: 404, message: 'Person not found' },
        };
      }

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'PROVIDER_ERROR',
            status: response.status,
            message: `People Data Labs HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
        };
      }

      const json = (await response.json()) as {
        status?: number;
        data?: {
          full_name?: string;
          first_name?: string;
          last_name?: string;
          work_email?: string;
          personal_emails?: string[];
          job_title?: string;
          job_company_name?: string;
          linkedin_url?: string;
        };
      };

      const record = json.data;
      const confidence = record?.work_email ? 0.95 : record?.full_name ? 0.7 : 0;

      return {
        success: true,
        latencyMs,
        data: {
          fullName: record?.full_name ?? (record?.first_name ? `${record.first_name} ${record.last_name ?? ''}`.trim() : null),
          workEmail: record?.work_email ?? null,
          personalEmails: record?.personal_emails ?? [],
          jobTitle: record?.job_title ?? null,
          companyName: record?.job_company_name ?? null,
          linkedinUrl: record?.linkedin_url ?? null,
          confidence,
        },
        raw: {
          status: json.status ?? 200,
        },
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown People Data Labs network error', [
            ctx.apiKey,
          ]),
          retryable: true,
        },
      };
    }
  }
}
