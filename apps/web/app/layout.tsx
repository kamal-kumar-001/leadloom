import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'LeadLoom — The Open-Core Signal-to-Revenue Engine',
  description: 'Weave buying signals into qualified revenue at wholesale BYOK API cost. The developer-first, self-hostable alternative to Clay and PumpGTM.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-canvas text-text-primary antialiased font-sans selection:bg-brand-loom/30 selection:text-white">
        <aside
          role="status"
          aria-label="Demo environment notice"
          className="bg-brand-loom/20 border-b border-brand-loom/30 px-3 py-1.5 text-center text-xs text-text-secondary font-mono flex items-center justify-center gap-2 select-none"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-signal-verified animate-pulse" />
          <span>Interactive Public Demo • Simulated data only • No real keys connected or outbound emails dispatched</span>
        </aside>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: '#181B27',
              borderColor: '#2A3047',
              color: '#F8FAFC',
            },
          }}
        />
      </body>
    </html>
  );
}
