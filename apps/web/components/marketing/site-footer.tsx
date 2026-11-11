import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@leadloom/ui';

/**
 * Footer (skill B10, LANDING.md): links only to pages that exist. Legal pages
 * do not exist yet, so no dead privacy/terms links; add them when the pages
 * ship.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <span className="flex items-center gap-2">
          <BrandMark className="h-4 w-4" />
          <span className="caption-1 text-text-muted">© 2026 LeadLoom. All rights reserved.</span>
        </span>
        <nav className="flex items-center gap-6" aria-label="Footer">
          <a href="#live" className="caption-1 text-text-muted transition-colors duration-300 motion-base hover:text-text-primary">
            What is live
          </a>
          <a href="#pricing" className="caption-1 text-text-muted transition-colors duration-300 motion-base hover:text-text-primary">
            Pricing
          </a>
          <a href="#faq" className="caption-1 text-text-muted transition-colors duration-300 motion-base hover:text-text-primary">
            FAQ
          </a>
          <Link href="/login" className="caption-1 text-text-muted transition-colors duration-300 motion-base hover:text-text-primary">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
