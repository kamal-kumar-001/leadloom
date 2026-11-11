'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Reveal } from './reveal';

/** FAQ (skill A2 objection handling, 6 to 12 questions). Answers are honest
 * about live vs coming soon and never invent prices, dates or capabilities. */
const FAQS = [
  {
    q: 'Is LeadLoom live?',
    a: 'Yes, in early access. Today you can create a workspace, save tables and store provider keys. Enrichment, approval review, the idea validator and sending are labeled coming soon until they ship.',
  },
  {
    q: 'What does LeadLoom cost?',
    a: 'Pricing has not been announced, and early access is free. One decision is final: you pay data and email providers directly at their own prices. LeadLoom does not resell marked up credits.',
  },
  {
    q: 'Why bring my own provider keys?',
    a: 'Credit based platforms resell provider data at a markup. With your own keys you pay Apollo, Hunter, OpenAI and the rest directly, at their published prices, and you keep the relationship.',
  },
  {
    q: 'Does LeadLoom send emails for me?',
    a: 'Not yet. Sending is being built behind an approval step where you review the exact message for every recipient. Until that ships, LeadLoom sends nothing at all.',
  },
  {
    q: 'Which providers does LeadLoom support?',
    a: 'Apollo, Hunter, AnyMail Finder, Dropcontact, Prospeo, OpenAI, Anthropic, DeepSeek, Groq and Perplexity. You can store keys for all ten today, encrypted at rest; live enrichment runs are coming soon.',
  },
  {
    q: 'How are my keys stored?',
    a: 'Sealed with AES-256-GCM envelope encryption at rest. After you save a key it is never displayed again, only masked.',
  },
  {
    q: 'Do you automate LinkedIn or X?',
    a: 'No. LinkedIn has no official API for sequenced direct messages, and LeadLoom does not automate personal accounts or scrape sessions.',
  },
  {
    q: 'Who is LeadLoom for?',
    a: 'Founders and small GTM teams who run their own outbound and want signal first research without resold data credits.',
  },
];

export function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="border-t border-border-subtle px-4 py-24 sm:px-6 scroll-mt-24">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mb-12 text-center">
          <h2 className="heading-2">Questions, answered straight</h2>
        </Reveal>
        <div className="space-y-4">
          {FAQS.map((faq, index) => (
            <Reveal key={faq.q} delay={Math.min(index * 40, 200)}>
              <div className="overflow-hidden rounded-lg border border-border-subtle bg-canvas-surface">
                <button
                  type="button"
                  aria-expanded={openFaq === index}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors duration-300 motion-base hover:bg-canvas-elevated"
                >
                  <span className="title-3">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-500 motion-base ${
                      openFaq === index ? 'rotate-180 text-brand-loom' : ''
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="border-t border-border-subtle p-4 pt-3">
                    <p className="body-6">{faq.a}</p>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
