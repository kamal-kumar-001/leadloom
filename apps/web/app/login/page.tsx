import React, { Suspense } from 'react';
import { AuthLayout } from '@/components/auth';
import { getAuthMethods } from '@/lib/auth-methods-server';
import { LoginForm } from './login-form';

// Sign-in methods are read from runtime env; never prerender with build-time values.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const methods = getAuthMethods();
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-text-muted text-xs">Loading sign in...</div>}>
        <LoginForm methods={methods} />
      </Suspense>
    </AuthLayout>
  );
}
