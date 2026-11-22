import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth';
import { getAuthMethods } from '@/lib/auth-methods-server';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Sign Up — LeadLoom',
  description: 'Create an early access LeadLoom account.',
  alternates: {
    canonical: '/signup',
  },
};

// Sign-in methods are read from runtime env; never prerender with build-time values.
export const dynamic = 'force-dynamic';

export default function SignupPage() {
  const methods = getAuthMethods();
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-text-muted text-xs">Loading sign up...</div>}>
        <SignupForm methods={methods} />
      </Suspense>
    </AuthLayout>
  );
}
