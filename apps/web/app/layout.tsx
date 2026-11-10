import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@leadloom/ui';

export const metadata: Metadata = {
  title: 'LeadLoom — Signal-driven outbound with your own keys',
  description: 'Weave buying signals into qualified revenue at wholesale BYOK API cost.',
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
          <aside
            role="status"
            aria-label="Demo environment notice"
            className="bg-brand-loom/20 border-b border-brand-loom/30 px-3 py-1.5 text-center text-xs text-text-secondary font-mono flex items-center justify-center gap-2 select-none"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-signal-verified animate-pulse" />
            <span>Interactive Demo • Demo data only • No real keys connected or outbound emails dispatched</span>
          </aside>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-muted)',
                color: 'var(--text-primary)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
