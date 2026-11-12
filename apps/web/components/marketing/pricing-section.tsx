import React from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Reveal } from './reveal';

/**
 * Pricing block (skill A4 risk reversal): no invented prices. What is decided
 * (pay providers directly, early access free) is stated plainly.
 */
export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border-subtle px-4 py-24 sm:px-6 scroll-mt-24">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mx-auto mb-12 max-w-[680px] text-center">
          <h2 className="heading-2">Pricing, said plainly</h2>
          <p className="body-2 mt-4">
            LeadLoom pricing has not been announced, and early access is free. One thing
            is decided: you pay your data and email providers directly, at their own
            prices. LeadLoom does not resell marked up credits.
          </p>
        </Reveal>
        <Reveal>
          <div className="mx-auto max-w-2xl mcard border border-border-muted bg-canvas-surface p-8">
            <ul className="space-y-3">
              {[
                'Early access is free while the product is being built',
                'Provider key storage with AES-256-GCM encryption at rest',
                'Workspace dashboard with saved tables and lists',
                'Planned capabilities are labeled coming soon, never faked',
              ].map((line) => (
                <li key={line} className="body-5 flex items-center gap-3 text-text-secondary">
                  <CheckCircle className="h-5 w-5 shrink-0 text-signal-verified" />
                  {line}
                </li>
              ))}
            </ul>
            <a
              href="#get-started"
              className="button-md mt-8 flex w-full items-center justify-center gap-2 rounded-md bg-brand-loom px-6 py-3 text-text-onAccent transition-all duration-300 motion-base hover:bg-brand-loomHover active:scale-[0.98]"
            >
              Start free
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
