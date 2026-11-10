import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { authConfig } from './auth.config';

const providers: NextAuthConfig['providers'] = [
  Credentials({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'demo@leadloom.dev' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || typeof credentials.email !== 'string') {
        return null;
      }
      const email = credentials.email.trim().toLowerCase();
      return {
        id: 'usr_' + Buffer.from(email).toString('hex').slice(0, 16),
        name: email.split('@')[0],
        email,
      };
    },
  }),
];

// Conditionally enable Google OAuth if env vars exist
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

// Conditionally enable GitHub OAuth if env vars exist
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
    jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email.toLowerCase().trim();
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.email && session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'leadloom-insecure-dev-secret-key-at-least-32-chars-long-0123456789',
});
