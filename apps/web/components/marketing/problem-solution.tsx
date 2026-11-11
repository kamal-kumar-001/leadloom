import React from 'react';
import { Reveal } from './reveal';

/** Problem to solution (skill A2 mid page argument). */
export function ProblemSolution() {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
        <Reveal className="rounded-xl border border-border-subtle bg-canvas-surface p-8">
          <p className="caption-3 mb-4 uppercase tracking-widest text-text-muted">The old way</p>
          <h3 className="heading-5">Buy credits. Blast lists. Get ignored.</h3>
          <p className="body-3 mt-4">
            Outbound platforms resell provider data as marked up credits, then help you
            send more messages to people who never asked for them. Volume goes up.
            Replies do not.
          </p>
        </Reveal>
        <Reveal delay={120} className="rounded-xl border border-brand-loom/30 bg-canvas-surface p-8">
          <p className="caption-3 mb-4 uppercase tracking-widest text-brand-loom">The LeadLoom way</p>
          <h3 className="heading-5">Start from the signal. Keep your own keys.</h3>
          <p className="body-3 mt-4">
            A hire, a funding round, a pricing change. LeadLoom is being built to start research
            from what buyers are actually doing: signals first, providers you pay
            directly, and your review in front of every message before anything sends.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
