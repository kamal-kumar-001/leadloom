/**
 * Client-IP forwarding toward the engine, fail-closed.
 *
 * The engine trusts X-Forwarded-For only from loopback peers - i.e. from
 * THESE proxy routes. Forwarding the raw client-supplied XFF would let any
 * remote client spoof the engine's per-IP rate-limit keys through us, so a
 * client IP is forwarded only when a sanitizing ingress is configured:
 *
 * - Vercel ONLY when the VERCEL env is present: that env is set BY THE
 *   PLATFORM and cannot be supplied by a request, so its presence verifies
 *   the deployment context. Vercel documents that it overwrites
 *   X-Forwarded-For itself, explicitly "to prevent IP spoofing", and that
 *   x-vercel-forwarded-for and x-real-ip are identical to it
 *   (https://vercel.com/docs/edge-network/headers/request-headers). The
 *   header NAMES alone prove nothing - off Vercel all of them are
 *   client-spoofable and are ignored below.
 * - LEADLOOM_TRUSTED_CLIENT_IP_HEADER: name of a header the deployed ingress
 *   is configured to strip+overwrite. The env setting ALONE proves nothing:
 *   setting it without actually configuring that ingress reopens spoofing.
 *   The operator prerequisite is recorded in docs/plan/MISSING_WORK.md (J1);
 *   this process cannot verify it. 'x-forwarded-for' is refused as that name
 *   because no generic deployment guarantees it was sanitized.
 *
 * Otherwise nothing is forwarded: the engine keys per-IP limits on the
 * loopback peer, so all proxied traffic shares one bucket - stricter, never
 * spoofable, and a recorded limitation until a sanitizing ingress exists.
 */
export function trustedClientIp(headers: Headers): string | undefined {
  if (process.env.VERCEL) {
    // x-forwarded-for first: it is the header Vercel explicitly documents as
    // overwritten ("to prevent IP spoofing"); the two Vercel-named variants
    // are documented as identical to it.
    const xff = headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (xff) return xff;
    const vf = headers.get('x-vercel-forwarded-for')?.split(',')[0].trim();
    if (vf) return vf;
    const real = headers.get('x-real-ip')?.trim();
    if (real) return real;
  }
  const name = process.env.LEADLOOM_TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (name && name !== 'x-forwarded-for') {
    const v = headers.get(name)?.split(',')[0].trim();
    if (v) return v;
  }
  return undefined;
}

/** Shared fail-closed bucket key when no client IP can be established honestly. */
export const UNKNOWN_CLIENT_KEY = 'unknown-proxied-client';
