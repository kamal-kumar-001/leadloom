import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@leadloom/ui';
import { getProductionBaseUrl } from './sitemap';

const siteUrl = getProductionBaseUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: 'LeadLoom — Signal-driven outbound with your own keys',
  description: 'Weave buying signals into qualified revenue at wholesale BYOK API cost.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'LeadLoom — Signal-driven outbound with your own keys',
    description: 'Weave buying signals into qualified revenue at wholesale BYOK API cost.',
    ...(siteUrl ? { url: siteUrl } : {}),
    siteName: 'LeadLoom',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-canvas text-text-primary antialiased font-sans selection:bg-brand-loom/30 selection:text-white">
        <ThemeProvider defaultTheme="dark">
          {children}
          <Toaster
            position="bottom-right"
            closeButton
            richColors={false}
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
