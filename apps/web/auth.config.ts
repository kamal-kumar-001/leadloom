import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApp = nextUrl.pathname.startsWith('/app');
      const isAdmin = nextUrl.pathname.startsWith('/admin');

      if (isApp) {
        return isLoggedIn;
      }

      if (isAdmin) {
        if (!isLoggedIn) return false;
        // Platform privileges must never come from a self-asserted email string.
        // Admin access is decided by the engine from its own tables.
        // Until a platform-admin table exists, /admin stays closed (deny) outside an explicit dev flag.
        if (process.env.LEADLOOM_DEV_ADMIN_ENABLED === 'true' && process.env.NODE_ENV !== 'production') {
          return true;
        }
        return false;
      }

      return true;
    },
  },
  providers: [], // Configured with verified identity providers in auth.ts
} satisfies NextAuthConfig;
