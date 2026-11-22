import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IssueAgentTokenRequest, AgentTokenResponse, AgentTokenListItem } from '@leadloom/contracts';
import type { Role } from './rbac';

export interface AgentTokenRecord {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  projectId?: string | null;
  tokenHash: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface AgentTokenWithUserContext extends AgentTokenRecord {
  userRole: Role;
  userDisabledAt: Date | null;
  workspaceActive: boolean;
}

export interface AgentTokenStore {
  create(data: {
    workspaceId: string;
    userId: string;
    name: string;
    projectId?: string | null;
    tokenHash: string;
    tokenPrefix: string;
    scopes: string[];
    expiresAt: Date | null;
  }): Promise<AgentTokenRecord>;
  list(workspaceId: string): Promise<AgentTokenRecord[]>;
  revoke(workspaceId: string, id: string, actorUserId?: string): Promise<boolean>;
  findByHash(tokenHash: string): Promise<AgentTokenWithUserContext | null>;
}

export class InMemoryAgentTokenStore implements AgentTokenStore {
  public tokens: AgentTokenRecord[] = [];
  public users: Map<string, { role: Role; disabledAt: Date | null }> = new Map();
  public workspaces: Map<string, { active: boolean }> = new Map();

  async create(data: {
    workspaceId: string;
    userId: string;
    name: string;
    projectId?: string | null;
    tokenHash: string;
    tokenPrefix: string;
    scopes: string[];
    expiresAt: Date | null;
  }): Promise<AgentTokenRecord> {
    const record: AgentTokenRecord = {
      id: randomUUID(),
      workspaceId: data.workspaceId,
      userId: data.userId,
      name: data.name,
      projectId: data.projectId ?? null,
      tokenHash: data.tokenHash,
      tokenPrefix: data.tokenPrefix,
      scopes: data.scopes,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.tokens.push(record);
    return record;
  }

  async list(workspaceId: string): Promise<AgentTokenRecord[]> {
    return this.tokens
      .filter((t) => t.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async revoke(workspaceId: string, id: string): Promise<boolean> {
    const t = this.tokens.find((x) => x.id === id && x.workspaceId === workspaceId && x.revokedAt === null);
    if (!t) return false;
    t.revokedAt = new Date();
    return true;
  }

  async findByHash(tokenHash: string): Promise<AgentTokenWithUserContext | null> {
    const t = this.tokens.find((x) => x.tokenHash === tokenHash);
    if (!t) return null;
    const user = this.users.get(t.userId) ?? { role: 'member' as Role, disabledAt: null };
    const ws = this.workspaces.get(t.workspaceId) ?? { active: true };
    return {
      ...t,
      userRole: user.role,
      userDisabledAt: user.disabledAt,
      workspaceActive: ws.active,
    };
  }
}

export class PrismaAgentTokenStore implements AgentTokenStore {
  constructor(private readonly prisma: any) {}

  async create(data: {
    workspaceId: string;
    userId: string;
    name: string;
    projectId?: string | null;
    tokenHash: string;
    tokenPrefix: string;
    scopes: string[];
    expiresAt: Date | null;
  }): Promise<AgentTokenRecord> {
    const rows = await this.prisma.$queryRawUnsafe(
      `INSERT INTO agent_tokens (workspace_id, user_id, name, project_id, token_hash, token_prefix, scopes, expires_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING id::text AS id, workspace_id::text AS workspace_id, user_id::text AS user_id,
                 project_id, name, token_hash, token_prefix, scopes, expires_at, revoked_at, created_at`,
      data.workspaceId,
      data.userId,
      data.name,
      data.projectId ?? null,
      data.tokenHash,
      data.tokenPrefix,
      JSON.stringify(data.scopes),
      data.expiresAt,
    );
    const r = rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      userId: r.user_id,
      name: r.name,
      projectId: r.project_id ?? null,
      tokenHash: r.token_hash,
      tokenPrefix: r.token_prefix,
      scopes: Array.isArray(r.scopes) ? r.scopes : JSON.parse(r.scopes ?? '["*"]'),
      expiresAt: r.expires_at ? new Date(r.expires_at) : null,
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      createdAt: new Date(r.created_at),
    };
  }

  async list(workspaceId: string): Promise<AgentTokenRecord[]> {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, workspace_id::text AS workspace_id, user_id::text AS user_id,
              project_id, name, token_prefix, scopes, expires_at, revoked_at, created_at
       FROM agent_tokens
       WHERE workspace_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 100`,
      workspaceId,
    );
    return rows.map((r: any) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      userId: r.user_id,
      name: r.name,
      projectId: r.project_id ?? null,
      tokenHash: '', // Omitted
      tokenPrefix: r.token_prefix,
      scopes: Array.isArray(r.scopes) ? r.scopes : JSON.parse(r.scopes ?? '["*"]'),
      expiresAt: r.expires_at ? new Date(r.expires_at) : null,
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      createdAt: new Date(r.created_at),
    }));
  }

  async revoke(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe(
      `UPDATE agent_tokens
       SET revoked_at = now()
       WHERE id = $1::uuid AND workspace_id = $2::uuid AND revoked_at IS NULL
       RETURNING id::text AS id`,
      id,
      workspaceId,
    );
    return rows.length > 0;
  }

  async findByHash(tokenHash: string): Promise<AgentTokenWithUserContext | null> {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT t.id::text AS id, t.workspace_id::text AS workspace_id, t.user_id::text AS user_id,
              t.project_id, t.name, t.token_hash, t.token_prefix, t.scopes, t.expires_at, t.revoked_at, t.created_at,
              u.role AS user_role, u.disabled_at AS user_disabled_at, w.is_active AS workspace_active
       FROM agent_tokens t
       JOIN users u ON u.id = t.user_id
       JOIN workspaces w ON w.id = t.workspace_id
       WHERE t.token_hash = $1
       LIMIT 1`,
      tokenHash,
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      userId: r.user_id,
      name: r.name,
      projectId: r.project_id ?? null,
      tokenHash: r.token_hash,
      tokenPrefix: r.token_prefix,
      scopes: Array.isArray(r.scopes) ? r.scopes : JSON.parse(r.scopes ?? '["*"]'),
      expiresAt: r.expires_at ? new Date(r.expires_at) : null,
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      createdAt: new Date(r.created_at),
      userRole: r.user_role as Role,
      userDisabledAt: r.user_disabled_at ? new Date(r.user_disabled_at) : null,
      workspaceActive: Boolean(r.workspace_active),
    };
  }
}

export class AgentTokenService {
  constructor(private readonly store: AgentTokenStore) {}

