import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Reveal } from './reveal';

/**
 * Cost transparency without invented numbers: the case for bring your own
 * keys, stated qualitatively. No dollar figures or savings claims without
 * current vendor pricing evidence.
 */
export function ByokSection() {
  return (
    <section id="byok" className="border-t border-border-subtle px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-16 max-w-[680px] text-center">
          <h2 className="heading-2">Pay providers, not middlemen</h2>
          <p className="body-2 mt-4">
            Credit based platforms resell provider data at a markup, and the credits can
            run out mid campaign. LeadLoom never resells data: you bring your own keys
            and pay each provider directly at its published price.
          </p>
        </Reveal>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <Reveal className="mcard border border-border-subtle bg-canvas-surface p-8">
            <h3 className="title-2 text-text-muted">Credit bundles elsewhere</h3>
            <ul className="mt-4 space-y-3">
              {[
                'Provider data resold at platform prices',
                'Credits expire or run out mid campaign',
                'Your provider relationship belongs to the platform',
              ].map((line) => (
                <li key={line} className="body-6 flex items-start gap-3 text-text-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120} className="rounded-xl border border-brand-loom/30 bg-canvas-surface p-8">
            <h3 className="title-2">Your own keys on LeadLoom</h3>
            <ul className="mt-4 space-y-3">
              {[
                'Every provider paid directly at its published price',
                'No credits to buy, track or run out of',
                'Your accounts, your limits, your relationship',
              ].map((line) => (
                <li key={line} className="body-5 flex items-start gap-3 text-text-secondary">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-verified" />
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
