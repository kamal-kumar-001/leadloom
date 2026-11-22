import { randomUUID } from 'node:crypto';
import type { CreateProjectRequest, ProjectResponse } from '@leadloom/contracts';

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectRegistryStore {
  create(
    workspaceId: string,
    data: {
      slug: string;
      name: string;
      description?: string | null;
      userId?: string;
    },
  ): Promise<ProjectRecord>;
  list(workspaceId: string): Promise<ProjectRecord[]>;
  findByIdOrSlug(workspaceId: string, idOrSlug: string): Promise<ProjectRecord | null>;
  exists(workspaceId: string, idOrSlug: string): Promise<boolean>;
}

export class DuplicateProjectSlugError extends Error {
  public readonly statusCode = 409;
  constructor(message = 'A project with this slug already exists in this workspace') {
    super(message);
    this.name = 'DuplicateProjectSlugError';
  }
}

export class InvalidProjectSlugError extends Error {
  public readonly statusCode = 400;
  constructor(message = 'Project slug cannot be formatted as a UUID') {
    super(message);
    this.name = 'InvalidProjectSlugError';
  }
}

export class InMemoryProjectRegistryStore implements ProjectRegistryStore {
  public projects: Map<string, ProjectRecord> = new Map(); // key: id

  async create(
    workspaceId: string,
    data: {
      slug: string;
      name: string;
      description?: string | null;
      userId?: string;
    },
  ): Promise<ProjectRecord> {
    // Check slug uniqueness within this workspace
    for (const p of this.projects.values()) {
      if (p.workspaceId === workspaceId && p.slug.toLowerCase() === data.slug.toLowerCase()) {
        throw new DuplicateProjectSlugError();
      }
    }

    const now = new Date();
    const id = randomUUID();
    const record: ProjectRecord = {
      id,
      workspaceId,
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      createdByUserId: data.userId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(id, record);
    return record;
  }

  async list(workspaceId: string): Promise<ProjectRecord[]> {
    return Array.from(this.projects.values())
      .filter((p) => p.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByIdOrSlug(workspaceId: string, idOrSlug: string): Promise<ProjectRecord | null> {
    for (const p of this.projects.values()) {
      if (p.workspaceId === workspaceId && (p.id === idOrSlug || p.slug.toLowerCase() === idOrSlug.toLowerCase())) {
        return p;
      }
    }
    return null;
  }

  async exists(workspaceId: string, idOrSlug: string): Promise<boolean> {
    const found = await this.findByIdOrSlug(workspaceId, idOrSlug);
    return Boolean(found);
  }
}

export class PrismaProjectRegistryStore implements ProjectRegistryStore {
  constructor(private readonly prisma: any) {}

  async create(
    workspaceId: string,
    data: {
      slug: string;
      name: string;
      description?: string | null;
      userId?: string;
    },
  ): Promise<ProjectRecord> {
    try {
      const rows = await this.prisma.$queryRawUnsafe(
        `INSERT INTO projects (workspace_id, slug, name, description, created_by_user_id, updated_at)
         VALUES ($1::uuid, $2, $3, $4, $5::uuid, now())
         RETURNING id::text AS id, workspace_id::text AS workspace_id, slug, name,
                   description, created_by_user_id::text AS created_by_user_id, created_at, updated_at`,
        workspaceId,
        data.slug,
        data.name,
        data.description ?? null,
        data.userId ?? null,
      );
      const r = rows[0];
      return {
        id: r.id,
        workspaceId: r.workspace_id,
        slug: r.slug,
        name: r.name,
        description: r.description ?? null,
        createdByUserId: r.created_by_user_id ?? null,
        createdAt: new Date(r.created_at),
        updatedAt: new Date(r.updated_at),
      };
    } catch (err: any) {
      if (
        err?.code === '23505' ||
        /duplicate key|unique constraint|uq_projects_workspace_slug/i.test(err?.message ?? '')
      ) {
        throw new DuplicateProjectSlugError();
      }
      throw err;
    }
  }

  async list(workspaceId: string): Promise<ProjectRecord[]> {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, workspace_id::text AS workspace_id, slug, name,
              description, created_by_user_id::text AS created_by_user_id, created_at, updated_at
       FROM projects
       WHERE workspace_id = $1::uuid
       ORDER BY created_at DESC`,
      workspaceId,
    );
    return rows.map((r: any) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? null,
      createdByUserId: r.created_by_user_id ?? null,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }));
  }

  async findByIdOrSlug(workspaceId: string, idOrSlug: string): Promise<ProjectRecord | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const query = isUuid
      ? `SELECT id::text AS id, workspace_id::text AS workspace_id, slug, name,
                description, created_by_user_id::text AS created_by_user_id, created_at, updated_at
         FROM projects
         WHERE workspace_id = $1::uuid AND id = $2::uuid
         LIMIT 1`
      : `SELECT id::text AS id, workspace_id::text AS workspace_id, slug, name,
                description, created_by_user_id::text AS created_by_user_id, created_at, updated_at
         FROM projects
         WHERE workspace_id = $1::uuid AND slug = $2
         LIMIT 1`;

    const rows = await this.prisma.$queryRawUnsafe(query, workspaceId, idOrSlug);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? null,
      createdByUserId: r.created_by_user_id ?? null,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }

  async exists(workspaceId: string, idOrSlug: string): Promise<boolean> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const query = isUuid
      ? `SELECT 1 FROM projects WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`
      : `SELECT 1 FROM projects WHERE workspace_id = $1::uuid AND slug = $2 LIMIT 1`;
    const rows = await this.prisma.$queryRawUnsafe(query, workspaceId, idOrSlug);
    return rows.length > 0;
  }
}

export class ProjectRegistryService {
  constructor(private readonly store: ProjectRegistryStore) {}

  slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'project'
    );
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateProjectRequest,
  ): Promise<ProjectResponse> {
    const slug = input.slug?.trim() || this.slugify(input.name);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
      throw new InvalidProjectSlugError('Project slug cannot be formatted as a UUID');
    }
    const record = await this.store.create(workspaceId, {
      slug,
      name: input.name.trim(),
      description: input.description ?? null,
      userId,
    });
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      slug: record.slug,
      name: record.name,
      description: record.description,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async list(workspaceId: string): Promise<ProjectResponse[]> {
    const list = await this.store.list(workspaceId);
    return list.map((record) => ({
      id: record.id,
      workspaceId: record.workspaceId,
      slug: record.slug,
      name: record.name,
      description: record.description,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
  }

  async findByIdOrSlug(workspaceId: string, idOrSlug: string): Promise<ProjectResponse | null> {
    const record = await this.store.findByIdOrSlug(workspaceId, idOrSlug);
    if (!record) return null;
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      slug: record.slug,
      name: record.name,
      description: record.description,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async resolveCanonicalId(workspaceId: string, idOrSlug: string): Promise<string | null> {
    const record = await this.store.findByIdOrSlug(workspaceId, idOrSlug);
    return record ? record.id : null;
  }

  async exists(workspaceId: string, idOrSlug: string): Promise<boolean> {
    return this.store.exists(workspaceId, idOrSlug);
  }
}
