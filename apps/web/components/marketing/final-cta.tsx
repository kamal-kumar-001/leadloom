import React from 'react';
import { Reveal } from './reveal';
import { EmailCta } from './email-cta';

/** Final CTA (skill A2: identical offer to the top). */
export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border-subtle px-4 py-24 sm:px-6 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[360px]"
        style={{
          background:
            'radial-gradient(640px 300px at 50% 110%, var(--accent-loom-glow), transparent 70%)',
        }}
      />
      <Reveal className="relative mx-auto max-w-[680px] text-center">
        <h2 className="heading-2">Create your workspace today</h2>
        <p className="body-2 mt-4">
          Saved tables and provider key storage are live. Enrichment, the idea
          validator and sending join next. Free while in early access.
        </p>
        <div className="mt-8 flex justify-center">
          <EmailCta id="bottom" />
        </div>
      </Reveal>
    </section>
  );
}
