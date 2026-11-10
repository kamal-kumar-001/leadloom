import { createHash, randomBytes } from 'node:crypto';
import type { MailboxTokenVault } from './oauth2-token-loop';

/**
 * OAuth2 authorization (connect) flow for mailboxes (PRD 6.2: Google
 * Workspace / Microsoft 365 offline access via PKCE). This module owns the
 * consent-URL side and the one-time code exchange; OAuth2TokenLoop owns the
 * ongoing refresh lifecycle once tokens are stored.
 *
 * Provider selection is a user decision that only supplies clientId/secret;
 * no provider accounts are created here and no HTTP happens in unit tests
 * (the token endpoint is an injectable port, like OAuth2TokenEndpoint).
 */

export type OAuth2Provider = 'google' | 'microsoft';

export interface OAuth2ProviderConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  /** Minimal scopes for IMAP read + SMTP send with offline refresh. */
  defaultScopes: string[];
  /** Provider-mandated extra authorize params (offline access prompts). */
  extraAuthParams: Record<string, string>;
}

export const OAUTH2_PROVIDERS: Record<OAuth2Provider, OAuth2ProviderConfig> = {
  google: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    // Full mail scope: XOAUTH2 IMAP + SMTP both authenticate against it.
    defaultScopes: ['https://mail.google.com/'],
    extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false' },
  },
  microsoft: {
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    defaultScopes: [
      'offline_access',
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'https://outlook.office.com/SMTP.Send',
    ],
    extraAuthParams: { response_mode: 'query' },
  },
};

const b64url = (b: Buffer): string => b.toString('base64url');

/** RFC 7636 code_verifier: 32 random bytes -> 43-char base64url (43-128 allowed). */
export function generateCodeVerifier(random: (bytes: number) => Buffer = randomBytes): string {
  return b64url(random(32));
}

/** RFC 7636 S256 challenge: base64url(SHA-256(verifier)). */
export function codeChallengeS256(verifier: string): string {
  if (verifier.length < 43 || verifier.length > 128) throw new Error('PKCE verifier must be 43-128 characters');
  return b64url(createHash('sha256').update(verifier).digest());
}

/** Anti-CSRF state for the authorize round-trip. */
export function generateState(random: (bytes: number) => Buffer = randomBytes): string {
  return b64url(random(32));
}

export interface OAuth2StateData {
  mailboxId: string;
  workspaceId: string;
  codeVerifier: string;
  createdAtSec: number;
}

/**
 * State entries are single-use and TTL-bound. `take` consumes the entry even
 * when the callback later fails, so a replayed state can never succeed.
 * Production wiring backs this with Redis (shared across workers); the
 * in-memory implementation below is for tests and single-process dev only.
 */
export interface OAuth2StateStore {
  put(state: string, data: OAuth2StateData, ttlSec: number): Promise<void>;
  take(state: string): Promise<OAuth2StateData | null>;
}

export class InMemoryOAuth2StateStore implements OAuth2StateStore {
  private readonly entries = new Map<string, { data: OAuth2StateData; expiresAtSec: number }>();
  constructor(private readonly clock: () => number = () => Math.floor(Date.now() / 1000)) {}

  async put(state: string, data: OAuth2StateData, ttlSec: number): Promise<void> {
    if (!state || ttlSec <= 0) throw new Error('State and a positive TTL are required');
    this.entries.set(state, { data, expiresAtSec: this.clock() + ttlSec });
  }

  async take(state: string): Promise<OAuth2StateData | null> {
    const entry = this.entries.get(state);
    if (!entry) return null;
    this.entries.delete(state); // single-use, consumed regardless of outcome
    return entry.expiresAtSec > this.clock() ? entry.data : null;
  }
}

export interface BeginOAuth2Input {
  provider: OAuth2Provider;
  clientId: string;
  redirectUri: string;
  mailboxId: string;
  workspaceId: string;
  store: OAuth2StateStore;
  scopes?: string[];
  loginHint?: string;
  stateTtlSec?: number;
  random?: (bytes: number) => Buffer;
}

export interface BeginOAuth2Result {
  url: string;
  state: string;
  expiresAtSec: number;
}

