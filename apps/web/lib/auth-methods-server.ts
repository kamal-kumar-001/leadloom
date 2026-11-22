import 'server-only';

import type { AuthMethods } from '@/components/auth/auth-methods';
import { resolveAuthMethods } from './auth-method-policy';

/**
 * Server-side sign-in method resolution, read once per request (no client round-trip).
 * An OAuth button only activates when credentials exist AND its explicit enable flag is
 * set - placeholder env values alone never light up a button that cannot work.
 */
export function getAuthMethods(): AuthMethods {
  return resolveAuthMethods(process.env);
}
