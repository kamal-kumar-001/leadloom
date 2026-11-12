'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@leadloom/ui';
import {
  AuthCard,
  PasswordInput,
  AuthAlert,
  OAuthButtons,
  callAuthFlow,
} from '@/components/auth';
import type { AuthMethods } from '@/components/auth/auth-methods';
import { FormField } from '@/components/feedback';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export function SignupForm({ methods }: { methods: AuthMethods }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  // Landing "Find Leads" CTA prefills the email via /signup?email=...
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => (searchParams.get('email') || '').trim());
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const clearFieldError = (key: keyof FieldErrors) =>
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const errors: FieldErrors = {};
    if (!cleanName) errors.name = 'Full name is required';
    if (!cleanEmail) {
      errors.email = 'Email is required';
    } else if (!EMAIL_RE.test(cleanEmail)) {
      errors.email = 'Enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 10) {
      errors.password = 'Password must be at least 10 characters';
    }
    if (!confirm) {
      errors.confirm = 'Please confirm your password';
    } else if (confirm !== password) {
      errors.confirm = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await callAuthFlow('register', {
        name: cleanName,
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

  const inputClass =
    'w-full bg-canvas-subtle border border-border-subtle text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none rounded-md px-3 py-2.5 text-xs font-sans transition-colors aria-[invalid=true]:border-signal-failed';

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

      {/* OAuth options */}
      <OAuthButtons mode="signup" callbackUrl="/app" methods={methods} />

      {methods.password && (
      <>
      {/* Divider */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-subtle" />
        </div>
        <span className="relative bg-canvas-surface px-2 text-[10px] text-text-muted font-mono uppercase tracking-wider">
          Or create account with email
        </span>
      </div>

      {/* Name / Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField id="signup-name" label="Full Name" error={fieldErrors.name} required>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) clearFieldError('name');
            }}
            placeholder="Your full name"
            disabled={isSubmitting}
            className={inputClass}
          />
        </FormField>

        <FormField id="signup-email" label="Email" error={fieldErrors.email} required>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) clearFieldError('email');
            }}
            placeholder="you@example.com"
            disabled={isSubmitting}
            className={inputClass}
          />
        </FormField>

        <FormField
          id="signup-password"
          label="New Password"
          hint="Must be at least 10 characters long"
          error={fieldErrors.password}
          required
        >
          <PasswordInput
            id="signup-password"
            label=""
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) clearFieldError('password');
            }}
            placeholder="Min. 10 characters"
            disabled={isSubmitting}
          />
        </FormField>

        <FormField
          id="signup-confirm"
          label="Confirm Password"
          error={fieldErrors.confirm}
          required
        >
          <PasswordInput
            id="signup-confirm"
            label=""
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (fieldErrors.confirm) clearFieldError('confirm');
            }}
            placeholder="Repeat your password"
            disabled={isSubmitting}
          />
        </FormField>

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
