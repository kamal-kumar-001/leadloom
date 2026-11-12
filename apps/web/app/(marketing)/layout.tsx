import type { Metadata } from 'next';
import { Manrope, Fraunces } from 'next/font/google';
import './marketing.css';

/**
 * Marketing layout. The landing is light by default (Kamal, 2026-11-10):
 * force the light theme for this segment only, without touching the user's
 * stored dashboard preference. The inline script runs before first paint on
 * direct loads; the page component repeats it on client-side mounts and
 * restores the stored theme on unmount. `data-theme-lock` tells the shared
 * ThemeProvider not to re-apply the stored theme while this segment is shown.
 *
 * The marketing segment uses Manrope (design-system rule: one approved
 * typeface for the landing page). The dashboard keeps its own font.
 */

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

/* Editorial serif for the hero headline (Approval Key direction artwork). */
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LeadLoom — Find the accounts already showing buying signals',
  description:
    'LeadLoom is the early access workspace for founders and small GTM teams: save lead research in tables, store your own provider keys with AES-256-GCM encryption, and pay providers directly. Enrichment, approval review and sending ship next, clearly labeled until they are live.',
  openGraph: {
    title: 'LeadLoom — Find the accounts already showing buying signals',
    description:
      'Early access: saved tables, encrypted storage for your own provider keys, and honest live or coming soon labels on every feature.',
    type: 'website',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var h=document.documentElement;h.setAttribute('data-theme-lock','marketing');h.setAttribute('data-theme','dark');h.classList.add('dark');}catch(e){}})();",
        }}
      />
      <div className={`${manrope.variable} ${fraunces.variable} marketing-root`}>{children}</div>
    </>
  );
}
