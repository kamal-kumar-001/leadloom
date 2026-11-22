import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyRegistry, parseRegistry, summarize, makeRunId, redactSensitive } from '../registry';
import { RunRegistryStore, registryPathFor } from '../store';

describe('registry parsing and summary', () => {
  it('round-trips an empty registry and rejects corrupt data', () => {
    expect(parseRegistry(JSON.stringify(emptyRegistry())).runs).toEqual([]);
    expect(() => parseRegistry('not json')).toThrow('not valid JSON');
    expect(() => parseRegistry('{"version":2,"runs":[]}')).toThrow('unsupported');
    expect(() => parseRegistry('{"version":1,"runs":[{"id":1}]}')).toThrow('corrupt');
  });

  it('summarizes counts and tokens', () => {
    const data = emptyRegistry();
    data.runs.push(
      { id: 'a', kind: 'idea-research', status: 'SUCCESS', startedAt: '2026-11-19T18:00:00Z', finishedAt: '2026-11-19T18:00:10Z', label: 'x', artifacts: [], tokensUsed: 1200 },
      { id: 'b', kind: 'agent-run', status: 'REFUSED', startedAt: '2026-11-19T18:01:00Z', finishedAt: '2026-11-19T18:01:01Z', label: 'y', artifacts: [], tokensUsed: null },
    );
    const s = summarize(data);
    expect(s).toEqual({ total: 2, byStatus: { SUCCESS: 1, FAILED: 0, REFUSED: 1 }, tokensKnown: 1200, usageUnknown: 1 });
  });

  it('makes deterministic, filesystem-safe run ids', () => {
    expect(makeRunId('landing-render', '2026-11-19T18:30:00.123Z', 3)).toBe('landing-render-2026-11-19T18-30-00-123Z-3');
  });
});

describe('RunRegistryStore', () => {
  let dir: string;
  let file: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'leadloom-registry-')); file = join(dir, 'run-registry.json'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns an empty registry when no file exists', async () => {
    const store = new RunRegistryStore(file);
    expect((await store.load()).runs).toEqual([]);
  });

  it('appends records and persists them across instances', async () => {
    const store = new RunRegistryStore(file);
    const rec = await store.record({ kind: 'idea-research', status: 'SUCCESS', startedAt: '2026-11-19T18:00:00Z', finishedAt: '2026-11-19T18:00:09Z', label: 'Leadloom research', artifacts: ['/tmp/r.json'], tokensUsed: 1200 });
    expect(rec.id).toContain('idea-research-');
    const fresh = new RunRegistryStore(file);
    const loaded = await fresh.load();
    expect(loaded.runs).toHaveLength(1);
    expect(loaded.runs[0].label).toBe('Leadloom research');
  });

  it('surfaces a corrupt registry instead of silently resetting it', async () => {
    writeFileSync(file, '{"version":1,"runs":"oops"}');
    const store = new RunRegistryStore(file);
    await expect(store.load()).rejects.toThrow('unsupported registry shape');
  });

  it('writes atomically (no tmp file left behind)', async () => {
    const store = new RunRegistryStore(file);
    await store.record({ kind: 'landing-render', status: 'SUCCESS', startedAt: '2026-11-19T18:05:00Z', finishedAt: '2026-11-19T18:05:01Z', label: 'l', artifacts: [] });
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('landing-render');
  });
});

describe('per-owner paths and concurrency', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'leadloom-registry-owner-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('slugs owner keys into safe filenames (no path traversal possible)', () => {
    expect(registryPathFor('/base', 'kamal@example.com')).toMatch(/^\/base\/run-registry-kamal-example-com-[0-9a-f]{12}\.json$/);
    expect(registryPathFor('/base', '../../etc/passwd')).toMatch(/^\/base\/run-registry-etc-passwd-[0-9a-f]{12}\.json$/);
    expect(registryPathFor('/base', '!!!')).toMatch(/^\/base\/run-registry-owner-[0-9a-f]{12}\.json$/);
  });

  it('never collides when different owner keys normalize to the same slug', () => {
    const a = registryPathFor('/base', 'a+b@x.com');
    const b = registryPathFor('/base', 'a b@x.com');
    expect(a).not.toBe(b);
    expect(registryPathFor('/base', 'a+b@x.com')).toBe(a); // stable for the same key
  });

  it('parallel record() calls never lose a run', async () => {
    const file = join(dir, 'run-registry-kamal.json');
    const store = new RunRegistryStore(file);
    const recs = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.record({ kind: 'agent-run', status: 'SUCCESS', startedAt: `2026-11-19T18:10:${String(i).padStart(2, '0')}Z`, finishedAt: '2026-11-19T18:10:59Z', label: `run-${i}` })),
    );
    expect(new Set(recs.map((r) => r.id)).size).toBe(20);
    const fresh = new RunRegistryStore(file);
    expect((await fresh.load()).runs).toHaveLength(20);
  });

  it('redacts common credential shapes from labels and errors before persisting', async () => {
    const file = join(dir, 'run-registry-redact.json');
    const store = new RunRegistryStore(file);
    const rec = await store.record({
      kind: 'idea-research', status: 'FAILED', startedAt: '2026-11-19T18:12:00Z', finishedAt: '2026-11-19T18:12:01Z',
      label: 'idea with key sk-abcdefghijklmnop123456 pasted in',
      error: ' Bearer abcdef0123456789abcdef rejected',
    });
    expect(rec.label).not.toContain('sk-abcdefghijklmnop123456');
    expect(rec.label).toContain('[redacted]');
    expect(rec.error).not.toContain('abcdef0123456789abcdef');
    const onDisk = readFileSync(file, 'utf8');
    expect(onDisk).not.toContain('sk-abcdefghijklmnop123456');
    expect(redactSensitive('plain idea text, no secrets')).toBe('plain idea text, no secrets');
  });

  it('keeps accepting writes after one record fails', async () => {
    const file = join(dir, 'sub/dir/registry.json');
    const store = new RunRegistryStore(file);
    await store.record({ kind: 'landing-render', status: 'SUCCESS', startedAt: '2026-11-19T18:11:00Z', finishedAt: '2026-11-19T18:11:01Z', label: 'a' });
    await store.record({ kind: 'landing-render', status: 'SUCCESS', startedAt: '2026-11-19T18:11:02Z', finishedAt: '2026-11-19T18:11:03Z', label: 'b' });
    expect((await store.load()).runs).toHaveLength(2);
  });
});
