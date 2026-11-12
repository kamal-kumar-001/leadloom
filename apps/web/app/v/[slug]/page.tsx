'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@leadloom/ui';
import { CheckCircle2, ArrowRight, Sparkles, Send } from 'lucide-react';
import { notify } from '@/lib/notify';

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'text' | 'choice';
  options?: string[];
}

interface SmokePageData {
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  heroCtaText: string;
  surveyQuestions: SurveyQuestion[];
}

export default function SmokeTestPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [page, setPage] = useState<SmokePageData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [showSurvey, setShowSurvey] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    params.then(async ({ slug }) => {
      if (!mounted) return;
      setSlug(slug);
      try {
        const res = await fetch(`/api/v/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (res.status === 404) { if (mounted) setNotFound(true); return; }
        if (!res.ok) throw new Error('load failed');
        const data = await res.json();
        if (mounted) setPage(data);
      } catch {
        if (mounted) setNotFound(true);
      }
    });
    return () => { mounted = false; };
  }, [params]);

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      notify.error('Please enter a valid work email');
      return;
    }
    if (page && page.surveyQuestions.length === 0) {
      void submitLead({});
      return;
    }
    setShowSurvey(true);
  };

  const submitLead = async (survey: Record<string, string>) => {
    if (!slug) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v/${encodeURIComponent(slug)}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, survey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify.error(data.error || 'Your response could not be saved. Please try again.');
        return;
      }
      setSubmitted(true);
      setShowSurvey(false);
    } catch {
      notify.error('Your response could not be saved. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page) return;
    const unanswered = page.surveyQuestions.some(
      (q) => q.type !== 'choice' && !(responses[q.text] ?? '').trim()
    );
    if (unanswered) {
      notify.error('Please answer every question before submitting.');
      return;
    }
    await submitLead(responses);
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-canvas text-text-primary flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold tracking-tight">This smoke test page isn&apos;t available.</h1>
          <p className="mt-3 text-sm text-text-secondary">It may have been removed or the link is wrong. Nothing was collected from you.</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-canvas text-text-primary flex items-center justify-center">
        <p className="text-sm text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col justify-between selection:bg-brand-loom/30 font-sans">
      <header className="border-b border-border-subtle bg-canvas-surface/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-xs text-brand-loom font-bold">
            ⚡
          </span>
          <span className="font-bold text-sm tracking-tight text-text-primary">{page.title}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-20 text-center flex-1 flex flex-col justify-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-text-primary leading-[1.15]">
          {page.headline}
        </h1>

        <p className="mt-6 text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl mx-auto">
          {page.subheadline}
        </p>

        {!submitted ? (
          <form onSubmit={handleInitialSubmit} className="mt-10 max-w-md mx-auto w-full flex flex-col sm:flex-row gap-3" noValidate>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email..."
              className="flex-1 rounded-md border border-border-muted bg-canvas-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-loom focus:outline-none focus:ring-1 focus:ring-brand-loom"
            />
            <Button size="md" variant="primary" type="submit" className="px-6 py-3" disabled={isSubmitting}>
              <span>{page.heroCtaText}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <div className="mt-10 p-6 rounded-xl border border-signal-verified bg-canvas-elevated max-w-md mx-auto animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-signal-verified font-bold text-base">
              <CheckCircle2 className="w-5 h-5" />
              <span>Your response has been saved</span>
            </div>
            <p className="mt-2 text-xs font-mono text-text-secondary">
              Thank you - the team behind this page can see your signup.
            </p>
          </div>
        )}
      </main>

      {showSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border-muted bg-canvas-surface p-6 shadow-2xl space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-loom" />
                <h3 className="font-bold text-base text-text-primary">A quick question before you join</h3>
              </div>
            </div>

            <form onSubmit={handleFinalSubmit} className="space-y-4 font-mono text-xs" noValidate>
              {page.surveyQuestions.map((q, i) => (
                <div key={q.id}>
                  <label className="block text-text-secondary mb-1.5 font-medium">
                    {i + 1}. {q.text}
                  </label>
                  {q.type === 'choice' && q.options ? (
                    <select
                      value={responses[q.text] ?? q.options[0]}
                      onChange={(e) => setResponses((r) => ({ ...r, [q.text]: e.target.value }))}
                      className="w-full rounded-lg border border-border-subtle bg-canvas-elevated p-2.5 text-xs text-text-primary focus:border-brand-loom focus:outline-none"
                    >
                      {q.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      rows={3}
                      value={responses[q.text] ?? ''}
                      onChange={(e) => setResponses((r) => ({ ...r, [q.text]: e.target.value }))}
                      className="w-full rounded-lg border border-border-subtle bg-canvas-elevated p-3 text-xs text-text-primary focus:border-brand-loom focus:outline-none"
                    />
                  )}
                </div>
              ))}

              <div className="pt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowSurvey(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" type="submit" disabled={isSubmitting}>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-border-subtle py-4 text-center text-xs font-mono text-text-muted">
        <span>Built with LeadLoom</span>
      </footer>
    </div>
  );
}
