'use client';

import React from 'react';
import { Reveal } from './reveal';
import { EmailCta } from './email-cta';
import { InteractiveHeroGrid } from './interactive-hero-grid';

/**
 * Landing hero (skill A2 above the fold): badge, headline, subheadline with
 * the early access qualifier, the one primary CTA (email prefills /signup,
 * nothing else), a proof line, and the interactive simulated waterfall as
 * the hero visual. Headline states intended value; it does not promise live
 * discovery. Gradients come from shared theme tokens (LANDING.md).
 *
 * Premium pass (Kamal, 2026-11-12): more vertical air, a staggered entrance
 * on the base curve, and the demo presented as a floating product card with
 * a soft brand glow. Copy and honesty labels unchanged.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-36 sm:px-6 sm:pb-32 sm:pt-48">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 h-[640px]"
        style={{
          background:
            'radial-gradient(620px 320px at 50% 0%, var(--accent-loom-glow), transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto mb-16 max-w-[880px] text-center sm:mb-20">
          <Reveal>
            <p className="caption-3 mb-8 inline-flex items-center gap-2 rounded-full border border-brand-loom/25 bg-canvas-surface px-4 py-1.5 text-brand-loom shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-verified" aria-hidden="true" />
              Early access is open
            </p>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="heading-1 mx-auto max-w-[820px] text-text-primary">
              Your outbound,
              <br />
              <span className="hero-title">rebuilt around buying signals</span>
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="body-2 mx-auto mt-7 max-w-[560px]">
              LeadLoom is an early access workspace for founders and small GTM teams.
              Live today: saved tables and encrypted storage for your own provider keys.
              Shipping next: enrichment, approval review, the idea validator and sending,
              clearly labeled until they are live.
            </p>
          </Reveal>

          <Reveal delay={270}>
            <div id="get-started" className="mt-10 flex flex-col items-center gap-3 scroll-mt-32">
              <EmailCta id="hero" />
              <p className="caption-2 text-text-muted">
                Free during early access. Your email only prefills sign up.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={380}>
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0"
              style={{
                background:
                  'radial-gradient(closest-side at 50% 20%, var(--accent-loom-glow), transparent 75%)',
              }}
            />
            <div className="hero-visual relative">
              <InteractiveHeroGrid />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
