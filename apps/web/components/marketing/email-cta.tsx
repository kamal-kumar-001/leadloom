'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@leadloom/ui';
import { ArrowRight } from 'lucide-react';

/**
 * Landing email CTA. Its only job is to start sign-up: the
 * typed email prefills /signup. Nothing is stored on the landing page and
 * no email is sent from it (see docs/plan/LANDING.md hero CTA rules).
 */
export function EmailCta({
  id,
  className = '',
}: {
  id?: string;
  className?: string;
}) {
  const [email, setEmail] = useState('');
  const router = useRouter();
  const inputId = id ? `${id}-email` : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    router.push(clean ? `/signup?email=${encodeURIComponent(clean)}` : '/signup');
  };

  return (
    <form
      id={id}
      onSubmit={submit}
      className={`flex w-full max-w-md flex-col gap-3 sm:flex-row ${className}`}
    >
      <label htmlFor={inputId} className="sr-only">
        Work email
      </label>
      <input
        id={inputId}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Work email"
        autoComplete="email"
        className="h-12 w-full sm:flex-1 rounded-md border border-border-muted bg-canvas-surface px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
      />
      <Button type="submit" size="lg" variant="primary" className="h-12 px-6 text-sm">
        <span>Create workspace</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </form>
  );
}
