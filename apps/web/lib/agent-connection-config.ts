/** Only explicit server configuration may choose where customer credentials go. */
export function configuredAgentApiUrl(env: Record<string, string | undefined>): string | null {
  const explicit = env.LEADLOOM_PUBLIC_API_URL?.trim();
  const base = env.NEXT_PUBLIC_APP_URL?.trim() || env.AUTH_URL?.trim() || env.NEXTAUTH_URL?.trim();
  const raw = explicit || base;
  if (!raw || !/^https?:\/\//i.test(raw) || raw.includes('?') || raw.includes('#') || /[\s\x00-\x1f\x7f"'`$\\]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    if (!explicit) {
      if (url.pathname !== '/') return null;
      return url.origin + '/api/agent';
    }
    return url.href.replace(/\/+$/, '');
  } catch { return null; }
}

export function credentialScopeRecord(tokens: Array<{projectId?: string | null; revoked: boolean; expiresAt?: string | null; scopes: string[]}>, projectId: string | null, scopes: string[], now = Date.now()): boolean {
  return tokens.some(token => (token.projectId || null) === projectId && !token.revoked && (!token.expiresAt || new Date(token.expiresAt).getTime() > now) && (token.scopes.includes('*') || scopes.every(scope => token.scopes.includes(scope))));
}
