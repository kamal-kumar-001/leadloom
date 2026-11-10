'use client';

import React, { useState, useEffect } from 'react';
import { Button, Badge } from '@leadloom/ui';
import { CheckCircle2, ArrowRight, ShieldCheck, Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function SmokeTestPage({ params }: { params: Promise<{ slug: string }> }) {
  const [email, setEmail] = useState('');
  const [showSurvey, setShowSurvey] = useState(false);
  const [submitted] = useState(false);
  const [previewNotice, setPreviewNotice] = useState(false);
  const [q1Response, setQ1Response] = useState('');
  const [q2Response, setQ2Response] = useState('4-10');

  const [slug, setSlug] = useState('preview');
  useEffect(() => { let mounted = true; params.then(value => { if (mounted) setSlug(value.slug); }); return () => { mounted = false; }; }, [params]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid work email');
      return;
    }
    setShowSurvey(true);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v/${slug}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          survey: { frustration: q1Response, teamSize: q2Response },
        }),
      });

      if (res.status === 429) {
        toast.error('Submission rate limit exceeded. Please try again later.');
        return;
      }

      if (!res.ok) {
        toast.error('Failed to submit waitlist registration.');
        return;
      }

      const data = await res.json();
      toast.success(
        data.isMock
          ? 'Demo preview: waitlist spot reserved and intent score recorded!'
          : 'Waitlist spot reserved! Thank you for validating this idea.'
      );
      setPreviewNotice(true);
      setShowSurvey(false);
    } catch {
      toast.error('Network error during waitlist submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col justify-between selection:bg-brand-loom/30 font-sans">
      {/* Micro-Site Header */}
      <header className="border-b border-border-subtle bg-canvas-surface/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-xs text-brand-loom font-bold">
            ⚡
          </span>
          <span className="font-bold text-sm tracking-tight text-text-primary">
            Project {slug.replace(/-/g, ' ').toUpperCase()}
          </span>
        </div>
        <Badge variant="matrix">Demo preview • Not collecting signups</Badge>
      </header>

      {/* Main Smoke-Test Offer Hero */}
      <main className="max-w-3xl mx-auto px-4 py-20 text-center flex-1 flex flex-col justify-center">
        <Badge variant="loom" className="mx-auto mb-4 font-mono text-xs">
          Exclusive Founder Preview
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-text-primary leading-[1.15]">
          Cut 40% of your idle Kubernetes bill in 10 minutes.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-loom via-brand-weave to-signal-verified">
            Zero configuration.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl mx-auto">
          We built an automated cluster right-sizer for Series A &amp; B engineering teams. Connect your AWS EKS or GCP GKE in one command and let automated agents reclaim idle memory.
        </p>

        {/* Quantified Benefit Points */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs font-mono text-text-muted">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <CheckCircle2 className="w-4 h-4 text-signal-verified" /> No DaemonSets Required
          </span>
          <span className="flex items-center gap-1.5 text-text-secondary">
            <CheckCircle2 className="w-4 h-4 text-signal-verified" /> Real-Time Slack Bill Alerts
          </span>
          <span className="flex items-center gap-1.5 text-text-secondary">
            <CheckCircle2 className="w-4 h-4 text-signal-verified" /> $0 Upfront Risk
          </span>
        </div>

        {previewNotice && <p role="status" className="mt-6 text-sm text-brand-loom">Preview only: your response was not saved.</p>}
        {/* Preview form; no server-side signup is claimed. */}
        {!submitted ? (
          <form onSubmit={handleInitialSubmit} className="mt-10 max-w-md mx-auto w-full flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email..."
              className="flex-1 rounded-md border border-border-muted bg-canvas-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-loom focus:outline-none focus:ring-1 focus:ring-brand-loom"
            />
            <Button size="md" variant="primary" type="submit" className="px-6 py-3">
              <span>Request Early Access</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <div className="mt-10 p-6 rounded-xl border border-signal-verified/30 bg-signal-verified/10 max-w-md mx-auto animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-signal-verified font-bold text-base">
              <CheckCircle2 className="w-5 h-5" />
              <span>Your response has been saved</span>
            </div>
            <p className="mt-2 text-xs font-mono text-text-secondary">
              We received your survey feedback. The founding team will reach out to schedule your 15-minute beta onboarding.
            </p>
          </div>
        )}
      </main>

      {/* 2-Question Pain-Point Survey Modal */}
      {showSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border-muted bg-canvas-surface p-6 shadow-2xl space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-loom" />
                <h3 className="font-bold text-base text-text-primary">Two Quick Questions for Early Access</h3>
              </div>
              <p className="text-xs font-mono text-text-muted mt-1">Help the founding team prioritize your prototype features</p>
            </div>

            <form onSubmit={handleFinalSubmit} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-text-secondary mb-1.5 font-medium">
                  1. What is your single biggest frustration with your cloud/K8s bill right now?
                </label>
                <textarea
                  required
                  rows={3}
                  value={q1Response}
                  onChange={(e) => setQ1Response(e.target.value)}
                  placeholder="e.g., Datadog and idle container pods are burning $8k/mo without attribution..."
                  className="w-full rounded-lg border border-border-subtle bg-canvas-elevated p-3 text-xs text-text-primary focus:border-brand-loom focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1.5 font-medium">
                  2. How many engineers currently touch your infrastructure?
                </label>
                <select
                  value={q2Response}
                  onChange={(e) => setQ2Response(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-canvas-elevated p-2.5 text-xs text-text-primary focus:border-brand-loom focus:outline-none"
                >
                  <option value="1-3">1 to 3 engineers (Early Stage)</option>
                  <option value="4-10">4 to 10 engineers (Growth)</option>
                  <option value="10+">10+ engineers (Scale)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowSurvey(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" type="submit">
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit &amp; Claim Early Spot</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border-subtle py-4 text-center text-xs font-mono text-text-muted">
        <span>Powered by LeadLoom Idea Validation Engine • Zero-Code Smoke-Test Infrastructure</span>
      </footer>
    </div>
  );
}
