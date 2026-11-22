import { NextResponse } from 'next/server';
import { engineCall } from '../../../../lib/engine-server';
import { resolveEnginePath, MAX_BODY_BYTES } from '../../../../lib/agent-gateway';

// Strict allowlist mapping for public customer coding agent gateway.
// Only allows specific method + path combinations for context, validator, and research.
// Never accept arbitrary paths, never trust incoming host headers, never mint session or bridge tokens.

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!path?.length || path.some((s) => !s || s === '.' || s === '..' || /[\\/%\0]/.test(s))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const targetPath = resolveEnginePath(req.method, path);
  if (!targetPath) {
    return NextResponse.json(
      { error: 'Endpoint or method not available on customer agent gateway' },
      { status: 404 }
    );
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization header with Bearer token required' },
      { status: 401 }
    );
  }

  const url = new URL(req.url);

  // Early Content-Length check before buffering body
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const cl = parseInt(contentLength, 10);
    if (!Number.isNaN(cl) && cl > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload exceeds 256KB limit' }, { status: 413 });
    }
  }

  let bodyBuffer: Buffer | undefined;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const arrayBuf = await req.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload exceeds 256KB limit' }, { status: 413 });
    }
    if (arrayBuf.byteLength > 0) {
      bodyBuffer = Buffer.from(arrayBuf);
    }
  }

  const forwardHeaders: Record<string, string> = {
    Authorization: authHeader,
  };
  const contentType = req.headers.get('content-type');
  if (contentType && bodyBuffer) {
    forwardHeaders['Content-Type'] = contentType;
  }

  try {
    const res = await engineCall(`${targetPath}${url.search}`, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyBuffer ? (new Uint8Array(bodyBuffer) as unknown as BodyInit) : undefined,
    });

    const responseText = await res.text();
    const headers: Record<string, string> = {
      'Content-Type': res.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    };
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) headers['Retry-After'] = retryAfter;
    const contentDisposition = res.headers.get('content-disposition');
    if (contentDisposition) {
      headers['Content-Disposition'] = contentDisposition;
    }

    return new NextResponse(responseText || null, {
      status: res.status,
      headers,
    });
  } catch {
    return NextResponse.json({ error: 'Engine unavailable' }, { status: 503 });
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
