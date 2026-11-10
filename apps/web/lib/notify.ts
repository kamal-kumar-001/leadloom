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
 * Maps raw exceptions, EngineClientError, HTTP status codes, and network failures
 * into short, human-friendly plain sentences. Never leaks stacks or internal engine details.
 */
export function mapErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected issue occurred. Please try again.';
  }

  // Already an EngineClientError instance with status code
  if (error instanceof EngineClientError) {
    if (error.statusCode === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.statusCode === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (error.statusCode === 404) {
      return 'The requested resource was not found.';
    }
    if (error.statusCode === 409) {
      return 'This record already exists or conflicts with current state.';
    }
    if (error.statusCode === 429) {
      return 'Rate limit reached. Please wait a moment before trying again.';
    }
    if (error.statusCode && error.statusCode >= 500) {
      return 'The service is temporarily unavailable. Please try again shortly.';
    }
    if (error.message && !error.message.includes('\n') && !error.message.includes('{')) {
      return error.message;
    }
    return 'Service error occurred. Please try again.';
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (error.name === 'AbortError' || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('connection error')) {
      return 'Unable to connect to the server. Please check your network.';
    }
    // Reject strings with stack traces, raw json, or file paths
    if (msg.includes('\n') || msg.includes('{') || msg.includes('at ') || msg.includes('apps/engine')) {
      return 'An unexpected service error occurred. Please try again.';
    }
    return msg;
  }

  if (typeof error === 'string') {
    if (error.includes('{') || error.includes('\n') || error.includes('at ') || error.includes('apps/engine')) {
      return 'An unexpected error occurred. Please try again.';
    }
    if (error.includes('Failed to fetch') || error.includes('Network connection error') || error.includes('NetworkError')) {
      return 'Unable to connect to the server. Please check your network.';
    }
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
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
