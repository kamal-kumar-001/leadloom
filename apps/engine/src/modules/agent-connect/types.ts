/**
 * agent-connect: Leadloom's connector layer for the user's OWN coding agents
 * (Antigravity CLI, Codex CLI, ...). The agents run under the user's own
 * signed-in subscriptions on the user's machines; Leadloom never gets an AI
 * API key here. Every run is one explicit task with explicit authority.
 *
 * Authority model (deny by default):
 * - Filesystem writes, network access and non-read tools are OFF unless the
 *   task's authority grants them, and the grant comes from the caller that
 *   itself holds user approval. Tool allowlists are one layer, not a sandbox.
 * - The connector never auto-executes repo hooks, MCP servers or plugin code:
 *   it pins a least-privilege working directory per run.
 */

export type SandboxLevel = 'read-only' | 'workspace-write';

export interface TaskAuthority {
  /** Filesystem write inside workdir. Default false. */
  writeAllowed: boolean;
  /** Network access from the agent process. Default false. */
  networkAllowed: boolean;
  /** Tool names the agent may use (e.g. ['Read','Bash:ls']). Empty = read-only defaults. */
  allowedTools: string[];
  /** Per-run token ceiling; the run is refused before start if the budget is already exhausted. */
  maxTotalTokens: number;
}

export const READ_ONLY_AUTHORITY: TaskAuthority = {
  writeAllowed: false,
  networkAllowed: false,
  allowedTools: [],
  maxTotalTokens: 50_000,
};

export interface AgentTask {
  /** Single prompt; never concatenated into a shell string. */
  prompt: string;
  /** Least-privilege working directory for this run. Must exist. */
  workdir: string;
  authority: TaskAuthority;
  /** Resume a prior conversation/thread when the CLI supports it. */
  resumeId?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
}

export interface AgentRunResult {
  connectorId: string;
  status: 'SUCCESS' | 'FAILED';
  response: string;
  /** conversation_id / thread_id for resuming, when the CLI reports one. */
  resumeId: string | null;
  usage: TokenUsage;
  durationSeconds: number | null;
  error?: string;
}

export interface AgentConnector {
  readonly connectorId: string;
  /** 'mock' = simulated dev connector (nothing real ran); 'live' = a real local CLI. Recorded on every run for honest status display. */
  readonly provenance: 'mock' | 'live';
  run(task: AgentTask): Promise<AgentRunResult>;
}

/** Injected process runner so tests never spawn real processes. */
export type ExecFn = (
  file: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string; exitCode: number; durationSeconds: number }>;
