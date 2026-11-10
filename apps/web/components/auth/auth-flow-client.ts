export type AuthFlowAction =
  | 'register'
  | 'verify-email'
  | 'resend-verification'
  | 'forgot-password'
  | 'reset-password';

export interface AuthFlowResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Dispatches an auth action to the same-origin Next.js API route `/api/auth-flow/<action>`.
 * Transparently translates HTTP statuses and maps engine errors.
 */
export async function callAuthFlow<T = Record<string, unknown>>(
  action: AuthFlowAction,
  payload: Record<string, unknown>
): Promise<AuthFlowResult<T>> {
  try {
    const res = await fetch(`/api/auth-flow/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // Body not JSON
    }

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        data,
      };
    }

    // Specific status code handling per engine contracts
    if (res.status === 429) {
      return {
        ok: false,
        status: 429,
        error:
          data?.error ||
          'Too many requests. Please wait a few minutes before trying again.',
      };
    }

    if (res.status === 503) {
      return {
        ok: false,
        status: 503,
        error: 'Email sign-up is not available yet',
      };
    }

    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        code: data?.code,
        error: data?.error || 'Access denied',
      };
    }

    if (res.status === 400) {
      return {
        ok: false,
        status: 400,
        error: data?.error || 'Invalid or expired code',
      };
    }

    return {
      ok: false,
      status: res.status,
      error: data?.error || `Request failed (${res.status})`,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'Unable to connect to authentication service. Please check your connection.',
    };
  }
}
