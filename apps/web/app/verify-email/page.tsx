'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@leadloom/ui';
import {
  AuthCard,
  AuthLayout,
  OtpInput,
  ResendCountdown,
  AuthAlert,
  callAuthFlow,
} from '@/components/auth';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const reason = searchParams.get('reason');

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    reason === 'unverified'
      ? 'Your email address is not yet verified. Please enter the verification code sent to your inbox.'
      : null
  );

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setErrorMessage('Please provide your email address');
      return;
    }
    if (cleanCode.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await callAuthFlow('verify-email', {
        email: cleanEmail,
        code: cleanCode,
      });

      if (!res.ok) {
        setErrorMessage(res.error || 'This code is invalid or has expired');
        return;
      }

      // Success: Email is verified. Redirect to sign-in with verified flag
      router.push(`/login?verified=true&email=${encodeURIComponent(cleanEmail)}`);
    } catch {
      setErrorMessage('Unable to connect to verification service. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please provide an email address to resend the code');
      return false;
    }

    const res = await callAuthFlow('resend-verification', {
      email: cleanEmail,
    });

    if (!res.ok) {
      setErrorMessage(res.error || 'Failed to resend verification code');
      return false;
    }

    setInfoMessage('A fresh verification code has been dispatched to your email.');
    return true;
  };

  return (
    <AuthCard
      title="Verify your email"
      subtitle="Enter the 6-digit security code to activate your workspace"
    >
      {errorMessage && (
        <AuthAlert type="error" message={errorMessage} className="mb-4" />
      )}

      {infoMessage && (
        <AuthAlert type="info" message={infoMessage} className="mb-4" />
      )}

      <form onSubmit={handleVerify} className="space-y-5">
        <div className="space-y-1.5 text-left">
          <label htmlFor="verify-email" className="block text-xs font-medium text-text-secondary">
            Account Email
          </label>
          <input
            id="verify-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={isSubmitting}
            className="w-full bg-canvas-subtle border border-border-subtle text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none rounded-md px-3 py-2.5 text-xs font-sans transition-colors"
          />
        </div>

        <div>
          <OtpInput
            value={code}
            onChange={setCode}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || code.length !== 6}
          className="w-full justify-center py-2.5 text-xs font-medium h-11 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Verifying...' : 'Verify Email & Continue'}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-border-subtle space-y-3">
        <ResendCountdown onResend={handleResend} cooldownSeconds={60} disabled={isSubmitting} />

        <div className="text-center">
          <Link
            href="/login"
            className="text-xs text-text-muted hover:text-text-primary transition-colors inline-block"
          >
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-text-muted text-xs">Loading verification...</div>}>
        <VerifyEmailForm />
      </Suspense>
    </AuthLayout>
  );
}
