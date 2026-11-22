import { AgentConnector, AgentRunResult, AgentTask, ExecFn, TaskAuthority } from '../types';
import { AuthorityDeniedError } from '../errors';

/**
 * Antigravity CLI connector (`agy -p`, headless).
 * Contract sources (fetched 2026-11-19):
 * - https://antigravity.google/docs/cli/headless/ - one JSON envelope:
 *   { conversation_id, status: 'SUCCESS', response, duration_seconds,
 *     num_turns, usage: { input_tokens, output_tokens, thinking_tokens,
 *     cache_read_tokens, total_tokens } }
 * - https://antigravity.google/docs/permissions?tab=cli - permission engine:
 *   { permissions: { allow: [], deny: [], ask: [] } }, precedence Deny > Ask > Allow,
 *   actions read_file / write_file / read_url / execute_url / command /
 *   unsandboxed / mcp, `(*)` wildcards.
 * - Installed CLI verified 2026-11-19 (`agy --help`, v1.5.12):
 *   --sandbox (terminal restrictions), --settings (session-only JSON, never
 *   saved), --print-timeout (duration string), -p/--print, --output-format.
 *
 * Enforcement posture applied to every dispatch:
 * - `--sandbox`: documented Linux terminal sandbox (workspace + temp writes,
 *   no network from terminal commands).
 * - `--settings` (session-only, never written to disk): deny network-capable
 *   and sandbox-escalation actions outright; allow only what the task's
 *   authority grants. Nothing is left at `ask` - a print-mode run cannot
 *   answer prompts, so an unanswered ask must never decide.
 *
 * ASSURANCE GATE: 'documented' (default) REFUSES EVERY DISPATCH.
 * 'scoped-verified' currently allows exactly ONE shape: a NO-TOOLS reply
 * task (all seven permission actions wildcard-denied; the model can only
 * return text). This is reply-only integration, not coding readiness.
 *
 * Host evidence 2026-11-19 (agy 1.5.12, lab PC, headless -p --sandbox):
 * - Scoped write allow write_file(<workdir>): in-workdir write succeeded;
 *   $HOME canary outside workdir+temp DENIED with envelope denied_actions
 *   [write_file/Edit] (probe 578cbceb-...). HELD, not granted: write stays
 *   refused here pending a separate decision; scoped-write success is not
 *   general coding capability.
 * - Network: UNVERIFIED. Probe 1's curl denial ran under a wrong bare
 *   `command` rule; no valid network-confinement evidence exists. Every
 *   registry record must carry networkVerified: false.
 * - Unverified and refused: networkAllowed, allowedTools, writeAllowed,
 *   MCP, read grants (read_file(*)-denied for no-tools tasks), non-print
 *   modes. Headless auto-denies anything falling to Ask; ask=[] plus
 *   Deny>Ask>Allow precedence gives deny-by-default.
 */
export type Assurance = 'documented' | 'host-verified' | 'scoped-verified';

/** Session-only permission payload injected via --settings. Never persisted.
 * Current posture: NO-TOOLS. Every permission action is wildcard-denied;
 * allow is empty. The model can only return text. Explicit rules override
 * preset defaults, so this also blocks the workspace-default file access
 * and sandboxed-command allowance. (Scoped write_file(<workdir>) grants
 * were probe-verified but are deliberately held: not encoded here.)
 */
export function sessionSettings(): string {
  return JSON.stringify({
    permissions: {
      allow: [],
      deny: ['read_file(*)', 'write_file(*)', 'command(*)',
             'read_url(*)', 'execute_url(*)', 'download_url(*)', 'mcp(*)'],
      ask: [],
    },
  });
}

export class AntigravityCliConnector implements AgentConnector {
  readonly connectorId = 'antigravity-cli';
  readonly provenance = 'live' as const;

  constructor(
    private readonly exec: ExecFn,
    private readonly assurance: Assurance = 'documented',
  ) {}

  buildArgv(task: AgentTask): string[] {
    if (task.authority.writeAllowed) {
      throw new AuthorityDeniedError(
        'writeAllowed is held: scoped write was probe-verified but is not approved as coding capability (reply-only integration milestone)',
      );
    }
    if (task.authority.allowedTools.length > 0) {
      throw new AuthorityDeniedError('allowedTools stay refused: no tool grants verified beyond a no-tools reply');
    }
    if (task.authority.networkAllowed) {
      throw new AuthorityDeniedError('networkAllowed refused: network confinement is UNVERIFIED on this host');
    }
    return [
      '-p', task.prompt,
      '--output-format', 'json',
      '--sandbox',
      '--settings', sessionSettings(),
    ];
  }

  async run(task: AgentTask): Promise<AgentRunResult> {
    if (this.assurance !== 'scoped-verified') {
      throw new AuthorityDeniedError(
        'agy dispatch refused: assurance is only documented, not scoped-verified on this host (see probe evidence in the connector comment)',
      );
    }
    const argv = this.buildArgv(task);
    const proc = await this.exec('agy', argv, { cwd: task.workdir });
    const combined = (proc.stdout + '\n' + proc.stderr).toLowerCase();
    if (combined.includes('authentication required') || combined.includes('not authenticated')) {
      return this.failure('authentication required (run `agy` interactively once to sign in)', proc.durationSeconds);
    }
    if (proc.exitCode !== 0) {
      return this.failure(proc.stderr.trim() || `exit ${proc.exitCode}`, proc.durationSeconds);
    }
    return this.parseEnvelope(proc.stdout, proc.durationSeconds);
  }

  private failure(error: string, durationSeconds: number): AgentRunResult {
    return {
      connectorId: this.connectorId, status: 'FAILED', response: '', resumeId: null,
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0 },
      durationSeconds, error,
    };
  }

  parseEnvelope(stdout: string, durationSeconds: number): AgentRunResult {
    const env = JSON.parse(stdout);
    const u = env.usage ?? {};
    return {
      connectorId: this.connectorId,
      status: env.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      response: typeof env.response === 'string' ? env.response : '',
      resumeId: typeof env.conversation_id === 'string' ? env.conversation_id : null,
      usage: {
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        cachedInputTokens: u.cache_read_tokens ?? 0,
        totalTokens: u.total_tokens ?? ((u.input_tokens ?? 0) + (u.output_tokens ?? 0)),
      },
      durationSeconds: typeof env.duration_seconds === 'number' ? env.duration_seconds : durationSeconds,
    };
  }
}