/**
 * Starts a connect flow: stores a single-use state bound to the mailbox and
 * returns the provider consent URL. The PKCE verifier never leaves the store.
 */
export async function beginOAuth2Connect(input: BeginOAuth2Input): Promise<BeginOAuth2Result> {
  const config = OAUTH2_PROVIDERS[input.provider];
  if (!config) throw new Error(`Unknown OAuth2 provider: ${input.provider}`);
  if (!input.clientId || !input.redirectUri) throw new Error('clientId and redirectUri are required');
  const random = input.random ?? randomBytes;
  const codeVerifier = generateCodeVerifier(random);
  const state = generateState(random);
  const ttl = input.stateTtlSec ?? 600;
  await input.store.put(
    state,
    { mailboxId: input.mailboxId, workspaceId: input.workspaceId, codeVerifier, createdAtSec: Math.floor(Date.now() / 1000) },
    ttl,
  );
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: (input.scopes ?? config.defaultScopes).join(' '),
    state,
    code_challenge: codeChallengeS256(codeVerifier),
    code_challenge_method: 'S256',
    ...config.extraAuthParams,
  });
  if (input.loginHint) params.set('login_hint', input.loginHint);
  return { url: `${config.authorizationEndpoint}?${params.toString()}`, state, expiresAtSec: Math.floor(Date.now() / 1000) + ttl };
}

/** Port for the provider token endpoint. Never constructed with live HTTP in tests. */
export interface OAuth2CodeExchange {
  exchange(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    clientId: string;
    clientSecret?: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresInSec: number }>;
}

export interface TokenEndpointResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Production exchange against the provider token endpoint (form POST, grant_type=authorization_code). */
export function createHttpCodeExchange(
  provider: OAuth2Provider,
  fetchImpl: typeof fetch = fetch,
): OAuth2CodeExchange {
  const config = OAUTH2_PROVIDERS[provider];
  if (!config) throw new Error(`Unknown OAuth2 provider: ${provider}`);
  return {
    async exchange(params) {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        code_verifier: params.codeVerifier,
        redirect_uri: params.redirectUri,
        client_id: params.clientId,
      });
      if (params.clientSecret) body.set('client_secret', params.clientSecret);
      const res = await fetchImpl(config.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: body.toString(),
      });
      const payload = (await res.json().catch(() => ({}))) as TokenEndpointResponse;
      if (!res.ok) {
        throw new Error(`Token exchange failed (${res.status}): ${payload.error ?? 'unknown_error'}`);
      }
      if (!payload.access_token || typeof payload.expires_in !== 'number' || payload.expires_in <= 0) {
        throw new Error('Token endpoint returned an invalid payload');
      }
      return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token ?? '',
        expiresInSec: payload.expires_in,
      };
    },
  };
}

export interface CompleteOAuth2Input {
  provider: OAuth2Provider;
  code: string;
  state: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
  store: OAuth2StateStore;
  exchange: OAuth2CodeExchange;
  vault: MailboxTokenVault;
  clock?: () => number;
}

/**
 * Finishes a connect flow: validates and consumes the state, exchanges the
 * code with the original PKCE verifier, and stores the token pair in the
 * mailbox vault (ADR-001 envelope; plaintext stays inside the worker).
 * A missing refresh token is a hard failure: without offline access the
 * mailbox would silently die at the first access-token expiry.
 */
export async function completeOAuth2Connect(input: CompleteOAuth2Input): Promise<{ mailboxId: string; expiresAt: number }> {
  if (!input.code || !input.state) throw new Error('code and state are required');
  const data = await input.store.take(input.state);
  if (!data) throw new Error('Invalid, expired, or already-used OAuth2 state');
  const tokens = await input.exchange.exchange({
    code: input.code,
    codeVerifier: data.codeVerifier,
    redirectUri: input.redirectUri,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });
  if (!tokens.refreshToken) {
    throw new Error('Provider did not return a refresh token; reconnect with offline access consent');
  }
  const now = (input.clock ?? (() => Math.floor(Date.now() / 1000)))();
  const expiresAt = now + tokens.expiresInSec;
  await input.vault.save(data.mailboxId, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt });
  return { mailboxId: data.mailboxId, expiresAt };
}
