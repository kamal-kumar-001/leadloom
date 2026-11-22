import type { AuthMethods } from '../components/auth/auth-methods';

/** Shared display and registration policy. Credentials alone never enable OAuth. */
export function resolveAuthMethods(env: Readonly<Record<string, string | undefined>>): AuthMethods {
  return {
    github: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) && env.LEADLOOM_OAUTH_GITHUB_ENABLED === 'true',
    google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) && env.LEADLOOM_OAUTH_GOOGLE_ENABLED === 'true',
    password: env.LEADLOOM_PASSWORD_AUTH_ENABLED === 'true',
  };
}
