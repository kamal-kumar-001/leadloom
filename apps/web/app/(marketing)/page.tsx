'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, MagneticButton, Badge, SpotlightCard } from '@leadloom/ui';
import { SmoothScrollProvider } from '../../components/marketing/smooth-scroll-provider';
import { LivingLoomCanvas } from '../../components/marketing/3d/living-loom-canvas';
import { InteractiveHeroGrid } from '../../components/marketing/interactive-hero-grid';
import { SavingsCalculator } from '../../components/marketing/savings-calculator';
import { BentoGridSection } from '../../components/marketing/bento-grid';
import { IdeaValidatorShowcase } from '../../components/marketing/idea-validator-showcase';
import { ArchitectureTabs } from '../../components/marketing/architecture-tabs';
import { ArrowRight, Terminal, Star, CheckCircle, HelpCircle, Shield, ChevronDown } from 'lucide-react';

export default function MarketingPage() {
  const [hoveredCta, setHoveredCta] = useState<'indigo' | 'matrix'>('indigo');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does LeadLoom make money if the core software is free?',
      a: 'The core engine is open-source and free forever for self-hosting. We monetize through managed Cloud Pro hosting, proxy network pools, and enterprise dedicated VPC support.',
    },
    {
      q: 'Is Bring-Your-Own-Key (BYOK) genuinely cheaper than buying Clay/PumpGTM credits?',
      a: 'Yes. Incumbents charge a 400% to 1,000% markup on wholesale APIs. With LeadLoom, you connect your own Apollo, Hunter, or OpenAI keys and pay wholesale developer prices with zero markup.',
    },
    {
      q: 'Can I really run the entire engine on a $5/month VPS?',
      a: 'Yes. LeadLoom is containerized to run comfortably under 3.5GB RAM on a 4GB VPS (Hetzner, OVH, or Linode) using PostgreSQL 16 + pgvector, Redis 7, NestJS, and Next.js.',
    },
    {
      q: 'How does the Pre-Product Idea Validator smoke-test ideas?',
      a: 'You enter a 2-sentence hypothesis. LeadLoom auto-deploys a 1-page smoke-test micro-site (/v/[slug]) with a waitlist form and 2-question survey, while enriching an ICP test list and generating an outreach sequence.',
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
                🧵
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
              <a
                href="https://github.com/leadloom/leadloom"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-muted text-xs font-mono text-text-muted hover:text-text-primary hover:border-brand-loom/40 transition-colors"
              >
                <Star className="w-3.5 h-3.5 fill-current text-brand-loom" />
                <span>3.8k Stars</span>
              </a>
              <Link href="/workspace">
                <Button size="sm" variant="primary">
                  <span>Open Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative pt-20 pb-28 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="loom" className="mb-4">
              🧵 Open-Core Signal Engine • Apache 2.0 / MIT Licensed
            </Badge>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-text-primary leading-[1.1]">
              Weave buying signals into qualified revenue.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-loom via-brand-weave to-signal-verified">
                Zero data markups.
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto">
              The open-source alternative to Clay and PumpGTM. Plug in your own Apollo, Hunter, and OpenAI keys to run adaptive waterfalls, validate startup ideas, and sequence cold email at pure wholesale cost.
            </p>

            {/* Magnetic CTA Group */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <MagneticButton>
                <Link
                  href="/workspace"
                  onMouseEnter={() => setHoveredCta('indigo')}
                >
                  <Button size="lg" variant="primary" className="text-base px-8 py-3.5">
                    <span>Launch Free Cloud Trial</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </MagneticButton>

              <MagneticButton>
                <button
                  onMouseEnter={() => setHoveredCta('matrix')}
                  onClick={() => navigator.clipboard.writeText('docker compose up -d leadloom')}
                  className="inline-flex items-center gap-2 rounded-md border border-border-muted bg-canvas-elevated px-6 py-3.5 text-sm font-mono text-text-secondary hover:text-brand-matrix hover:border-brand-matrix/40 transition-colors shadow-sm"
                >
                  <Terminal className="w-4 h-4" />
                  <span>$ docker compose up -d leadloom</span>
                </button>
              </MagneticButton>
            </div>
          </div>

          {/* Interactive 3D WebGL Living Loom Core */}
          <div className="mb-12">
            <LivingLoomCanvas lightingState={hoveredCta} />
          </div>

          {/* Playable Hero Mini-Grid */}
          <div id="waterfall" className="mt-12">
            <InteractiveHeroGrid />
          </div>
        </section>

        {/* Social Proof Bar */}
        <section className="py-12 border-y border-border-subtle bg-canvas-surface/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-6">
              Trusted by growth engineers and technical founders at modern teams
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
        <div id="validator">
          <IdeaValidatorShowcase />
        </div>

        {/* Savings Calculator Section */}
        <div id="calculator">
          <SavingsCalculator />
        </div>

        {/* 3-Pillar Asymmetric Bento Grid */}
        <BentoGridSection />

        {/* Developer Architecture Tabs */}
        <div id="architecture">
          <ArchitectureTabs />
        </div>

        {/* Pricing Matrix */}
        <section className="py-24 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="loom" className="mb-3">
              Transparent Pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
              Simple, honest pricing. Never pay for credits again.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tier 1: Community Edition */}
            <div className="p-8 rounded-xl border border-border-muted bg-canvas-surface/60 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-text-primary">Community Edition</h3>
                <p className="mt-1 text-xs text-text-muted">For developers, solo founders, and hackers</p>
                <div className="mt-6 text-4xl font-bold font-mono text-text-primary">
                  $0 <span className="text-sm font-normal text-text-muted">Forever</span>
                </div>
                <ul className="mt-6 space-y-3 text-xs text-text-secondary font-mono">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Unlimited rows & workspaces
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Unlimited BYOK API Keys (AES-256-GCM)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Local Playwright scraping workers
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> SMTP/IMAP mailbox pool rotation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Single-command Docker Compose deploy
                  </li>
                </ul>
              </div>
              <Link href="/workspace" className="mt-8">
                <Button variant="outline" className="w-full">
                  Deploy Self-Hosted ($0)
                </Button>
              </Link>
            </div>

            {/* Tier 2: Cloud Pro */}
            <SpotlightCard className="p-8 border-brand-loom/40 bg-canvas-surface/90 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-text-primary">Cloud Pro</h3>
                  <Badge variant="loom">Popular</Badge>
                </div>
                <p className="mt-1 text-xs text-text-muted">For high-velocity outbound and revenue teams</p>
                <div className="mt-6 text-4xl font-bold font-mono text-brand-loom">
                  $49 <span className="text-sm font-normal text-text-muted">/month</span>
                </div>
                <ul className="mt-6 space-y-3 text-xs text-text-secondary font-mono">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Everything in Community Edition
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Fully managed cloud infrastructure
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Managed residential proxy network
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Automated mailbox warm-up mesh
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-signal-verified" /> Priority email & Discord support
                  </li>
                </ul>
              </div>
              <Link href="/workspace" className="mt-8">
                <Button variant="primary" className="w-full">
                  Start 14-Day Free Trial
                </Button>
              </Link>
            </SpotlightCard>
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
        <section className="py-24 border-t border-border-subtle bg-gradient-to-b from-canvas to-canvas-surface">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-text-primary">
              Ready to take back your GTM margins?
            </h2>
            <p className="mt-4 text-sm sm:text-base text-text-secondary max-w-xl mx-auto">
              Join 2,000+ growth engineers weaving signals into qualified revenue without paying middleman taxes.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link href="/workspace">
                <Button size="lg" variant="primary">
                  <span>Open Free Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-subtle py-8 text-center text-xs font-mono text-text-muted">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span>© 2026 LeadLoom Open-Core. Released under MIT / Apache 2.0.</span>
            <div className="flex items-center gap-6">
              <Link href="/workspace" className="hover:text-text-primary">Workspace</Link>
              <a href="https://github.com/leadloom/leadloom" className="hover:text-text-primary">GitHub</a>
              <a href="#architecture" className="hover:text-text-primary">Docker Monolith</a>
            </div>
          </div>
        </footer>
      </div>
    </SmoothScrollProvider>
  );
}
