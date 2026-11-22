import { spawn } from 'node:child_process';
import { ExecFn } from './types';
import { OutputLimitError, RunTimeoutError } from './policy';

/**
 * The real ExecFn: spawn WITHOUT a shell (argv array, prompt text can never
 * become a command). Hard bounds are enforced on the PRODUCER, not after the
 * fact: the child is killed the moment stdout exceeds the cap or the timeout
 * fires - output is never captured unboundedly first.
 */
export function createProcessExec(bounds: { timeoutSeconds: number; maxStdoutBytes: number }): ExecFn {
  return (file, args, options) =>
    new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const child = spawn(file, args, { cwd: options.cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;

      const kill = (err: Error) => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(err);
      };

      const timer = setTimeout(() => kill(new RunTimeoutError(bounds.timeoutSeconds)), bounds.timeoutSeconds * 1000);

      child.stdout.on('data', (chunk: Buffer) => {
        if (settled) return;
        if (Buffer.byteLength(stdout, 'utf8') + chunk.length > bounds.maxStdoutBytes) {
          kill(new OutputLimitError(bounds.maxStdoutBytes));
          return;
        }
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        if (Buffer.byteLength(stderr, 'utf8') < 64 * 1024) stderr += chunk.toString('utf8');
      });
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err); // e.g. ENOENT when the CLI is not installed - surfaced, never faked
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 1, durationSeconds: (Date.now() - startedAt) / 1000 });
      });
    });
}
