import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CodexCliConnector } from '../connectors/codex-cli';
import { AntigravityCliConnector } from '../connectors/antigravity-cli';
import { TokenBudget } from '../budget';
import { READ_ONLY_AUTHORITY, AgentTask, ExecFn } from '../types';
import { AuthorityDeniedError, BudgetExhaustedError } from '../errors';
import { checkAuthority } from '../enforcement';
import { guardedExec, RunTimeoutError, OutputLimitError, DEFAULT_RUN_POLICY } from '../policy';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const baseTask: AgentTask = {
  prompt: 'Summarize the market for X',
  workdir: '/tmp/leadloom-work',
  authority: { ...READ_ONLY_AUTHORITY },
};

const okExec: ExecFn = async () => ({ stdout: '', stderr: '', exitCode: 0, durationSeconds: 1 });

describe('enforcement: authority must be enforceable, not metadata', () => {
  it('agy refuses every dispatch while assurance is only documented, BEFORE exec', async () => {
    let execCalled = false;
    const spy: ExecFn = async (...a) => { execCalled = true; return okExec(...a); };
    const c = new AntigravityCliConnector(spy); // default assurance: 'documented'
    await expect(c.run(baseTask)).rejects.toThrow(/not scoped-verified/);
    expect(execCalled).toBe(false);
  });

  it('agy refuses network grants: network confinement is unverified on this host', () => {
    const c = new AntigravityCliConnector(okExec, 'scoped-verified');
    expect(() => c.buildArgv({ ...baseTask, authority: { ...baseTask.authority, networkAllowed: true } }))
      .toThrow(/UNVERIFIED/);
  });

  it('agy argv carries the no-tools posture: every action wildcard-denied, allow empty', () => {
    const c = new AntigravityCliConnector(okExec, 'scoped-verified');
    const argv = c.buildArgv(baseTask);
    expect(argv).toContain('--sandbox');
    expect(argv).toContain('--output-format');
    const si = argv.indexOf('--settings');
    expect(si).toBeGreaterThan(-1);
    const settings = JSON.parse(argv[si + 1]);
    expect(settings.permissions.ask).toEqual([]); // nothing left to an unanswerable prompt
    expect(settings.permissions.allow).toEqual([]); // no-tools: model can only reply
    expect(settings.permissions.deny).toEqual([
      'read_file(*)', 'write_file(*)', 'command(*)',
      'read_url(*)', 'execute_url(*)', 'download_url(*)', 'mcp(*)',
    ]);
  });

  it('agy holds writeAllowed=true: probe-verified scoped write is not coding capability', () => {
    const c = new AntigravityCliConnector(okExec, 'scoped-verified');
    expect(() => c.buildArgv({ ...baseTask, authority: { ...baseTask.authority, writeAllowed: true } }))
      .toThrow(/held/);
  });

  it('agy refuses allowedTools: no tool grants verified beyond a no-tools reply', () => {
    const c = new AntigravityCliConnector(okExec, 'scoped-verified');
    expect(() => c.buildArgv({ ...baseTask, authority: { ...baseTask.authority, allowedTools: ['Bash'] } }))
      .toThrow(/allowedTools stay refused/);
  });

  it('codex refuses network authority (no documented sandbox level grants it)', () => {
    const c = new CodexCliConnector(okExec);
    expect(() => c.buildArgv({ ...baseTask, authority: { ...baseTask.authority, networkAllowed: true } }))
      .toThrow(/cannot enforce network/);
  });

  it('codex refuses tool allowlists (no documented allowlist flag)', () => {
    const c = new CodexCliConnector(okExec);
    expect(() => c.buildArgv({ ...baseTask, authority: { ...baseTask.authority, allowedTools: ['Bash'] } }))
      .toThrow(/no tool-allowlist mechanism/);
  });

  it('codex run() refuses unsupported authority BEFORE spawning a process', async () => {
    let execCalled = false;
    const spy: ExecFn = async (...a) => { execCalled = true; return okExec(...a); };
    const c = new CodexCliConnector(spy);
    await expect(c.run({ ...baseTask, authority: { ...baseTask.authority, networkAllowed: true } }))
      .rejects.toThrow(AuthorityDeniedError);
    expect(execCalled).toBe(false);
  });

  it('checkAuthority accepts exactly what codex can enforce: fs sandbox, no network, no allowlist', () => {
    const codex = { filesystem: 'sandbox-flag', network: 'none', toolAllowlist: 'none' } as const;
    expect(checkAuthority(baseTask.authority, codex).supported).toBe(true);
    expect(checkAuthority({ ...baseTask.authority, writeAllowed: true }, codex).supported).toBe(true);
  });
});

