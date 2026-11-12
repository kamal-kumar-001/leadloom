import React from 'react';
import { Database, FlaskConical, Key, ListChecks, Lock, Send, Table, CheckCircle } from 'lucide-react';
import { Reveal } from './reveal';
import { StatusChip } from './status-chip';

/**
 * The honesty centerpiece: what is live in production today vs what is still
 * being built. Statuses follow the deployed product (94fa7ab), confirmed
 * against the integrator's live-vs-local list on 2026-11-12. Update these
 * lists as features ship.
 *
 * Premium pass: bento composition. Wide cells carry small composed scenes in
 * the product's own visual language; every scene is labeled as what it is
 * (illustrative preview / preview of unfinished work) and no scene implies a
 * capability beyond its status chip.
 */

const LIVE_SMALL = [
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

function TablesScene() {
  const rows = [
    { name: 'Ada Lovelace', signal: 'New role: VP Eng', added: '2d ago' },
    { name: 'Grace Hopper', signal: 'Pricing change', added: '4d ago' },
    { name: 'Alan Turing', signal: 'Hiring: 3 AEs', added: '1w ago' },
  ];
  return (
    <div aria-hidden="true" className="mt-6 overflow-hidden rounded-lg border border-border-subtle bg-canvas">
      <div className="grid grid-cols-[1.4fr_1.2fr_0.6fr] gap-2 border-b border-border-subtle bg-canvas-elevated px-4 py-2 caption-4 text-text-muted">
        <span>Name</span>
        <span>Signal</span>
        <span className="text-right">Added</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-[1.4fr_1.2fr_0.6fr] gap-2 border-b border-border-subtle px-4 py-2.5 text-sm last:border-0">
          <span className="font-medium text-text-primary">{r.name}</span>
          <span className="text-brand-loom">{r.signal}</span>
          <span className="text-right text-text-muted">{r.added}</span>
        </div>
      ))}
      <p className="bg-canvas-elevated px-4 py-1.5 caption-4 text-text-muted">Illustrative preview</p>
    </div>
  );
}

function ApprovalScene() {
  return (
    <div aria-hidden="true" className="mt-6 overflow-hidden rounded-lg border border-border-subtle bg-canvas">
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-sm font-medium text-text-primary">ada@example.invalid</p>
        <p className="caption-2 mt-0.5 text-text-muted">Subject: Quick question about Acme Corp</p>
      </div>
      <div className="px-4 py-3">
        <p className="caption-2 rounded-md border border-border-subtle bg-canvas-elevated px-3 py-2 text-text-secondary">
          Sender: rotate across 2 assigned mailboxes
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="caption-3 text-text-muted">Awaiting human approval</span>
          <span className="flex gap-2">
            <span className="rounded-md border border-border-subtle px-2.5 py-1 caption-3 text-text-muted">Reject</span>
            <span className="rounded-md bg-brand-loom px-2.5 py-1 caption-3 text-white">Approve</span>
          </span>
        </div>
      </div>
      <p className="bg-canvas-elevated px-4 py-1.5 caption-4 text-text-muted">Preview - still being built</p>
    </div>
  );
}

function WaterfallScene() {
  const steps = ['Apollo', 'Hunter', 'Dropcontact'];
  return (
    <div aria-hidden="true" className="mt-6 rounded-lg border border-border-subtle bg-canvas px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <span className={`rounded-full border px-2.5 py-1 caption-3 ${i === 0 ? 'border-signal-verified/40 bg-signal-verified/10 text-signal-verified' : 'border-border-subtle text-text-muted'}`}>
              {s}
            </span>
            {i < steps.length - 1 && <span className="text-text-muted">-&gt;</span>}
          </React.Fragment>
        ))}
        <CheckCircle className="ml-1 h-3.5 w-3.5 text-signal-verified" />
      </div>
      <p className="mt-2 caption-4 text-text-muted">Simulated: stops at the first provider that verifies</p>
    </div>
  );
}

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

        {/* Live: wide saved-tables cell + two compact cells */}
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <article className="h-full mcard border border-border-subtle bg-canvas-surface p-6 sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-loom/30 bg-canvas-elevated text-brand-loom">
                  <Table className="h-5 w-5" />
                </span>
                <StatusChip status="live" />
              </div>
              <h3 className="title-2">Saved tables</h3>
              <p className="body-6 mt-2">Keep leads and notes in saved workspace tables. Your data is there when you come back.</p>
              <TablesScene />
            </article>
          </Reveal>
          <div className="grid gap-6">
            {LIVE_SMALL.map((item, i) => (
              <Reveal key={item.title} delay={(i + 1) * 80}>
                <article className="h-full mcard border border-border-subtle bg-canvas-surface p-6">
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
        </div>

        {/* Coming soon: two scene cells + two compact cells */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-xl border border-dashed border-border-muted bg-canvas-surface p-6 sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-canvas-elevated text-text-muted">
                  <ListChecks className="h-5 w-5" />
                </span>
                <StatusChip status="soon" />
              </div>
              <h3 className="title-2">Approval queue</h3>
              <p className="body-6 mt-2">Review the exact resolved message for every recipient. Nothing approves in bulk.</p>
              <ApprovalScene />
            </article>
          </Reveal>
          <Reveal delay={80}>
            <article className="h-full rounded-xl border border-dashed border-border-muted bg-canvas-surface p-6 sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-canvas-elevated text-text-muted">
                  <Key className="h-5 w-5" />
                </span>
                <StatusChip status="soon" />
              </div>
              <h3 className="title-2">Waterfall enrichment</h3>
              <p className="body-6 mt-2">Run the provider cascade with your own keys and pay each provider directly.</p>
              <WaterfallScene />
            </article>
          </Reveal>
          {[
            {
              icon: FlaskConical,
              title: 'Idea validator',
              body: 'Turn a raw product idea into a smoke test page with a waitlist, before you write real code.',
            },
            {
              icon: Send,
              title: 'Sequences and sending',
              body: 'Sending ships only behind the approval step. Until then LeadLoom sends nothing.',
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={(i + 2) * 80}>
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
