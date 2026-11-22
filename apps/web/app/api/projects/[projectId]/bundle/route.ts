import { getToken } from 'next-auth/jwt';
import { auth } from '../../../../../auth';
import { engineCall, mintBridgeToken } from '../../../../../lib/engine-server';
import { buildSkillsBundle } from '../../../../../lib/skills-bundle';
import { configuredAgentApiUrl } from '../../../../../lib/agent-connection-config';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  if (!projectId || projectId === '.' || projectId === '..' || /[\\/%\0]/.test(projectId)) {
    return Response.json({ error: 'Invalid project identifier' }, { status: 400 });
  }

  // 1. Browser-session-only authentication
  const session = await auth();
  const user = session?.user as (Record<string, unknown> & { email?: string | null }) | undefined;
  if (!user?.email) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Resolve token for engine call
  let token: string | null = null;
  if (user.idp === 'credentials') {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    const secure = (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';
    const jwt = secret ? await getToken({ req, secret, secureCookie: secure }) : null;
    const et = jwt?.engineToken as string | undefined;
    const ee = jwt?.engineExp as number | undefined;
    if (et && ee && ee * 1000 > Date.now()) token = et;
  } else {
    token = mintBridgeToken({
      email: user.email,
      idp: user.idp as string | undefined,
      email_verified: user.email_verified as boolean | undefined,
      authTime: user.authTime as number | undefined,
    });
  }

  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 3. Real engine project ownership check with fail-closed semantics
  let projects: Array<{ id: string; slug: string; name: string }>;
  try {
    const res = await engineCall('/projects', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return Response.json({ error: 'Engine unavailable' }, { status: 503 });
    }
    projects = await res.json();
    if (!Array.isArray(projects)) {
      return Response.json({ error: 'Engine unavailable' }, { status: 503 });
    }
  } catch {
    return Response.json({ error: 'Engine unavailable' }, { status: 503 });
  }

  const matched = projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!matched) {
    return Response.json({ error: 'Project not found in this workspace' }, { status: 404 });
  }

  // 4. Build the customer coding agent skills tarball using trusted configured base
  // Customer-accessible bearer ingress gateway is at /api/agent under trusted base URL
  const apiUrl = configuredAgentApiUrl(process.env);
  if (!apiUrl) return Response.json({ error: 'Public agent gateway is not configured. No bundle was produced.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  try {
    const { filename, archive } = buildSkillsBundle({
      projectId: matched.id,
      projectSlug: matched.slug,
      apiUrl,
    });
    return new Response(new Uint8Array(archive), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': archive.length.toString(),
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return Response.json({ error: 'Project workflow bundle unavailable. No complete bundle was produced.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
