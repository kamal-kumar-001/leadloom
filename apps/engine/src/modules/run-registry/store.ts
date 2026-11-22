import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { emptyRegistry, parseRegistry, redactSensitive, RunKind, RunRecord, RunRegistryData, RunStatus, makeRunId } from './registry';

/**
 * Filesystem-safe per-owner registry path. The readable slug is for humans;
 * a sha256 of the raw owner key makes collisions impossible (two different
 * keys that normalize to the same slug still get different files) and keeps
 * the full owner identity out of the filename. Never path segments.
 */
export function registryPathFor(baseDir: string, ownerKey: string): string {
  const slug = ownerKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'owner';
  const hash = createHash('sha256').update(ownerKey).digest('hex').slice(0, 12);
  return join(baseDir, `run-registry-${slug}-${hash}.json`);
}

export class RunRegistryStore {
  private seq = 0;
  /** Serializes load-modify-write so concurrent record() calls never lose data. */
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<RunRegistryData> {
    try {
      return parseRegistry(await readFile(this.filePath, 'utf8'));
    } catch (e: any) {
      if (e?.code === 'ENOENT') return emptyRegistry();
      throw e; // a corrupt registry is surfaced, never silently reset
    }
  }

  record(input: {
    kind: RunKind;
    status: RunStatus;
    startedAt: string;
    finishedAt: string;
    label: string;
    artifacts?: string[];
    tokensUsed?: number | null;
    provenance?: RunRecord['provenance'];
    error?: string;
  }): Promise<RunRecord> {
    const op = this.writeQueue.then(() => this.recordExclusive(input));
    this.writeQueue = op.catch(() => {}); // keep the queue alive after a failed write
    return op;
  }

  private async recordExclusive(input: Parameters<RunRegistryStore['record']>[0]): Promise<RunRecord> {
    const data = await this.load();
    const record: RunRecord = {
      id: makeRunId(input.kind, input.startedAt, ++this.seq),
      kind: input.kind,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      label: redactSensitive(input.label),
      artifacts: input.artifacts ?? [],
      tokensUsed: input.tokensUsed ?? null,
      ...(input.provenance ? { provenance: input.provenance } : {}),
      ...(input.error ? { error: redactSensitive(input.error) } : {}),
    };
    data.runs.push(record);
    await this.persist(data);
    return record;
  }

  /** Atomic write: temp file + rename, so a crash never leaves half a registry. */
  private async persist(data: RunRegistryData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = join(dirname(this.filePath), `.run-registry-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`);
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, this.filePath);
  }
}
