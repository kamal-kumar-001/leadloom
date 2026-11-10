import NextAuth, { CredentialsSignin } from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { randomBytes } from 'node:crypto';
import { engineBase } from './lib/engine-server';
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
  (isBuild ? randomBytes(32).toString('hex') : undefined); // build only: random, never reused at runtime

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
      authorization: { params: { scope: 'read:user user:email' } },
    })
  );
}

class EmailNotVerified extends CredentialsSignin {
  code = 'email_not_verified';
}
class BadCredentials extends CredentialsSignin {
  code = 'invalid_credentials';
}

// Email and password: the ENGINE checks the password and issues its own session.
// The web app never verifies passwords or codes and a credentials session can never mint a bridge token.
if (process.env.LEADLOOM_PASSWORD_AUTH_ENABLED === 'true') {
  providers.push(
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = typeof raw?.email === 'string' ? raw.email.trim().toLowerCase() : '';
        const password = typeof raw?.password === 'string' ? raw.password : '';
        if (!email || !password || email.length > 254 || password.length > 256) throw new BadCredentials();
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 8000);
        let res: Response;
        try {
          res = await fetch(`${engineBase()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            signal: c.signal,
            cache: 'no-store',
          });
        } catch {
          throw new BadCredentials();
        } finally {
          clearTimeout(t);
        }
        if (res.status === 403) {
          const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
          if (JSON.stringify(j).includes('email_not_verified')) throw new EmailNotVerified();
          throw new BadCredentials();
        }
        if (!res.ok) throw new BadCredentials();
        const j = (await res.json().catch(() => null)) as { token?: string; expiresAt?: string | number } | null;
        if (!j?.token) throw new BadCredentials();
        const exp = typeof j.expiresAt === 'number' ? j.expiresAt : Date.parse(String(j.expiresAt));
        return {
          id: email,
          email,
          engineToken: j.token,
          engineExp: Number.isFinite(exp) ? (exp > 1e12 ? Math.floor(exp / 1000) : exp) : Math.floor(Date.now() / 1000) + 3600,
        } as never;
      },
    })
  );
}

async function githubPrimaryVerifiedEmail(accessToken: string | undefined): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const r = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'leadloom' },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const list = (await r.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
    const p = list.find((e) => e.primary && e.verified);
    return p ? p.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60, // matches the engine session lifetime
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      // GitHub: the address must be the account's primary AND verified email, checked live.
      if (account?.provider === 'github') {
        return (await githubPrimaryVerifiedEmail(account.access_token)) !== null;
      }
      if (account?.provider === 'google') {
        return Boolean((profile as Record<string, unknown> | undefined)?.email_verified);
      }
      return true; // credentials: the engine already authenticated
    },
    async jwt({ token, user, account, profile }) {
      if (account) {
        token.idp = account.provider; // 'google' | 'github' | 'credentials'
        if (account.provider === 'google') {
          token.email_verified = Boolean((profile as Record<string, unknown> | undefined)?.email_verified);
        } else if (account.provider === 'github') {
          const primary = await githubPrimaryVerifiedEmail(account.access_token);
          token.email_verified = primary !== null;
          if (primary) token.email = primary;
        } else {
          token.email_verified = false; // never eligible for a bridge token
          const u = user as unknown as { engineToken?: string; engineExp?: number };
          token.engineToken = u.engineToken;
          token.engineExp = u.engineExp;
        }
      }
      if (user?.email && account?.provider !== 'github') {
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
