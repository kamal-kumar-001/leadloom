'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrandMark } from '@leadloom/ui';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { StatusChip } from './status-chip';

/**
 * Marketing navigation (design-system rule B7 navigation + LANDING.md mega
 * menu map): a compact floating bar, translucent over a background blur.
 * Every nav item except Pricing opens a mega panel. Menu entries link only
 * to pages or sections that exist; anything not built is labeled
 * "Coming soon" with no link and no fake affordance. Statuses reflect the
 * deployed product, not the source tree.
 */

type MenuItem = {
  label: string;
  note: string;
  status: 'live' | 'soon';
  href?: string;
};

type Menu = {
  label: string;
  items: MenuItem[];
  footerNote?: string;
};

const MENUS: Menu[] = [
  {
    label: 'Product',
    items: [
      { label: 'Saved tables', note: 'Keep leads and notes across sessions', status: 'live', href: '#live' },
      { label: 'Idea validator', note: 'Smoke test pages for raw product ideas', status: 'soon' },
      { label: 'Provider key vault', note: 'Encrypted storage for 10 providers', status: 'live', href: '#live' },
      { label: 'Waterfall enrichment', note: 'Cascade across providers with your keys', status: 'soon' },
      { label: 'Approval queue', note: 'Review the exact message per recipient', status: 'soon' },
      { label: 'Sequences and sending', note: 'Nothing sends before your approval', status: 'soon' },
      { label: 'Mailboxes and replies', note: 'Connect a mailbox, track replies to source', status: 'soon' },
      { label: 'Team invitations', note: 'Invite teammates with roles', status: 'soon' },
    ],
  },
  {
    label: 'Use cases',
    items: [
      { label: 'Founder idea validation', note: 'Test buyer pull before you build', status: 'soon' },
      { label: 'Outbound for startups', note: 'Signal first prospecting for lean teams', status: 'soon' },
      { label: 'Agencies and sales teams', note: 'Multi client research and review', status: 'soon' },
    ],
    footerNote: 'Each use case gets its own honest page once the workflow behind it works.',
  },
  {
    label: 'Integrations',
    items: [
      { label: 'Apollo', note: 'People and company data', status: 'live', href: '#faq' },
      { label: 'Hunter', note: 'Email finding and verification', status: 'live', href: '#faq' },
      { label: 'AnyMail Finder', note: 'Email finding', status: 'live', href: '#faq' },
      { label: 'Dropcontact', note: 'Email enrichment', status: 'live', href: '#faq' },
      { label: 'Prospeo', note: 'Email finding and verification', status: 'live', href: '#faq' },
      { label: 'OpenAI', note: 'AI analysis with your key', status: 'live', href: '#faq' },
      { label: 'Anthropic', note: 'AI analysis with your key', status: 'live', href: '#faq' },
      { label: 'DeepSeek', note: 'AI analysis with your key', status: 'live', href: '#faq' },
      { label: 'Groq', note: 'AI analysis with your key', status: 'live', href: '#faq' },
      { label: 'Perplexity', note: 'AI analysis with your key', status: 'live', href: '#faq' },
    ],
    footerNote: 'Live means you can store keys today. Live enrichment runs are coming soon.',
  },
];

