/**
 * OAuth2 access-token lifecycle for mailboxes (PRD 6.2: Google Workspace /
 * Microsoft 365 offline tokens via PKCE). Refresh happens ahead of expiry
 * with a randomized skew so a fleet of mailboxes never stampedes a provider
 * token endpoint at the same second. Tokens live in the mailbox vault
 * envelope (ADR-001); this loop only sees plaintext inside the worker.
 */
export interface OAuth2Tokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds when the access token stops being accepted. */
  expiresAt: number;
}

export interface OAuth2TokenEndpoint {
  /** Exchanges a refresh token. May rotate the refresh token. */
  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresInSec: number }>;
}

export interface MailboxTokenVault {
  load(mailboxId: string): Promise<OAuth2Tokens | null>;
  save(mailboxId: string, tokens: OAuth2Tokens): Promise<void>;
}

const BASE_SKEW_SEC = 300; // refresh up to 5 min before expiry
const JITTER_SEC = 90; // plus a random 0-90s so fleets decorrelate

export class OAuth2TokenLoop {
  constructor(
    private readonly endpoint: OAuth2TokenEndpoint,
    private readonly vault: MailboxTokenVault,
    private readonly clock: () => number = () => Math.floor(Date.now() / 1000),
    private readonly rng: () => number = Math.random,
  ) {}

  /**
   * Returns a usable access token, refreshing first when the stored token is
   * inside the jittered expiry window. Refresh-token rotation is preserved.
   */
  async getAccessToken(mailboxId: string): Promise<string> {
    const tokens = await this.vault.load(mailboxId);
    if (!tokens) throw new Error('Mailbox has no stored OAuth2 tokens');
    const skew = BASE_SKEW_SEC + Math.floor(this.rng() * JITTER_SEC);
    if (tokens.expiresAt - skew > this.clock()) return tokens.accessToken;

    let refreshed;
    try {
      refreshed = await this.endpoint.refresh(tokens.refreshToken);
    } catch (err) {
      throw new Error(`OAuth2 refresh failed for mailbox ${mailboxId}: ${(err as Error).message}`);
    }
    if (!refreshed.accessToken || refreshed.expiresInSec <= 0) {
      throw new Error('OAuth2 provider returned an invalid token payload');
    }
    const next: OAuth2Tokens = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
      expiresAt: this.clock() + refreshed.expiresInSec,
    };
    await this.vault.save(mailboxId, next);
    return next.accessToken;
  }
}
