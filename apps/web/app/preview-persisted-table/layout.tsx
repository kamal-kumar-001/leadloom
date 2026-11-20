import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

// LOCAL HARNESS PREVIEW ONLY: static fixture data must never be served in production.
export default function PreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <>{children}</>;
}
