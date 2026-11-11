'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Badge, BrandMark } from '@leadloom/ui';
import { SmoothScrollProvider } from '../../components/marketing/smooth-scroll-provider';
import dynamic from 'next/dynamic';
import { AmbientLoomFallback } from '../../components/marketing/3d/ambient-fallback';
const LivingLoomCanvas = dynamic(() => import('../../components/marketing/3d/living-loom-canvas').then(m => m.LivingLoomCanvas), { ssr: false, loading: () => <AmbientLoomFallback /> });
import { InteractiveHeroGrid } from '../../components/marketing/interactive-hero-grid';
import { SavingsCalculator } from '../../components/marketing/savings-calculator';
import { BentoGridSection } from '../../components/marketing/bento-grid';
import { IdeaValidatorShowcase } from '../../components/marketing/idea-validator-showcase';
import { ArchitectureTabs } from '../../components/marketing/architecture-tabs';
import { EmailCta } from '../../components/marketing/email-cta';
import { ArrowRight, CheckCircle, ChevronDown } from 'lucide-react';

export default function MarketingPage() {
  const [hoveredCta, setHoveredCta] = useState<'indigo' | 'matrix'>('indigo');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // The landing is light by default (Kamal, 2026-11-10). Force light while
  // this page is mounted (covers client-side navigation, where the layout's
  // inline script is inert), then restore the user's stored theme on unmount.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme-lock', 'marketing');
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
    return () => {
      let stored = 'dark';
      try {
        stored = localStorage.getItem('leadloom_theme') === 'light' ? 'light' : 'dark';
      } catch {}
      root.removeAttribute('data-theme-lock');
      root.setAttribute('data-theme', stored);
      root.classList.toggle('dark', stored === 'dark');
      // Let the shared ThemeProvider sync its state to the restored theme.
      window.dispatchEvent(new Event('leadloom-theme-sync'));
    };
  }, []);

  const faqs = [
    {
      q: 'How will LeadLoom be priced?',
      a: 'LeadLoom is a hosted product. Pricing has not been announced yet. You always pay your data and email providers directly with your own keys.',
    },
    {
      q: 'Why bring your own keys?',
      a: 'You will pay providers like Apollo, Hunter, or OpenAI directly at their own prices. Today you can store keys with encryption at rest; connections that use them are planned.',
    },
    {
      q: 'Is LeadLoom hosted or do I run it myself?',
      a: 'LeadLoom is hosted for you - there is nothing to install or run. The engine runs on our infrastructure (Next.js, NestJS, PostgreSQL 16 + pgvector, Redis 7) and you connect your own provider keys.',
    },
    {
      q: 'How will the Pre-Product Idea Validator smoke-test ideas?',
      a: 'The validator is planned and not live yet. It will turn a 2-sentence hypothesis into a 1-page smoke-test micro-site with a waitlist form and a short survey, plus an enriched ICP test list.',
    },
  ];

  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-canvas text-text-primary selection:bg-brand-loom/30">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-50 border-b border-border-subtle bg-canvas/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-lg">
              <span className="w-8 h-8 rounded-lg bg-brand-loom/20 border border-brand-loom/40 flex items-center justify-center text-brand-loom">
                <BrandMark className="w-5 h-5" />
              </span>
              <span>LeadLoom</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm text-text-secondary font-medium">
              <a href="#waterfall" className="hover:text-text-primary transition-colors">Waterfall Engine</a>
              <a href="#validator" className="hover:text-text-primary transition-colors">Idea Validator</a>
              <a href="#calculator" className="hover:text-text-primary transition-colors">Pricing & Savings</a>
              <a href="#architecture" className="hover:text-text-primary transition-colors">Architecture</a>
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign in
              </Link>
              <Link href="#find-leads">
                <Button size="sm" variant="primary">
                  <span>Find Leads</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-28 px-4 sm:px-6 max-w-6xl mx-auto">
          {/* Restrained token-driven gradient backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-16 h-[560px]"
            style={{
              background:
                'radial-gradient(560px 280px at 15% 0%, var(--accent-loom-glow), transparent 70%),' +
                'radial-gradient(480px 240px at 85% 10%, var(--accent-weave-glow), transparent 70%),' +
                'radial-gradient(520px 260px at 50% 35%, var(--accent-matrix-glow), transparent 70%)',
            }}
          />
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="loom" className="mb-4">
              🧵 Signal-driven outbound • Bring your own keys
            </Badge>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-text-primary leading-[1.1]">
              Weave buying signals into qualified revenue.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-loom via-brand-weave to-signal-verified">
                Zero data markups.
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto">
              LeadLoom is in early access. Live today: your workspace, saved lead lists, and encrypted provider key storage. Waterfall enrichment, idea validation, and sequencing with your own Apollo, Hunter, or OpenAI keys are planned next.
            </p>

            {/* Email CTA: starts sign-up only (email prefills /signup) */}
            <div
              className="mt-8 flex flex-col items-center gap-3"
              onMouseEnter={() => setHoveredCta('matrix')}
              onMouseLeave={() => setHoveredCta('indigo')}
            >
              <EmailCta id="find-leads" />
              <p className="text-xs text-text-muted">
                Your email only prefills sign-up. Nothing is stored or sent from this page.
              </p>
            </div>
          </div>

          {/* Interactive 3D WebGL Living Loom Core */}
          <div className="mb-12">
            <LivingLoomCanvas lightingState={hoveredCta} />
          </div>

          {/* Playable Hero Mini-Grid */}
          <div id="waterfall" className="mt-12 scroll-mt-24">
            <InteractiveHeroGrid />
          </div>
        </section>

        {/* Social Proof Bar */}
        <section className="py-12 border-y border-border-subtle bg-canvas-surface/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-6">
              Illustrative sample ecosystem - the modern stack LeadLoom is designed for. No endorsement or live integration implied.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 font-mono font-bold text-sm text-text-muted">
              <span className="hover:text-text-primary transition-colors">▲ VERCEL</span>
              <span className="hover:text-text-primary transition-colors">⚡ SUPABASE</span>
              <span className="hover:text-text-primary transition-colors">🚂 RAILWAY</span>
              <span className="hover:text-text-primary transition-colors">✉️ RESEND</span>
              <span className="hover:text-text-primary transition-colors">📦 DOCKER</span>
              <span className="hover:text-text-primary transition-colors">🦔 POSTHOG</span>
            </div>
          </div>
        </section>

        {/* Pre-Product Idea Validator Section */}
        <div id="validator" className="scroll-mt-16">
          <IdeaValidatorShowcase />
        </div>

        {/* Savings Calculator Section */}
        <div id="calculator" className="scroll-mt-16">
          <SavingsCalculator />
        </div>

        {/* 3-Pillar Asymmetric Bento Grid */}
        <BentoGridSection />

        {/* Developer Architecture Tabs */}
        <div id="architecture" className="scroll-mt-16">
          <ArchitectureTabs />
        </div>

        {/* Pricing: nothing announced yet - no invented prices or plan benefits */}
        <section className="py-14 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="loom" className="mb-3">
              Transparent Pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
              Simple, honest pricing. Never pay for credits again.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-text-secondary">
              LeadLoom pricing has not been announced yet. One thing is decided: you pay your data and email providers directly, at their own prices - LeadLoom does not resell marked-up credits.
            </p>
          </div>

          <div className="p-8 rounded-xl border border-border-muted bg-canvas-surface/60 max-w-2xl mx-auto">
            <ul className="space-y-3 text-xs text-text-secondary font-mono">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-signal-verified" /> Hosted for you - nothing to install or run
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-signal-verified" /> Provider key storage with AES-256-GCM encryption at rest
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-signal-verified" /> Workspace dashboard with saved tables and lists
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-signal-verified" /> Planned capabilities are labelled &quot;Not available yet&quot; - never faked
              </li>
            </ul>
            <Link href="/signup" className="mt-8 block">
              <Button variant="primary" className="w-full">
                Get started
              </Button>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 border-t border-border-subtle max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-text-primary mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-lg border border-border-subtle bg-canvas-surface/60 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-4 text-left flex items-center justify-between text-sm font-medium text-text-primary hover:bg-canvas-elevated/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-text-muted transition-transform duration-200 ${
                      openFaq === index ? 'rotate-180 text-brand-loom' : ''
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="p-4 pt-0 text-xs text-text-secondary leading-relaxed border-t border-border-subtle/50 bg-canvas-elevated/20">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final High-Conversion CTA Block */}
        <section className="relative py-14 sm:py-24 border-t border-border-subtle bg-gradient-to-b from-canvas to-canvas-surface overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[360px]"
            style={{
              background:
                'radial-gradient(640px 300px at 50% 110%, var(--accent-loom-glow), transparent 70%)',
            }}
          />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-text-primary">
              Ready to take back your GTM margins?
            </h2>
            <p className="mt-4 text-sm sm:text-base text-text-secondary max-w-xl mx-auto">
              Bring your own provider keys and weave buying signals into qualified pipeline - no middleman markups.
            </p>
            <div className="mt-8 flex justify-center">
              <EmailCta id="find-leads-bottom" />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-subtle py-8 text-center text-xs font-mono text-text-muted">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span>© 2026 LeadLoom. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <Link href="/login" className="hover:text-text-primary">Sign in</Link>
              <a href="#architecture" className="hover:text-text-primary">Architecture</a>
            </div>
          </div>
        </footer>
      </div>
    </SmoothScrollProvider>
  );
}