export function SiteNav() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close panels on outside click or Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Lock body scroll while the mobile panel is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const renderItem = (item: MenuItem) => {
    const inner = (
      <>
        <span className="flex items-center justify-between gap-3">
          <span className="title-4">{item.label}</span>
          <StatusChip status={item.status} />
        </span>
        <span className="caption-2 mt-1 block text-text-muted">{item.note}</span>
      </>
    );
    const cls =
      'block rounded-lg border border-transparent p-3 transition-colors duration-300 motion-base';
    if (item.href) {
      return (
        <a
          key={item.label}
          href={item.href}
          onClick={() => {
            setOpenMenu(null);
            setMobileOpen(false);
          }}
          className={`${cls} hover:border-border-subtle hover:bg-canvas-surface`}
        >
          {inner}
        </a>
      );
    }
    return (
      <div key={item.label} className={`${cls} cursor-default`} aria-disabled="true">
        {inner}
      </div>
    );
  };

  return (
    <div ref={navRef} className="fixed inset-x-0 top-4 z-50 px-4">
      <div className="relative mx-auto w-fit max-w-full">
        <header className="flex h-14 items-center gap-1 rounded-full border border-border-subtle bg-canvas-overlay pl-4 pr-2 shadow-md backdrop-blur-xl">
          <Link href="/" className="mr-2 flex items-center gap-2" aria-label="LeadLoom home">
            <BrandMark className="h-5 w-5" />
            <span className="title-3">LeadLoom</span>
          </Link>

          {/* Desktop menu buttons */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {MENUS.map((menu) => (
              <button
                key={menu.label}
                type="button"
                aria-expanded={openMenu === menu.label}
                onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                className={`button-sm flex items-center gap-1 rounded-full px-3 py-2 transition-colors duration-300 motion-base ${
                  openMenu === menu.label
                    ? 'bg-canvas-elevated text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {menu.label}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-500 motion-base ${
                    openMenu === menu.label ? 'rotate-180' : ''
                  }`}
                />
              </button>
            ))}
            <a
              href="#pricing"
              className="button-sm rounded-full px-3 py-2 text-text-secondary transition-colors duration-300 motion-base hover:text-text-primary"
            >
              Pricing
            </a>
          </nav>

          <div className="ml-2 hidden items-center gap-2 md:flex">
            <Link
              href="/login"
              className="button-sm rounded-full px-3 py-2 text-text-secondary transition-colors duration-300 motion-base hover:text-text-primary"
            >
              Sign in
            </Link>
            <a
              href="#get-started"
              className="button-sm flex items-center gap-1.5 rounded-full bg-brand-loom px-4 py-2 text-text-onAccent transition-all duration-300 motion-base hover:bg-brand-loomHover active:scale-[0.98]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Mobile toggle: two lines transform between states (no icon swap) */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="ml-1 flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full md:hidden"
          >
            <span
              className="menu-line"
              style={mobileOpen ? { transform: 'translateY(3.5px) rotate(45deg)' } : undefined}
            />
            <span
              className="menu-line"
              style={mobileOpen ? { transform: 'translateY(-3.5px) rotate(-45deg)' } : undefined}
            />
          </button>
        </header>

        {/* Desktop mega panels */}
        {MENUS.map(
          (menu) =>
            openMenu === menu.label && (
              <div
                key={menu.label}
                className="absolute left-1/2 top-full mt-3 w-[min(92vw,640px)] -translate-x-1/2 mcard border border-border-subtle bg-canvas-surface p-3 shadow-lg"
                role="menu"
                aria-label={menu.label}
              >
                <div className="grid gap-1 sm:grid-cols-2">{menu.items.map(renderItem)}</div>
                {menu.footerNote && (
                  <p className="caption-2 mt-2 border-t border-border-subtle px-3 pt-3 text-text-muted">
                    {menu.footerNote}
                  </p>
                )}
              </div>
            )
        )}
      </div>

      {/* Mobile full height panel */}
      {mobileOpen && (
        <div className="fixed inset-0 top-0 -z-10 h-screen overflow-y-auto bg-canvas-overlay backdrop-blur-2xl md:hidden">
          <div className="px-6 pb-16 pt-24">
            <nav aria-label="Mobile" className="flex flex-col gap-6">
              {[
                { label: 'Product', href: '#live' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'FAQ', href: '#faq' },
                { label: 'Sign in', href: '/login' },
              ].map((link, i) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="menu-link heading-4"
                  style={{ animationDelay: `${Math.min(i * 60, 400)}ms` }}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#get-started"
                onClick={() => setMobileOpen(false)}
                className="menu-link button-md mt-4 flex w-fit items-center gap-2 rounded-full bg-brand-loom px-6 py-3 text-text-onAccent active:scale-[0.98]"
                style={{ animationDelay: '240ms' }}
              >
                Get started
                <ArrowRight className="h-5 w-5" />
              </a>
              <p className="menu-link caption-2 mt-6 text-text-muted" style={{ animationDelay: '300ms' }}>
                Integrations, use cases and feature statuses are listed further down this page.
              </p>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
