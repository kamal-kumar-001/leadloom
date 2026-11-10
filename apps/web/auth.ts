import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { authConfig } from './auth.config';

// Fail closed: secret is strictly required and must be >= 32 bytes at runtime
const isBuild =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build';
const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (isBuild ? 'build-time-static-collection-secret-at-least-32-chars-long' : undefined);

if (!authSecret || authSecret.length < 32) {
  throw new Error('AUTH_SECRET (or NEXTAUTH_SECRET) >= 32 characters is required at runtime');
}

const providers: NextAuthConfig['providers'] = [];

// Real identity only: Google and GitHub OAuth providers
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user, account, profile }) {
      if (account) {
        token.idp = account.provider; // 'google' | 'github'
        const isGoogle = account.provider === 'google';
        const isGithub = account.provider === 'github';
        token.email_verified = isGoogle
          ? Boolean((profile as Record<string, unknown> | undefined)?.email_verified)
          : isGithub
          ? true // GitHub OAuth guarantees verified primary email
          : false;
      }
      if (user?.email) {
        token.email = user.email.toLowerCase().trim();
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.email && session.user) {
        session.user.email = token.email as string;
        (session.user as unknown as Record<string, unknown>).idp = token.idp as string;
        (session.user as unknown as Record<string, unknown>).email_verified = Boolean(
          token.email_verified
        );
      }
      return session;
    },
  },
  secret: authSecret,
});
