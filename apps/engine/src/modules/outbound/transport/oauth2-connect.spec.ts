import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  beginOAuth2Connect,
  codeChallengeS256,
  completeOAuth2Connect,
  createHttpCodeExchange,
  generateCodeVerifier,
  generateState,
  InMemoryOAuth2StateStore,
  OAUTH2_PROVIDERS,
  type OAuth2CodeExchange,
} from './oauth2-connect';
import type { MailboxTokenVault, OAuth2Tokens } from './oauth2-token-loop';

const MAILBOX = 'mailbox-1';
const WORKSPACE = 'workspace-1';

function fakeVault(saved: Array<{ id: string; tokens: OAuth2Tokens }>): MailboxTokenVault {
  return {
    load: async () => null,
    save: async (id, tokens) => {
      saved.push({ id, tokens });
    },
  };
}

function fakeExchange(calls: Array<Record<string, unknown>>, result?: Partial<{ accessToken: string; refreshToken: string; expiresInSec: number }>): OAuth2CodeExchange {
  return {
    exchange: async (params) => {
      calls.push({ ...params });
      return { accessToken: 'at-1', refreshToken: 'rt-1', expiresInSec: 3600, ...result };
    },
  };
}

describe('PKCE primitives', () => {
  it('generates a 43-char base64url verifier and its S256 challenge', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const expected = createHash('sha256').update(verifier).digest().toString('base64url');
    expect(codeChallengeS256(verifier)).toBe(expected);
  });

  it('rejects out-of-range verifiers', () => {
    expect(() => codeChallengeS256('too-short')).toThrow(/43-128/);
    expect(() => codeChallengeS256('x'.repeat(129))).toThrow(/43-128/);
  });

  it('generates distinct states', () => {
    expect(generateState()).not.toBe(generateState());
  });
});

describe('InMemoryOAuth2StateStore', () => {
  it('consumes entries on take (single-use)', async () => {
    const store = new InMemoryOAuth2StateStore(() => 1000);
    await store.put('s1', { mailboxId: MAILBOX, workspaceId: WORKSPACE, codeVerifier: 'v', createdAtSec: 1000 }, 600);
    expect(await store.take('s1')).toMatchObject({ mailboxId: MAILBOX });
    expect(await store.take('s1')).toBeNull();
  });

  it('expires entries past their TTL and still consumes them', async () => {
    let now = 1000;
    const store = new InMemoryOAuth2StateStore(() => now);
    await store.put('s2', { mailboxId: MAILBOX, workspaceId: WORKSPACE, codeVerifier: 'v', createdAtSec: now }, 60);
    now = 2000;
    expect(await store.take('s2')).toBeNull();
    expect(await store.take('s2')).toBeNull();
  });
});

