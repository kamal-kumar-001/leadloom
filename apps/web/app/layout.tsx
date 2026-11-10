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
