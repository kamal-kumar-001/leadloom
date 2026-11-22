import { randomUUID } from 'node:crypto';
import type { PersistContextRequest, ProjectContextResponse } from '@leadloom/contracts';

export interface ProjectContextRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  revision:number;
}

export interface ProjectContextStore {
  persist(
    workspaceId: string,
    projectId: string,
    context: Record<string, unknown>,
    metadata: Record<string, unknown>,
    userId?: string,
    expectedRevision?:string|null,
  ): Promise<ProjectContextRecord>;
  restore(workspaceId: string, projectId: string): Promise<ProjectContextRecord | null>;
  delete(workspaceId: string, projectId: string): Promise<boolean>;
  exists(workspaceId: string, projectId: string): Promise<boolean>;
}

function stableJson(value:any):string {return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}

export class ContextRevisionConflict extends Error {public readonly statusCode=409;constructor(){super('Context changed since it was read. Restore current context and reconcile deliberately; this write was not applied');}}

export const MAX_CONTEXT_PAYLOAD_BYTES = 262_144; // 256KB

export class PayloadTooLargeError extends Error {
  public readonly statusCode = 413;
  constructor(message = 'Context payload exceeds 256KB limit') {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

export class InMemoryProjectContextStore implements ProjectContextStore {
  public contexts: Map<string, ProjectContextRecord> = new Map();
  public registeredProjects: Set<string> = new Set(); // Registry of valid projects in workspace
  public registry?: { exists(workspaceId: string, projectId: string): Promise<boolean> };

  constructor(registry?: { exists(workspaceId: string, projectId: string): Promise<boolean> }) {
    this.registry = registry;
  }

  private key(workspaceId: string, projectId: string): string {
    return `${workspaceId}:${projectId}`;
  }

  async persist(
    workspaceId: string,
    projectId: string,
    context: Record<string, unknown>,
    metadata: Record<string, unknown>,
    _userId?:string,
    expectedRevision?:string|null,
  ): Promise<ProjectContextRecord> {
    const k = this.key(workspaceId, projectId);
    const existing = this.contexts.get(k);
    if(expectedRevision!==undefined&&existing){const same=stableJson(existing.context)===stableJson(context)&&stableJson(existing.metadata)===stableJson(metadata);if(same)return existing;if(expectedRevision!==existing.id+':'+existing.revision)throw new ContextRevisionConflict();}else if(expectedRevision!==undefined&&expectedRevision!==null&&!existing)throw new ContextRevisionConflict();
    const now = new Date();
    const record: ProjectContextRecord = {
      id: existing ? existing.id : randomUUID(),
      workspaceId,
      projectId,
      context,
      metadata,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      revision:existing?existing.revision+1:1,
    };
    this.contexts.set(k, record);
    return record;
  }

  async restore(workspaceId: string, projectId: string): Promise<ProjectContextRecord | null> {
    const k = this.key(workspaceId, projectId);
    return this.contexts.get(k) ?? null;
  }

  async delete(workspaceId: string, projectId: string): Promise<boolean> {
    const k = this.key(workspaceId, projectId);
    return this.contexts.delete(k);
  }

  async exists(workspaceId: string, projectId: string): Promise<boolean> {
    if (this.registry) {
      const found = await this.registry.exists(workspaceId, projectId);
      if (found) return true;
    }
    const k = this.key(workspaceId, projectId);
    return this.registeredProjects.has(k);
  }
}

export class PrismaProjectContextStore implements ProjectContextStore {
  constructor(private readonly prisma: any) {}

  async persist(
    workspaceId: string,
    projectId: string,
    context: Record<string, unknown>,
    metadata: Record<string, unknown>,
    userId?: string,
    expectedRevision?:string|null,
  ): Promise<ProjectContextRecord> {
    if(expectedRevision!==undefined&&expectedRevision!==null){
      const rows=await this.prisma.$queryRawUnsafe(`UPDATE project_contexts SET context=$3::jsonb,metadata=$4::jsonb,
       revision=CASE WHEN context=$3::jsonb AND metadata=$4::jsonb THEN revision ELSE revision+1 END,
       updated_at=CASE WHEN context=$3::jsonb AND metadata=$4::jsonb THEN updated_at ELSE now() END
       WHERE workspace_id=$1::uuid AND project_id=$2 AND ((id::text || ':' || revision::text)=$5 OR (context=$3::jsonb AND metadata=$4::jsonb))
       RETURNING id::text AS id,workspace_id::text AS workspace_id,project_id,context,metadata,created_at,updated_at,revision`,workspaceId,projectId,JSON.stringify(context),JSON.stringify(metadata),expectedRevision);
      const r=rows[0];if(!r)throw new ContextRevisionConflict();return{id:r.id,workspaceId:r.workspace_id,projectId:r.project_id,context:r.context,metadata:r.metadata,createdAt:new Date(r.created_at),updatedAt:new Date(r.updated_at),revision:Number(r.revision)};
    }
    const rows = await this.prisma.$queryRawUnsafe(
      `INSERT INTO project_contexts (workspace_id, project_id, context, metadata, created_by_user_id, updated_at)
       VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid, now())
       ON CONFLICT (workspace_id, project_id)
       DO UPDATE SET context = EXCLUDED.context, metadata = EXCLUDED.metadata,
         revision=CASE WHEN $6::boolean AND project_contexts.context=EXCLUDED.context AND project_contexts.metadata=EXCLUDED.metadata THEN project_contexts.revision ELSE project_contexts.revision+1 END,
         updated_at=CASE WHEN $6::boolean AND project_contexts.context=EXCLUDED.context AND project_contexts.metadata=EXCLUDED.metadata THEN project_contexts.updated_at ELSE now() END
       WHERE NOT $6::boolean OR (project_contexts.id::text || ':' || project_contexts.revision::text)=$7::text OR (project_contexts.context=EXCLUDED.context AND project_contexts.metadata=EXCLUDED.metadata)
       RETURNING id::text AS id, workspace_id::text AS workspace_id, project_id,
                 context, metadata, created_at, updated_at,revision`,
      workspaceId,
      projectId,
      JSON.stringify(context),
      JSON.stringify(metadata),
      userId ?? null,
      expectedRevision!==undefined,expectedRevision??null,
    );
    const r = rows[0];if(!r)throw new ContextRevisionConflict();
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      projectId: r.project_id,
      context: typeof r.context === 'string' ? JSON.parse(r.context) : r.context,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      revision:Number(r.revision),
    };
  }

  async restore(workspaceId: string, projectId: string): Promise<ProjectContextRecord | null> {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, workspace_id::text AS workspace_id, project_id,
              context, metadata, created_at, updated_at,revision
       FROM project_contexts
       WHERE workspace_id = $1::uuid AND project_id = $2
       LIMIT 1`,
      workspaceId,
      projectId,
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      projectId: r.project_id,
      context: typeof r.context === 'string' ? JSON.parse(r.context) : r.context,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      revision:Number(r.revision),
    };
  }

  async delete(workspaceId: string, projectId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe(
      `DELETE FROM project_contexts
       WHERE workspace_id = $1::uuid AND project_id = $2
       RETURNING id::text AS id`,
      workspaceId,
      projectId,
    );
    return rows.length > 0;
  }

  async exists(workspaceId: string, projectId: string): Promise<boolean> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
    const query = isUuid
      ? `SELECT 1 FROM projects WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`
      : `SELECT 1 FROM projects WHERE workspace_id = $1::uuid AND slug = $2 LIMIT 1`;
    const rows = await this.prisma.$queryRawUnsafe(query, workspaceId, projectId);
    return rows.length > 0;
  }
}

export class ProjectContextService {
  constructor(private readonly store: ProjectContextStore) {}

  async persist(
    workspaceId: string,
    projectId: string,
    input: PersistContextRequest,
    userId?: string,
  ): Promise<ProjectContextResponse> {
    const rawLen = Buffer.byteLength(JSON.stringify({ context: input.context, metadata: input.metadata ?? {} }));
    if (rawLen > MAX_CONTEXT_PAYLOAD_BYTES) {
      throw new PayloadTooLargeError(`Context payload exceeds 256KB limit (${rawLen} bytes)`);
    }

    const record = await this.store.persist(
      workspaceId,
      projectId,
      input.context,
      input.metadata ?? {},
      userId,
      input.expectedRevision,
    );
    return {
      revision:record.id+':'+record.revision,
      id: record.id,
      workspaceId: record.workspaceId,
      projectId: record.projectId,
      context: record.context,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async restore(workspaceId: string, projectId: string): Promise<ProjectContextResponse | null> {
    const record = await this.store.restore(workspaceId, projectId);
    if (!record) return null;

    const rawLen = Buffer.byteLength(JSON.stringify({ context: record.context, metadata: record.metadata }));
    if (rawLen > MAX_CONTEXT_PAYLOAD_BYTES) {
      throw new PayloadTooLargeError(`Stored context exceeds 256KB limit (${rawLen} bytes) and cannot be restored`);
    }

    return {
      revision:record.id+':'+record.revision,
      id: record.id,
      workspaceId: record.workspaceId,
      projectId: record.projectId,
      context: record.context,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async delete(workspaceId: string, projectId: string): Promise<boolean> {
    return this.store.delete(workspaceId, projectId);
  }

  async exists(workspaceId: string, projectId: string): Promise<boolean> {
    return this.store.exists(workspaceId, projectId);
  }
}
