'use client';

import React from 'react';
import { Reveal } from './reveal';
import { EmailCta } from './email-cta';
import { FloatHero } from './float-hero';

/**
 * Landing hero - Approval Key direction (selected by Kamal, 2026-11-12).
 * Editorial serif headline beside the floating hero: the approval queue
 * slab with its amber key, surrounded by floating buying-signal cards. The
 * subhead keeps the honest live/coming-soon breakdown. On mobile the key
 * visual sits inside the opening flow, between the headline and the CTA.
 * All motion honors reduced-motion; without WebGL a static card renders.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-36 sm:px-6 sm:pb-32 sm:pt-44">
      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="lg:col-start-1 lg:row-start-1">
          <Reveal>
            <p className="caption-3 mb-8 inline-flex items-center gap-2 tracking-[0.18em] text-text-muted">
              HUMAN APPROVAL, BY DESIGN.
            </p>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="hero-serif max-w-[560px] text-text-primary">
              Turn buying signals into
              <br />
              <span className="hero-title">outreach you stand behind.</span>
            </h1>
          </Reveal>
        </div>

        <Reveal delay={200} className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <FloatHero />
          <p className="caption-2 mt-24 text-center text-text-muted">
            Illustrative preview of the approval queue.
          </p>
        </Reveal>

        <div className="lg:col-start-1 lg:row-start-2">
          <Reveal delay={180}>
            <p className="body-2 mt-2 max-w-[520px]">
              LeadLoom finds contacts from buying signals and prepares the outreach -
              then waits for your approval. Live today: saved tables and encrypted storage for
              your own provider keys. Shipping next: enrichment, the approval flow and sending,
              clearly labeled until they are live.
            </p>
          </Reveal>

          <Reveal delay={270}>
            <div id="get-started" className="mt-10 flex flex-col items-start gap-3 scroll-mt-32">
              <EmailCta id="hero" />
              <p className="caption-2 text-text-muted">
                Free during early access. Your email only prefills sign up.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
