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

export interface DropcontactInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  website?: string;
  domain?: string;
}

export interface DropcontactOutput {
  email: string | null;
  qualification: 'nominative' | 'generic' | 'unknown' | null;
  firstName?: string;
  lastName?: string;
  company?: string;
  website?: string;
  phone?: string;
  requestId: string;
  confidence: number;
}

const DEFAULT_BASE_URL = 'https://api.dropcontact.com';

/**
 * Dropcontact Asynchronous Batch/Single Enrichment Connector (fixture-tested, not live-verified)
 * Official endpoints:
 *  - Submit: POST https://api.dropcontact.com/v1/enrich/all
 *  - Fetch:  GET  https://api.dropcontact.com/v1/enrich/all/{request_id}
 */
export class DropcontactConnector implements Connector<DropcontactInput, DropcontactOutput> {
  readonly id = 'dropcontact';
  readonly name = 'Dropcontact';
  readonly capabilities: ConnectorCapability[] = ['person_enrich', 'company_enrich', 'email_verify'];
  readonly auth = {
    type: 'custom_header' as const,
    headerName: 'X-Access-Token',
    description: 'Dropcontact API token',
  };
  readonly rateLimit = {
    requestsPerMinute: 300,
    concurrency: 5,
  };
  readonly verification = 'fixture-tested' as const;

  async run(
    input: DropcontactInput,
    ctx: ConnectorContext
  ): Promise<ConnectorResult<DropcontactOutput>> {
    if (!ctx.apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'Dropcontact API token not configured',
          retryable: false,
        },
      };
    }

    if (!input.email && !input.company && !input.website && !input.domain && !input.lastName) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'At least email, company, domain, or lastName must be provided',
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
    const submitUrl = `${baseCheck.url}/v1/enrich/all`;

    try {
      // 1. Submit enrichment job
      const submitResponse = await fetchImpl(submitUrl, {
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
              email: input.email,
              company: input.company,
              website: input.website ?? input.domain,
            },
          ],
          siren: true,
          language: 'en',
        }),
      });

      if (submitResponse.status === 429) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          error: {
            code: 'RATE_LIMITED',
            status: 429,
            message: 'Dropcontact rate limit exceeded',
            retryable: true,
          },
        };
      }

      if (!submitResponse.ok) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          error: {
            code: 'PROVIDER_ERROR',
            status: submitResponse.status,
            message: `Dropcontact submit HTTP ${submitResponse.status}`,
            retryable: submitResponse.status >= 500,
          },
        };
      }

      const submitJson = (await submitResponse.json()) as {
        request_id?: string;
        success?: boolean;
        error?: string;
      };

      const requestId = submitJson.request_id;
      if (!requestId) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          error: {
            code: 'PROVIDER_ERROR',
            message: submitJson.error ?? 'Dropcontact did not return a request_id',
            retryable: false,
          },
        };
      }

      // 2. Fetch enriched results
      const fetchUrl = `${baseCheck.url}/v1/enrich/all/${encodeURIComponent(requestId)}`;
      const resultResponse = await fetchImpl(fetchUrl, {
        method: 'GET',
        headers: {
          'X-Access-Token': ctx.apiKey,
        },
      });

      const latencyMs = Date.now() - start;

      if (!resultResponse.ok) {
        return {
          success: false,
          latencyMs,
          error: {
            code: 'PROVIDER_ERROR',
            status: resultResponse.status,
            message: `Dropcontact fetch HTTP ${resultResponse.status}`,
            retryable: resultResponse.status >= 500,
          },
        };
      }

      const resultJson = (await resultResponse.json()) as {
        success?: boolean;
        data?: Array<{
          first_name?: string;
          last_name?: string;
          email?: Array<{ email: string; qualification?: string }>;
          company?: string;
          website?: string;
          phone?: string;
        }>;
      };

      const record = resultJson.data?.[0];
      const primaryEmail = record?.email?.[0];
      const qualification =
        primaryEmail?.qualification === 'nominative'
          ? 'nominative'
          : primaryEmail?.qualification === 'generic'
          ? 'generic'
          : primaryEmail
          ? 'unknown'
          : null;

      const confidence = qualification === 'nominative' ? 0.98 : qualification === 'generic' ? 0.6 : 0;

      return {
        success: true,
        latencyMs,
        data: {
          email: primaryEmail?.email ?? null,
          qualification,
          firstName: record?.first_name,
          lastName: record?.last_name,
          company: record?.company,
          website: record?.website,
          phone: record?.phone,
          requestId,
          confidence,
        },
        raw: resultJson as Record<string, unknown>,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: {
          code: 'NETWORK_ERROR',
          message: redactSecrets(err instanceof Error ? err.message : 'Unknown Dropcontact network error', [
            ctx.apiKey,
          ]),
          retryable: true,
        },
      };
    }
  }
}
