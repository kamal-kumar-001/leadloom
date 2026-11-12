'use client';

import React, { useEffect } from 'react';
import { SmoothScrollProvider } from '../../../components/marketing/smooth-scroll-provider';
import { SiteNav } from '../../../components/marketing/site-nav';
import { Reveal } from '../../../components/marketing/reveal';
import { TaglineReveal } from '../../../components/marketing/tagline-reveal';
import { HeroSection } from '../../../components/marketing/hero-section';
import { ProofStrip } from '../../../components/marketing/proof-strip';
import { ProblemSolution } from '../../../components/marketing/problem-solution';
import { LiveGrid } from '../../../components/marketing/live-grid';
import { StepsSection } from '../../../components/marketing/steps-section';
import { ByokSection } from '../../../components/marketing/byok-section';
import { PricingSection } from '../../../components/marketing/pricing-section';
import { FaqSection } from '../../../components/marketing/faq-section';
import { FinalCta } from '../../../components/marketing/final-cta';
import { SiteFooter } from '../../../components/marketing/site-footer';

/**
 * LeadLoom landing page: composition only. Sections live in reusable
 * components under components/marketing/ (Kamal, 2026-11-12: reusable
 * components, no oversized pages).
 *
 * Structure and visual system follow the landing-page-design skill
 * (elayadesign/ai-design-skills, MIT) that Kamal shared on 2026-11-12,
 * within his own rules: light theme, dark purple + butter yellow accents
 * from shared tokens, hero email CTA that only prefills /signup, links only
 * to things that exist, no invented numbers, logos, testimonials or prices.
 *
 * Capability claims follow the deployed product (94fa7ab), confirmed against
 * the integrator's live-vs-local list on 2026-11-12. Sending is off
 * everywhere; nothing here claims live discovery or outreach.
 */
export default function MarketingPage() {
  // The landing is light by default (Kamal, 2026-11-10). Force light while
  // this page is mounted, then restore the user's stored theme on unmount.
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
      window.dispatchEvent(new Event('leadloom-theme-sync'));
    };
  }, []);

  return (
    <SmoothScrollProvider>
      <div className="light-page min-h-screen bg-canvas text-text-primary selection:bg-brand-loom/30">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteNav />

        <main id="main">
          <HeroSection />
          <ProofStrip />

          {/* Tagline reveal (skill B11, mandatory) */}
          <section className="px-4 py-24 sm:px-6 sm:py-32">
            <Reveal className="mx-auto max-w-[680px] text-center">
              <h2 className="heading-2 text-text-primary">
                <TaglineReveal text="Your next customer is already signaling. The only question is who sees it first." />
              </h2>
            </Reveal>
          </section>

          <ProblemSolution />
          <LiveGrid />
          <StepsSection />
          <ByokSection />
          <PricingSection />
          <FaqSection />
          <FinalCta />
        </main>

        <SiteFooter />
      </div>
    </SmoothScrollProvider>
  );
}
