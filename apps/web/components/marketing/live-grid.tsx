import React from 'react';
import { Database, FlaskConical, Key, ListChecks, Lock, Send, Table } from 'lucide-react';
import { Reveal } from './reveal';
import { StatusChip } from './status-chip';

/**
 * The honesty centerpiece: what is live in production today vs what is still
 * being built. Statuses follow the deployed product (94fa7ab), confirmed
 * against the integrator's live-vs-local list on 2026-11-12. Update these
 * lists as features ship.
 */
const LIVE_ITEMS = [
  {
    icon: Table,
    title: 'Saved tables',
    body: 'Keep leads and notes in saved workspace tables. Your data is there when you come back.',
  },
  {
    icon: Lock,
    title: 'Provider key vault',
    body: 'Store keys for 10 data and AI providers, sealed with AES-256-GCM. Keys are never shown again after saving.',
  },
  {
    icon: Database,
    title: 'Campaign workspace',
    body: 'Sign in with email and a one time code, and manage campaigns from one dashboard.',
  },
];

const SOON_ITEMS = [
  {
    icon: FlaskConical,
    title: 'Idea validator',
    body: 'Turn a raw product idea into a smoke test page with a waitlist, before you write real code.',
  },
  {
    icon: Key,
    title: 'Waterfall enrichment',
    body: 'Run the provider cascade with your own keys and pay each provider directly.',
  },
  {
    icon: ListChecks,
    title: 'Approval queue',
    body: 'Review the exact resolved message for every recipient. Nothing approves in bulk.',
  },
  {
    icon: Send,
    title: 'Sequences and sending',
    body: 'Sending ships only behind the approval step. Until then LeadLoom sends nothing.',
  },
];

export function LiveGrid() {
  return (
    <section id="live" className="border-t border-border-subtle px-4 py-24 sm:px-6 scroll-mt-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-16 max-w-[680px] text-center">
          <h2 className="heading-2">What you get the day you sign up</h2>
          <p className="body-2 mt-4">
            Every feature on this page carries its real status. Live means live in
            production today. Coming soon means still being built.
          </p>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {LIVE_ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 80}>
              <article className="h-full rounded-xl border border-border-subtle bg-canvas-surface p-6 transition-all duration-500 motion-base hover:-translate-y-1 hover:border-brand-loom/40 hover:shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-loom/30 bg-canvas-elevated text-brand-loom">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <StatusChip status="live" />
                </div>
                <h3 className="title-2">{item.title}</h3>
                <p className="body-6 mt-2">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {SOON_ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 80}>
              <article className="h-full rounded-xl border border-dashed border-border-muted bg-canvas-surface p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-canvas-elevated text-text-muted">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <StatusChip status="soon" />
                </div>
                <h3 className="title-2">{item.title}</h3>
                <p className="body-6 mt-2">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
