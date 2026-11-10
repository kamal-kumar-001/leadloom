import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Which sign-in methods are actually configured on this server. The login and signup pages use this
// so a button is shown only for a method that can work. Booleans only; no secrets, no ids.
export async function GET() {
  return NextResponse.json(
    {
      github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
      google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      password: process.env.LEADLOOM_PASSWORD_AUTH_ENABLED === 'true',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