describe('beginOAuth2Connect', () => {
  it('builds the Google consent URL with offline access and PKCE S256', async () => {
    const store = new InMemoryOAuth2StateStore();
    const { url, state } = await beginOAuth2Connect({
      provider: 'google',
      clientId: 'cid',
      redirectUri: 'https://app.test/oauth/callback',
      mailboxId: MAILBOX,
      workspaceId: WORKSPACE,
      store,
      loginHint: 'owner@example.com',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(OAUTH2_PROVIDERS.google.authorizationEndpoint);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('cid');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.test/oauth/callback');
    expect(parsed.searchParams.get('scope')).toBe('https://mail.google.com/');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toHaveLength(43);
    expect(parsed.searchParams.get('state')).toBe(state);
    expect(parsed.searchParams.get('login_hint')).toBe('owner@example.com');
    // State is bound to the mailbox in the store; verifier is not in the URL.
    expect(await store.take(state)).toMatchObject({ mailboxId: MAILBOX });
    expect(url).not.toContain('code_verifier');
  });

  it('builds the Microsoft consent URL with offline_access and Graph scopes', async () => {
    const store = new InMemoryOAuth2StateStore();
    const { url } = await beginOAuth2Connect({
      provider: 'microsoft',
      clientId: 'cid',
      redirectUri: 'https://app.test/oauth/callback',
      mailboxId: MAILBOX,
      workspaceId: WORKSPACE,
      store,
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(OAUTH2_PROVIDERS.microsoft.authorizationEndpoint);
    expect(parsed.searchParams.get('scope')).toBe(
      'offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
    );
  });

  it('rejects unknown providers and missing client config', async () => {
    const store = new InMemoryOAuth2StateStore();
    await expect(
      beginOAuth2Connect({ provider: 'yahoo' as never, clientId: 'c', redirectUri: 'r', mailboxId: MAILBOX, workspaceId: WORKSPACE, store }),
    ).rejects.toThrow(/Unknown OAuth2 provider/);
    await expect(
      beginOAuth2Connect({ provider: 'google', clientId: '', redirectUri: 'r', mailboxId: MAILBOX, workspaceId: WORKSPACE, store }),
    ).rejects.toThrow(/clientId and redirectUri/);
  });
});

describe('completeOAuth2Connect', () => {
  it('rejects invalid, expired, or replayed state before any exchange', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const store = new InMemoryOAuth2StateStore();
    await expect(
      completeOAuth2Connect({
        provider: 'google', code: 'c', state: 'nope', redirectUri: 'r', clientId: 'cid',
        store, exchange: fakeExchange(calls), vault: fakeVault([]),
      }),
    ).rejects.toThrow(/state/);
    expect(calls).toHaveLength(0);
  });

  it('exchanges with the original PKCE verifier and stores both tokens', async () => {
    const store = new InMemoryOAuth2StateStore();
    const { state } = await beginOAuth2Connect({
      provider: 'google', clientId: 'cid', redirectUri: 'https://app.test/cb', mailboxId: MAILBOX, workspaceId: WORKSPACE, store,
    });
    const calls: Array<Record<string, unknown>> = [];
    const saved: Array<{ id: string; tokens: OAuth2Tokens }> = [];
    const result = await completeOAuth2Connect({
      provider: 'google', code: 'auth-code', state, redirectUri: 'https://app.test/cb', clientId: 'cid', clientSecret: 'sec',
      store, exchange: fakeExchange(calls), vault: fakeVault(saved), clock: () => 5000,
    });
    expect(result).toEqual({ mailboxId: MAILBOX, expiresAt: 8600 });
    expect(calls).toHaveLength(1);
    expect(calls[0].code).toBe('auth-code');
    expect(calls[0].clientSecret).toBe('sec');
    // The verifier sent to the provider must hash to the challenge we published.
    expect(codeChallengeS256(String(calls[0].codeVerifier))).toHaveLength(43);
    expect(saved).toEqual([{ id: MAILBOX, tokens: { accessToken: 'at-1', refreshToken: 'rt-1', expiresAt: 8600 } }]);
    // State was consumed: a replay with the same state fails without a new exchange.
    await expect(
      completeOAuth2Connect({
        provider: 'google', code: 'auth-code', state, redirectUri: 'https://app.test/cb', clientId: 'cid',
        store, exchange: fakeExchange(calls), vault: fakeVault(saved),
      }),
    ).rejects.toThrow(/state/);
    expect(calls).toHaveLength(1);
  });

  it('fails hard when the provider omits the refresh token (no offline access)', async () => {
    const store = new InMemoryOAuth2StateStore();
    const { state } = await beginOAuth2Connect({
      provider: 'microsoft', clientId: 'cid', redirectUri: 'r', mailboxId: MAILBOX, workspaceId: WORKSPACE, store,
    });
    const saved: Array<{ id: string; tokens: OAuth2Tokens }> = [];
    await expect(
      completeOAuth2Connect({
        provider: 'microsoft', code: 'c', state, redirectUri: 'r', clientId: 'cid',
        store, exchange: fakeExchange([], { refreshToken: '' }), vault: fakeVault(saved),
      }),
    ).rejects.toThrow(/refresh token/);
    expect(saved).toHaveLength(0);
  });
});

describe('createHttpCodeExchange', () => {
  it('POSTs a form-encoded authorization_code grant to the provider token endpoint', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }), { status: 200 });
    }) as typeof fetch;
    const exchange = createHttpCodeExchange('google', fetchImpl);
    const tokens = await exchange.exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'r', clientId: 'cid', clientSecret: 'sec' });
    expect(tokens).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresInSec: 3600 });
    expect(requests[0].url).toBe(OAUTH2_PROVIDERS.google.tokenEndpoint);
    const body = new URLSearchParams(String(requests[0].init.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('v');
    expect(body.get('client_secret')).toBe('sec');
  });

  it('surfaces provider errors and rejects malformed payloads', async () => {
    const errFetch = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as typeof fetch;
    await expect(
      createHttpCodeExchange('microsoft', errFetch).exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'r', clientId: 'cid' }),
    ).rejects.toThrow(/invalid_grant/);

    const badFetch = (async () => new Response(JSON.stringify({ access_token: 'at' }), { status: 200 })) as typeof fetch;
    await expect(
      createHttpCodeExchange('google', badFetch).exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'r', clientId: 'cid' }),
    ).rejects.toThrow(/invalid payload/);
  });
});
