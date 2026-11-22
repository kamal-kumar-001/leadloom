import type { NextAuthConfig } from 'next-auth';
import { isPlatformAdmin } from './lib/platform-admin';

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    session({session, token}) {
      // Middleware and server layouts must see the same signed identity proof.
      // Never infer verification from an address or forward engine credentials.
      if (session.user) {
        const user = session.user as unknown as Record<string, unknown>;
        user.email_verified = token.email_verified === true;
        user.idp = token.idp;
        user.authTime = token.authTime;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApp = nextUrl.pathname.startsWith('/app');
      const isAdmin = nextUrl.pathname.startsWith('/admin');

      if (isApp) {
        return isLoggedIn;
      }

      if (isAdmin) {
        if (!isLoggedIn) return false;
        // Authenticated provider-verified account ownership check for designated platform admin
        return isPlatformAdmin(auth?.user as { email?: string | null; email_verified?: boolean });
      }

      return true;
    },
  },
  providers: [], // Configured with verified identity providers in auth.ts
} satisfies NextAuthConfig;
