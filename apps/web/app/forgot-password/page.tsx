'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@leadloom/ui';
import {
  AuthCard,
  AuthLayout,
  PasswordInput,
  OtpInput,
  ResendCountdown,
  AuthAlert,
  callAuthFlow,
} from '@/components/auth';
import { FormField } from '@/components/feedback';

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setEmailError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError('Please enter your work email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await callAuthFlow('forgot-password', {
        email: cleanEmail,
      });

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to request password reset code');
        return;
      }

      // Transition to code + new password step
      setStep('reset');
      setInfoMessage(`We sent a 6-digit verification code to ${cleanEmail}.`);
    } catch {
      setErrorMessage('Unable to connect to authentication service. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setPasswordError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setErrorMessage('Email address is required');
      return;
    }
    if (cleanCode.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code');
      return;
    }
    if (!password) {
      setPasswordError('Please enter a new password');
      return;
    }
    if (password.length < 10) {
      setPasswordError('Password must be at least 10 characters long');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await callAuthFlow('reset-password', {
        email: cleanEmail,
        code: cleanCode,
        password,
      });

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to reset password. Please verify your code and try again.');
        return;
      }

      // Success
      setStep('success');
    } catch {
      setErrorMessage('Unable to connect to authentication service. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please provide an email address to resend code');
      return false;
    }

    const res = await callAuthFlow('forgot-password', {
      email: cleanEmail,
    });

    if (!res.ok) {
      setErrorMessage(res.error || 'Failed to resend code');
      return false;
    }

    setInfoMessage('A fresh verification code has been dispatched to your email.');
    return true;
  };

  if (step === 'success') {
    return (
      <AuthCard
        title="Password updated"
        subtitle="Your password has been successfully reset."
      >
        <AuthAlert
          type="success"
          message="Your password has been updated. You can now sign in to your workspace with your new credentials."
          className="mb-6"
        />

        <Button
          type="button"
          variant="primary"
          onClick={() => router.push(`/login?email=${encodeURIComponent(email)}`)}
          className="w-full justify-center py-2.5 text-xs font-medium h-11 transition-colors"
        >
          Sign In Now
        </Button>
      </AuthCard>
    );
  }

  if (step === 'reset') {
    return (
      <AuthCard
        title="Set new password"
        subtitle="Enter the code sent to your email along with your new password"
      >
        {errorMessage && (
          <AuthAlert type="error" message={errorMessage} className="mb-4" />
        )}

        {infoMessage && (
          <AuthAlert type="info" message={infoMessage} className="mb-4" />
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-1 text-left">
            <span className="text-[11px] text-text-muted">Account:</span>
            <span className="text-xs font-medium text-text-primary block font-mono">{email}</span>
          </div>

          <div>
            <OtpInput
              value={code}
              onChange={setCode}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div>
            <FormField
              id="new-password"
              label="New Password"
              hint="Must be at least 10 characters long"
              error={passwordError}
              required
            >
              <PasswordInput
                id="new-password"
                label=""
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="Min. 10 characters"
                disabled={isSubmitting}
                error={passwordError || undefined}
              />
            </FormField>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || code.length !== 6 || !password}
            className="w-full justify-center py-2.5 text-xs font-medium h-11 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Updating password...' : 'Update Password & Sign In'}
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-border-subtle space-y-3">
          <ResendCountdown onResend={handleResend} cooldownSeconds={60} disabled={isSubmitting} />

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setErrorMessage(null);
                setInfoMessage(null);
                setEmailError(null);
                setPasswordError(null);
              }}
              className="text-xs text-text-muted hover:text-text-primary transition-colors inline-block"
            >
              ← Use a different email address
            </button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your account email to receive a password recovery code"
    >
      {errorMessage && (
        <AuthAlert type="error" message={errorMessage} className="mb-4" />
      )}

      {infoMessage && (
        <AuthAlert type="info" message={infoMessage} className="mb-4" />
      )}

      <form onSubmit={handleRequestCode} className="space-y-4">
        <FormField id="reset-email" label="Work Email" error={emailError} required>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            placeholder="you@company.com"
            disabled={isSubmitting}
            className="w-full bg-canvas-subtle border border-border-subtle text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none rounded-md px-3 py-2.5 text-xs font-sans transition-colors"
          />
        </FormField>

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="w-full justify-center py-2.5 text-xs font-medium h-11 transition-colors"
        >
          {isSubmitting ? 'Sending code...' : 'Send Recovery Code'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Return to Sign In
        </Link>
      </div>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-text-muted text-xs">Loading reset password...</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
