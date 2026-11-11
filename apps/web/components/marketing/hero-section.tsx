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
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pb-24 sm:pt-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-16 h-[560px]"
        style={{
          background:
            'radial-gradient(560px 280px at 15% 0%, var(--accent-loom-glow), transparent 70%),' +
            'radial-gradient(520px 300px at 85% 10%, var(--accent-weave-glow), transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-[680px] text-center">
          <p className="caption-3 mb-6 inline-flex items-center gap-2 rounded-full border border-brand-loom/30 bg-canvas-surface px-3 py-1.5 text-brand-loom">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-verified" aria-hidden="true" />
            Early access is open
          </p>

          <h1 className="heading-1 hero-title mx-auto max-w-[680px]">
            Your outbound, rebuilt around buying signals
          </h1>

          <p className="body-2 mx-auto mt-6 max-w-[680px]">
            LeadLoom is an early access workspace for founders and small GTM teams.
            Live today: saved tables and encrypted storage for your own provider keys.
            Shipping next: enrichment, approval review, the idea validator and sending,
            clearly labeled until they are live.
          </p>

          <div id="get-started" className="mt-8 flex flex-col items-center gap-3 scroll-mt-32">
            <EmailCta id="hero" />
            <p className="caption-2 text-text-muted">
              Free during early access. Your email only prefills sign up.
            </p>
          </div>
        </div>

        <Reveal>
          <InteractiveHeroGrid />
        </Reveal>
      </div>
    </section>
  );
}
