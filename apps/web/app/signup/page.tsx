'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@leadloom/ui';
import {
  AuthCard,
  AuthLayout,
  PasswordInput,
  AuthAlert,
  OAuthButtons,
  useAuthMethods,
  safeCallback,
  callAuthFlow,
} from '@/components/auth';
import { FormField } from '@/components/feedback';

function SignupForm() {
  const methods = useAuthMethods();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  // Landing "Find Leads" CTA prefills the email via /signup?email=...
  const [email, setEmail] = useState(() => (searchParams.get('email') || '').trim());
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    const cleanEmail = email.trim().toLowerCase();
    const errors: { email?: string; password?: string } = {};
    if (!cleanEmail) errors.email = 'Work email is required';
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 10) {
      errors.password = 'Password must be at least 10 characters';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await callAuthFlow('register', {
        email: cleanEmail,
        password,
      });

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to create account');
        return;
      }

      // Success: Engine accepted registration and dispatched 6-digit OTP code
      router.push(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
    } catch {
      setErrorMessage('Unable to connect to authentication service. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create your GTM workspace"
      subtitle="Start weaving buyer intent signals with zero per-credit markups"
    >
      {urlError && !errorMessage && (
        <AuthAlert
          type="error"
          message={
            urlError === 'AccessDenied'
              ? 'Access denied. You do not have permission to register.'
              : `Registration error: ${urlError}`
          }
          className="mb-4"
        />
      )}

      {errorMessage && (
        <AuthAlert type="error" message={errorMessage} className="mb-4" />
      )}

      {/* Primary OAuth Actions */}
      <OAuthButtons mode="signup" callbackUrl="/app" />

      {methods.password && (
      <>
      {/* Divider */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-subtle" />
        </div>
        <span className="relative bg-canvas-surface px-2 text-[10px] text-text-muted font-mono uppercase tracking-wider">
          Or create account with password
        </span>
      </div>

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="signup-email" label="Work Email" error={fieldErrors.email} required>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="you@company.com"
            disabled={isSubmitting}
            className="w-full bg-canvas-subtle border border-border-subtle text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none rounded-md px-3 py-2.5 text-xs font-sans transition-colors"
          />
        </FormField>

        <div>
          <FormField
            id="signup-password"
            label="Password"
            hint="Must be at least 10 characters long"
            error={fieldErrors.password}
            required
          >
            <PasswordInput
              id="signup-password"
              label=""
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Min. 10 characters"
              disabled={isSubmitting}
              error={fieldErrors.password}
            />
          </FormField>
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="w-full justify-center py-2.5 text-xs font-medium h-11 transition-colors"
        >
          {isSubmitting ? 'Creating account...' : 'Create Workspace'}
        </Button>
      </form>
      </>
      )}

      <div className="mt-6 text-center">
        <span className="text-xs text-text-secondary">
          Already have a workspace?{' '}
          <Link href="/login" className="text-brand-loom hover:underline font-medium">
            Sign in
          </Link>
        </span>
      </div>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-text-muted text-xs">Loading sign up...</div>}>
        <SignupForm />
      </Suspense>
    </AuthLayout>
  );
}
