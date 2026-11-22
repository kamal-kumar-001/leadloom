import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password — LeadLoom',
  description: 'Reset your LeadLoom account password.',
  alternates: {
    canonical: '/forgot-password',
  },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