  async issue(workspaceId: string, userId: string, input: IssueAgentTokenRequest): Promise<AgentTokenResponse> {
    // Generate raw secret token: lld_agt_ prefix + 32 random bytes in hex (64 chars) = 72 chars total
    const rawEntropy = randomBytes(32).toString('hex');
    const rawToken = `lld_agt_${rawEntropy}`;
    const tokenPrefix = `${rawToken.slice(0, 12)}...`;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = typeof input.expiresInDays === 'number' && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;

    const record = await this.store.create({
      workspaceId,
      userId,
      name: input.name,
      projectId: input.projectId ?? null,
      tokenHash,
      tokenPrefix,
      scopes: input.scopes ?? ['*'],
      expiresAt,
    });

    // Return the raw token EXACTLY ONCE here; never saved in DB, never shown again
    return {
      id: record.id,
      name: record.name,
      projectId: record.projectId ?? null,
      token: rawToken,
      tokenPrefix,
      scope: record.scopes.join(' '),
      scopes: record.scopes,
      expiry: record.expiresAt ? record.expiresAt.toISOString() : null,
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      revoked: false,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async list(workspaceId: string): Promise<AgentTokenListItem[]> {
    const list = await this.store.list(workspaceId);
    return list.map((record) => ({
      id: record.id,
      name: record.name,
      projectId: record.projectId ?? null,
      tokenPrefix: record.tokenPrefix,
      scope: record.scopes.join(' '),
      scopes: record.scopes,
      expiry: record.expiresAt ? record.expiresAt.toISOString() : null,
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      revoked: record.revokedAt !== null,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async revoke(workspaceId: string, id: string, actorUserId?: string): Promise<boolean> {
    return this.store.revoke(workspaceId, id, actorUserId);
  }

  async verify(rawToken: string, now = Date.now()): Promise<{
    id: string;
    workspaceId: string;
    userId: string;
    projectId: string | null;
    role: Role;
    scopes: string[];
    expiresAt: Date | null;
  } | null> {
    // Strictly validate format: lld_agt_ prefix followed by 64 hex characters
    if (!/^lld_agt_[a-f0-9]{64}$/.test(rawToken)) {
      return null;
    }

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.store.findByHash(tokenHash);
    if (!record) return null;

    // Check revocation
    if (record.revokedAt !== null) return null;

    // Check expiration if set
    if (record.expiresAt && record.expiresAt.getTime() <= now) return null;

    // Check user suspension or workspace deactivation
    if (!record.workspaceActive || record.userDisabledAt !== null) return null;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      userId: record.userId,
      projectId: record.projectId ?? null,
      role: record.userRole,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
    };
  }
}

/**
 * Validates whether granted token scopes permit an action.
 * Supports wildcard '*', exact match, domain wildcards 'domain:*',
 * and read/write sub-actions.
 */
export function hasScope(scopes: string[] | undefined, requiredScope: string, isWrite = false): boolean {
  if (!scopes || scopes.length === 0) return false;
  if (scopes.includes('*')) return true;

  // Exact match
  if (scopes.includes(requiredScope)) return true;

  // Special handling for context:read and context:write
  if (!isWrite && (requiredScope === 'context:read' || requiredScope === 'project:context:read')) {
    if (
      scopes.includes('context:read') ||
      scopes.includes('project:context:read') ||
      scopes.includes('context:*') ||
      scopes.includes('project:*')
    ) {
      return true;
    }
  }

  if (isWrite && (requiredScope === 'context:write' || requiredScope === 'project:context:write')) {
    if (
      scopes.includes('context:write') ||
      scopes.includes('project:context:write') ||
      scopes.includes('context:*') ||
      scopes.includes('project:*')
    ) {
      return true;
    }
  }

  const [domain] = requiredScope.split(':');
  if (scopes.includes(`${domain}:*`)) return true;

  if (!isWrite) {
    if (scopes.includes(`${domain}:read`) || scopes.includes(`read:${domain}`)) return true;
  } else {
    if (scopes.includes(`${domain}:write`) || scopes.includes(`write:${domain}`)) return true;
  }

  return false;
}
