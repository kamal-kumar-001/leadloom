import React from 'react';
import { Reveal } from './reveal';

/**
 * Problem to solution (skill A2 mid page argument). Asymmetric editorial
 * split: the recessed "old way" column gives the elevated "LeadLoom way"
 * column the visual weight. Copy unchanged in meaning.
 */
export function ProblemSolution() {
  return (
    <section className="px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-12 md:items-end">
        <Reveal className="md:col-span-5">
          <div className="border border-border-subtle bg-canvas px-8 py-10 opacity-80">
            <p className="caption-3 mb-6 flex items-baseline justify-between uppercase tracking-widest text-text-muted">
              The old way
              <span aria-hidden="true" className="heading-2 select-none text-border-muted">01</span>
            </p>
            <h3 className="heading-5 text-text-secondary">
              <span className="line-through decoration-text-muted/60 decoration-2">Buy credits.</span>{' '}
              <span className="line-through decoration-text-muted/60 decoration-2">Blast lists.</span>{' '}
              Get ignored.
            </h3>
            <p className="body-3 mt-4 text-text-muted">
              Outbound platforms resell provider data as marked up credits, then help you
              send more messages to people who never asked for them. Volume goes up.
              Replies do not.
            </p>
          </div>
        </Reveal>
        <Reveal delay={120} className="md:col-span-7">
          <div className="mcard relative overflow-hidden border border-brand-loom/30 bg-canvas-surface px-8 py-10 sm:px-10 sm:py-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-40"
              style={{
                background:
                  'radial-gradient(420px 160px at 30% 0%, var(--accent-loom-glow), transparent 70%)',
              }}
            />
            <p className="caption-3 relative mb-6 flex items-baseline justify-between uppercase tracking-widest text-brand-loom">
              The LeadLoom way
              <span aria-hidden="true" className="heading-2 select-none text-brand-loom/25">02</span>
            </p>
            <h3 className="heading-3 relative">Start from the signal. Keep your own keys.</h3>
            <p className="body-2 relative mt-4 max-w-[52ch]">
              A hire, a funding round, a pricing change. LeadLoom is being built to start research
              from what buyers are actually doing: signals first, providers you pay
              directly, and your review in front of every message before anything sends.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
