'use client';

/** Only same-site paths are accepted as a post-login destination (no open redirect). */
export function safeCallback(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw) return fallback;
  try {
    if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) return raw;
    const u = new URL(raw, window.location.origin);
    if (u.origin === window.location.origin) return `${u.pathname}${u.search}`;
  } catch {
    /* fall through */
  }
  return fallback;
}
