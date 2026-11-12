import 'server-only';

import type { AuthMethods } from '@/components/auth/auth-methods';

/**
 * Server-side sign-in method resolution, read once per request (no client round-trip).
 * An OAuth button only activates when credentials exist AND its explicit enable flag is
 * set - placeholder env values alone never light up a button that cannot work.
 */
export function getAuthMethods(): AuthMethods {
  return {
    github:
      Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) &&
      process.env.LEADLOOM_OAUTH_GITHUB_ENABLED === 'true',
    google:
      Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) &&
      process.env.LEADLOOM_OAUTH_GOOGLE_ENABLED === 'true',
    password: process.env.LEADLOOM_PASSWORD_AUTH_ENABLED === 'true',
  };
}
