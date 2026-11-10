import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected =
        nextUrl.pathname.startsWith('/app') || nextUrl.pathname.startsWith('/admin');

      if (isProtected) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to /login
      }
      return true;
    },
  },
  providers: [], // Configured with full providers in auth.ts
} satisfies NextAuthConfig;
