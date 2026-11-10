import { toast } from 'sonner';
import { EngineClientError } from './engine-client';

export interface NotifyAction {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export interface NotifyOptions {
  id?: string;
  description?: string;
  duration?: number;
  action?: NotifyAction;
  cancel?: NotifyAction;
  onDismiss?: () => void;
  onAutoClose?: () => void;
}

/**
 * Computes a fast deterministic hash string to deduplicate identical notifications.
 */
function hashMessage(type: string, message: string, description?: string): string {
  const combined = `${type}:${message}:${description || ''}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return `ll-${type}-${Math.abs(hash)}`;
}

/**
 * A message authored in our own code that is safe to show a user as-is.
 * This is the ONLY way an Error's text reaches the screen.
 */
export class UserMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserMessageError';
  }
}

const GENERIC = 'Something went wrong. Please try again.';

/** Allowlist of engine-client error codes with fixed, user-safe wording. */
const CODE_MESSAGES: Record<string, string> = {
  VAULT_UNAVAILABLE: 'The vault is unavailable right now. No changes were made.',
};

/**
 * Explicit safe-message contract. Thrown errors are never shown by their own text:
 * - UserMessageError: its authored message.
 * - EngineClientError: an allowlisted code message, else wording chosen by HTTP status.
 * - network aborts: a fixed connectivity sentence.
 * - anything else: a generic sentence.
 * Strings passed directly to notify.error are caller-authored messages, not caught errors.
 * The raw error goes to the browser console for diagnostics only (never into the UI).
 */
export function mapErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error.trim() || GENERIC;
  if (error instanceof UserMessageError) return error.message;
  if (error instanceof EngineClientError) {
    if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
    const status = error.statusCode;
    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'You do not have permission to do this.';
    if (status === 404) return 'That item was not found.';
    if (status === 409) return 'This conflicts with the current state. Refresh and try again.';
    if (status === 400 || status === 422) return 'The request was not accepted. Check the values and try again.';
    if (status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (status && status >= 500) return 'The service is temporarily unavailable. Please try again shortly.';
    return GENERIC;
  }
  if (error instanceof Error && (error.name === 'AbortError' || /failed to fetch|networkerror/i.test(error.message))) {
    return 'Unable to reach the server. Check your connection and try again.';
  }
  return GENERIC;
}

export const notify = {
  success(message: string, options?: NotifyOptions): string | number {
    const id = options?.id || hashMessage('success', message, options?.description);
    return toast.success(message, {
      ...options,
      id,
      duration: options?.duration ?? 4000,
    });
  },

  info(message: string, options?: NotifyOptions): string | number {
    const id = options?.id || hashMessage('info', message, options?.description);
    return toast.info(message, {
      ...options,
      id,
      duration: options?.duration ?? 4000,
    });
  },

  warning(message: string, options?: NotifyOptions): string | number {
    const id = options?.id || hashMessage('warning', message, options?.description);
    return toast.warning(message, {
      ...options,
      id,
      duration: options?.duration ?? 5000,
    });
  },

  error(errorOrMessage: unknown, options?: NotifyOptions): string | number {
    const message = mapErrorMessage(errorOrMessage);
    if (typeof errorOrMessage !== 'string' && typeof console !== 'undefined') console.debug('[notify]', errorOrMessage);
    const id = options?.id || hashMessage('error', message, options?.description);

    // Errors with an interactive action (e.g. Retry) must stay until dismissed
    const hasAction = Boolean(options?.action);
    const duration = options?.duration ?? (hasAction ? Infinity : 6000);

    return toast.error(message, {
      ...options,
      id,
      duration,
    });
  },

  dismiss(id?: string | number): void {
    toast.dismiss(id);
  },
};
