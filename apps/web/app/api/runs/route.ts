import { NextResponse } from 'next/server';
import { currentWebAccess } from '../../../lib/current-web-access';
import { buildRunsView } from '../../../lib/runs-view-model';

/** Read-only: the caller's own local run registry. No mutations here. */
export async function GET(req: Request) {
  const access = await currentWebAccess(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(buildRunsView(access.email), { headers: { 'Cache-Control': 'no-store' } });
}
