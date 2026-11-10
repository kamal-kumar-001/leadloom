'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@leadloom/ui';
import {
  AuthCard,
  AuthLayout,
  PasswordInput,
  AuthAlert,
  OAuthButtons,
  useAuthMethods,
  safeCallback,
} from '@/components/auth';
import { FormField } from '@/components/feedback';

function LoginForm() {
  const methods = useAuthMethods();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const verifiedNotice = searchParams.get('verified') === 'true';

  const [email, setEmail] = useState('');
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
    if (!password) errors.password = 'Password is required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn('credentials', {
        email: cleanEmail,
        password,
        redirect: false,
      });

      if (!res) {
        setErrorMessage('Unable to connect to authentication service. Please check your connection.');
        return;
      }

      if (res.error) {
        // Check for unverified email state per engine contract
        if (
          res.error === 'email_not_verified' ||
          res.error.toLowerCase().includes('not verified')
        ) {
          router.push(`/verify-email?email=${encodeURIComponent(cleanEmail)}&reason=unverified`);
          return;
        }

        // Any other failure shows one generic message: Never reveal whether email exists
        setErrorMessage('Email or password is incorrect');
        return;
      }

      // Success: navigate to application dashboard
      const callbackUrl = searchParams.get('callbackUrl') || '/app';
      router.push(safeCallback(callbackUrl));
    } catch {
      setErrorMessage('Unable to connect to authentication service. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Sign in to your workspace"
      subtitle="Access your signals, data waterfalls, and outbound sequences"
    >
      {urlError && !errorMessage && (
        <AuthAlert
          type="error"
          message={
            urlError === 'AccessDenied'
              ? 'Access denied. You do not have permission to access this resource.'
              : `Authentication error: ${urlError}`
          }
          className="mb-4"
        />
      )}

      {verifiedNotice && !errorMessage && (
        <AuthAlert
          type="success"
          message="Email address verified successfully. You may now sign in."
          className="mb-4"
        />
      )}

      {errorMessage && (
        <AuthAlert type="error" message={errorMessage} className="mb-4" />
      )}

      {/* OAuth Buttons */}
      <OAuthButtons mode="signin" callbackUrl={searchParams.get('callbackUrl') || '/app'} />

      {methods.password && (
      <>
      {/* Divider */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-subtle" />
        </div>
        <span className="relative bg-canvas-surface px-2 text-[10px] text-text-muted font-mono uppercase tracking-wider">
          Or continue with password
        </span>
      </div>

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="email" label="Work Email" error={fieldErrors.email} required>
          <input
            id="email"
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
          <FormField id="password" label="Password" error={fieldErrors.password} required>
            <PasswordInput
              id="password"
              label=""
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="••••••••••••"
              disabled={isSubmitting}
              error={fieldErrors.password}
            />
          </FormField>
          <div className="text-right mt-1.5">
            <Link
              href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
              className="text-[11px] text-text-muted hover:text-brand-loom transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="w-full justify-center py-2.5 text-xs font-medium h-11 transition-colors"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
      </>
      )}

      <div className="mt-6 text-center">
        <span className="text-xs text-text-secondary">
          Don&apos;t have a workspace?{' '}
          <Link href="/signup" className="text-brand-loom hover:underline font-medium">
            Create one now
          </Link>
        </span>
      </div>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-text-muted text-xs">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
