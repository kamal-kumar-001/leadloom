import React from 'react';
import { Reveal } from './reveal';

/**
 * Fact strip: true product facts, not customer proof (there are no customers
 * yet) and not process claims. Every item is verifiable in the product today.
 */
const FACTS = [
  { big: '10', small: 'providers with encrypted key storage' },
  { big: 'AES-256-GCM', small: 'envelope encryption for stored keys' },
  { big: '0', small: 'marked up credits, now or later' },
  { big: 'Free', small: 'while LeadLoom is in early access' },
];

export function ProofStrip() {
  return (
    <section className="border-y border-border-subtle bg-canvas-surface py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.small}>
              <p className="heading-4 text-text-primary">{fact.big}</p>
              <p className="caption-2 mt-2 text-text-muted">{fact.small}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