describe('run policy: hard bounds on the run itself', () => {
  it('guardedExec rejects when the run exceeds its timeout', async () => {
    const slow: ExecFn = () => new Promise((res) => setTimeout(() => res({ stdout: '', stderr: '', exitCode: 0, durationSeconds: 99 }), 500));
    const guarded = guardedExec(slow, { ...DEFAULT_RUN_POLICY, timeoutSeconds: 0.05 });
    await expect(guarded('codex', [], { cwd: '/tmp' })).rejects.toThrow(RunTimeoutError);
  });

  it('guardedExec refuses oversized stdout rather than parsing truncated output', async () => {
    const loud: ExecFn = async () => ({ stdout: 'x'.repeat(2048), stderr: '', exitCode: 0, durationSeconds: 1 });
    const guarded = guardedExec(loud, { ...DEFAULT_RUN_POLICY, maxStdoutBytes: 1024 });
    await expect(guarded('codex', [], { cwd: '/tmp' })).rejects.toThrow(OutputLimitError);
  });

  it('serializes concurrent runs through the connector gate', async () => {
    let inFlight = 0;
    let maxSeen = 0;
    const slow: ExecFn = async () => {
      inFlight++; maxSeen = Math.max(maxSeen, inFlight);
      await new Promise((r) => setTimeout(r, 30));
      inFlight--;
      return { stdout: fx('codex-exec-success.jsonl'), stderr: '', exitCode: 0, durationSeconds: 0.03 };
    };
    const c = new CodexCliConnector(slow); // default policy: maxConcurrent 1
    const [r1, r2] = await Promise.all([c.run(baseTask), c.run(baseTask)]);
    expect(r1.status).toBe('SUCCESS');
    expect(r2.status).toBe('SUCCESS');
    expect(maxSeen).toBe(1);
  });
});

describe('CodexCliConnector', () => {
  it('builds an argv array with read-only sandbox by default (no shell string)', () => {
    const c = new CodexCliConnector(okExec);
    const argv = c.buildArgv(baseTask);
    expect(argv).toContain('exec');
    expect(argv).toContain('--json');
    expect(argv[argv.indexOf('--sandbox') + 1]).toBe('read-only');
    expect(argv[argv.length - 1]).toBe(baseTask.prompt);
  });

  it('selects workspace-write only when authority grants writes', () => {
    const c = new CodexCliConnector(okExec);
    const argv = c.buildArgv({ ...baseTask, authority: { ...baseTask.authority, writeAllowed: true } });
    expect(argv[argv.indexOf('--sandbox') + 1]).toBe('workspace-write');
  });

  it('parses thread_id, last agent message and usage from doc-shaped JSONL', async () => {
    const exec: ExecFn = async () => ({ stdout: fx('codex-exec-success.jsonl'), stderr: '', exitCode: 0, durationSeconds: 3.2 });
    const res = await new CodexCliConnector(exec).run(baseTask);
    expect(res.status).toBe('SUCCESS');
    expect(res.resumeId).toBe('019b7e2a-demo-thread');
    expect(JSON.parse(res.response).summary).toBe('Demo research summary');
    expect(res.usage).toEqual({ inputTokens: 24763, outputTokens: 122, cachedInputTokens: 24448, totalTokens: 24885 });
    expect(res.durationSeconds).toBe(3.2);
  });

  it('reports FAILED with stderr on non-zero exit', async () => {
    const exec: ExecFn = async () => ({ stdout: '', stderr: 'model stream disconnected', exitCode: 1, durationSeconds: 0.4 });
    const res = await new CodexCliConnector(exec).run(baseTask);
    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('model stream disconnected');
  });

  it('flags missing agent_message as FAILED rather than pretending success', async () => {
    const exec: ExecFn = async () => ({ stdout: '{"type":"turn.started"}\n', stderr: '', exitCode: 0, durationSeconds: 0.1 });
    const res = await new CodexCliConnector(exec).run(baseTask);
    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('no agent_message');
  });
});

describe('AntigravityCliConnector host-verified dispatch + envelope parsing', () => {
  it('dispatches a no-tools task under scoped-verified assurance and parses the envelope', async () => {
    let seen: { file: string; args: string[] } | null = null;
    const exec: ExecFn = async (file, args) => {
      seen = { file, args };
      return { stdout: fx('agy-success.json'), stderr: '', exitCode: 0, durationSeconds: 1 };
    };
    const res = await new AntigravityCliConnector(exec, 'scoped-verified').run(baseTask);
    expect(seen!.file).toBe('agy');
    expect(seen!.args).toContain('--sandbox');
    expect(res.status).toBe('SUCCESS');
    expect(res.resumeId).toBe('conv-demo-123');
  });

  it('parses the documented JSON envelope incl. cache_read_tokens and resume id', () => {
    const c = new AntigravityCliConnector(okExec);
    const res = c.parseEnvelope(fx('agy-success.json'), 99);
    expect(res.status).toBe('SUCCESS');
    expect(res.resumeId).toBe('conv-demo-123');
    expect(res.usage.totalTokens).toBe(11072);
    expect(res.usage.cachedInputTokens).toBe(8113);
    expect(res.durationSeconds).toBe(7.16); // envelope value wins over wall clock
  });
});

describe('TokenBudget', () => {
  let budget: TokenBudget;
  beforeEach(() => { budget = new TokenBudget(); });

  it('accumulates spend per owner', () => {
    budget.record('kamal', { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0, totalTokens: 150 });
    budget.record('kamal', { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0, totalTokens: 15 });
    expect(budget.spentBy('kamal')).toBe(165);
    expect(budget.spentBy('other')).toBe(0);
  });

  it('refuses a run once the ceiling is reached', () => {
    budget.record('kamal', { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 50_000 });
    expect(() => budget.assertWithin('kamal', 50_000)).toThrow(BudgetExhaustedError);
    expect(() => budget.assertWithin('kamal', 50_001)).not.toThrow();
  });
});
