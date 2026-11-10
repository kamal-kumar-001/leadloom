'use client';

import { useEffect, useState } from 'react';

export interface AuthMethods {
  loaded: boolean;
  github: boolean;
  google: boolean;
  password: boolean;
}

/** Which sign-in methods the server has configured. Until it answers, nothing is shown as available. */
export function useAuthMethods(): AuthMethods {
  const [m, setM] = useState<AuthMethods>({ loaded: false, github: false, google: false, password: false });
  useEffect(() => {
    let alive = true;
    fetch('/api/auth-methods', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('methods'))))
      .then((j) => {
        if (alive) setM({ loaded: true, github: !!j.github, google: !!j.google, password: !!j.password });
      })
      .catch(() => {
        if (alive) setM({ loaded: true, github: false, google: false, password: false });
      });
    return () => {
      alive = false;
    };
  }, []);
  return m;
}

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
