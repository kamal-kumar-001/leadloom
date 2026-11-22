import { AgentConnector, AgentRunResult, AgentTask, ExecFn } from '../types';
import { AuthorityDeniedError } from '../errors';
import { checkAuthority, Enforcement } from '../enforcement';
import { ConcurrencyGate, DEFAULT_RUN_POLICY, guardedExec, RunPolicy } from '../policy';

/**
 * Codex CLI connector (`codex exec`, non-interactive).
 * Contract source (fetched 2026-11-19): https://developers.openai.com/codex/noninteractive
 * - final agent message on stdout (without --json), progress on stderr
 * - `--json`: JSONL events on stdout incl. thread.started {thread_id},
 *   item.completed {item:{type:'agent_message',text}} and
 *   turn.completed {usage:{input_tokens,cached_input_tokens,output_tokens}}
 * - `--sandbox read-only|workspace-write|danger-full-access`
 * - resume: `codex exec resume <THREAD_ID> "prompt"` (arg ORDER transcribed
 *   from docs; confirm on first live run)
 * danger-full-access is NEVER selectable from this connector.
 *
 * ENFORCEMENT: the only boundary this connector can actually enforce is the
 * filesystem sandbox flag. Network and tool allowlists have no documented
 * `codex exec` mechanism, so tasks requesting them are REFUSED before exec.
 */
const ENFORCEMENT: Enforcement = {
  filesystem: 'sandbox-flag',
  network: 'none',
  toolAllowlist: 'none',
};

export class CodexCliConnector implements AgentConnector {
  readonly connectorId = 'codex-cli';
  readonly provenance = 'live' as const;
  private readonly exec: ExecFn;
  private readonly gate: ConcurrencyGate;

  constructor(exec: ExecFn, policy: RunPolicy = DEFAULT_RUN_POLICY) {
    this.exec = guardedExec(exec, policy);
    this.gate = new ConcurrencyGate(policy.maxConcurrent);
  }

  buildArgv(task: AgentTask): string[] {
    const check = checkAuthority(task.authority, ENFORCEMENT);
    if (!check.supported) throw new AuthorityDeniedError(check.reason!);
    const args: string[] = [];
    if (task.resumeId) args.push('resume', task.resumeId);
    else args.push('exec');
    args.push('--json');
    args.push('--sandbox', task.authority.writeAllowed ? 'workspace-write' : 'read-only');
    args.push(task.prompt);
    return args;
  }

  async run(task: AgentTask): Promise<AgentRunResult> {
    // Authority check happens in buildArgv, BEFORE any process is spawned.
    const argv = this.buildArgv(task);
    return this.gate.runExclusive(async () => {
      const proc = await this.exec('codex', argv, { cwd: task.workdir });
      if (proc.exitCode !== 0) {
        return {
          connectorId: this.connectorId, status: 'FAILED', response: '',
          resumeId: task.resumeId ?? null,
          usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0 },
          durationSeconds: proc.durationSeconds, error: proc.stderr.trim() || `exit ${proc.exitCode}`,
        };
      }
      return this.parseJsonl(proc.stdout, proc.durationSeconds);
    });
  }

  parseJsonl(stdout: string, durationSeconds: number): AgentRunResult {
    let threadId: string | null = null;
    let response = '';
    let usage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0 };
    for (const line of stdout.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      let ev: any;
      try { ev = JSON.parse(t); } catch { continue; }
      if (ev.type === 'thread.started' && typeof ev.thread_id === 'string') threadId = ev.thread_id;
      if (ev.type === 'item.completed' && ev.item?.type === 'agent_message' && typeof ev.item.text === 'string') {
        response = ev.item.text; // last agent message wins
      }
      if (ev.type === 'turn.completed' && ev.usage) {
        usage = {
          inputTokens: ev.usage.input_tokens ?? 0,
          outputTokens: ev.usage.output_tokens ?? 0,
          cachedInputTokens: ev.usage.cached_input_tokens ?? 0,
          totalTokens: (ev.usage.input_tokens ?? 0) + (ev.usage.output_tokens ?? 0),
        };
      }
    }
    return {
      connectorId: this.connectorId, status: response ? 'SUCCESS' : 'FAILED',
      response, resumeId: threadId, usage, durationSeconds,
      ...(response ? {} : { error: 'no agent_message in JSONL output' }),
    };
  }
}
