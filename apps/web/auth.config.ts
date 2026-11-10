import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
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
        const userEmail = auth?.user?.email?.toLowerCase() ?? '';
        const userRole = (auth?.user as Record<string, unknown> | undefined)?.role;
        // Restrict /admin to platform_admin or configured operator accounts
        return (
          userRole === 'platform_admin' ||
          userEmail === 'operator@leadloom.dev' ||
          userEmail === 'admin@leadloom.dev'
        );
      }
      return true;
    },
  },
  providers: [], // Configured with full providers in auth.ts
} satisfies NextAuthConfig;
