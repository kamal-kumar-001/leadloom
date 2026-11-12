import React from 'react';
import { Reveal } from './reveal';

/** How it works (skill A2: three steps). Every step is live today. */
const STEPS = [
  {
    n: '1',
    title: 'Create your workspace',
    body: 'Sign up with your email and a one time code. No card, no install.',
  },
  {
    n: '2',
    title: 'Add your own provider keys',
    body: 'Store keys for Apollo, Hunter, OpenAI and 7 more, sealed with AES-256-GCM at rest.',
  },
  {
    n: '3',
    title: 'Build lead lists in tables',
    body: 'Save leads into workspace tables. Enrichment and outreach join the same flow next.',
  },
];

export function StepsSection() {
  return (
    <section className="border-t border-border-subtle bg-canvas-surface px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-16 max-w-[680px] text-center">
          <h2 className="heading-2">Up and running in one sitting</h2>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 100}>
              <article className="h-full mcard border border-border-subtle bg-canvas p-6">
                <p className="heading-3 text-brand-loom">{step.n}</p>
                <h3 className="title-1 mt-4">{step.title}</h3>
                <p className="body-6 mt-2">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
