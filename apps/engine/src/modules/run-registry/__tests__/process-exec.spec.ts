import { describe, it, expect } from 'vitest';
import { createProcessExec } from '../../agent-connect/process-exec';
import { RunTimeoutError, OutputLimitError } from '../../agent-connect/policy';

const node = process.execPath;
const cwd = '/tmp';

describe('createProcessExec (real spawn, local node only)', () => {
  it('captures stdout and exit code without a shell', async () => {
    const exec = createProcessExec({ timeoutSeconds: 5, maxStdoutBytes: 1024 });
    const res = await exec(node, ['-e', 'process.stdout.write("hello")'], { cwd });
    expect(res.stdout).toBe('hello');
    expect(res.exitCode).toBe(0);
  });

  it('does not let arguments become commands (no shell injection)', async () => {
    const exec = createProcessExec({ timeoutSeconds: 5, maxStdoutBytes: 1024 });
    const res = await exec(node, ['-e', 'process.stdout.write(process.argv[1])', '; echo pwned'], { cwd });
    expect(res.stdout).toBe('; echo pwned'); // literal argument, never executed
  });

  it('KILLS a runaway producer on timeout instead of waiting', async () => {
    const exec = createProcessExec({ timeoutSeconds: 0.2, maxStdoutBytes: 1024 });
    const t0 = Date.now();
    await expect(exec(node, ['-e', 'setInterval(()=>{},1000)'], { cwd })).rejects.toThrow(RunTimeoutError);
    expect(Date.now() - t0).toBeLessThan(3000); // killed fast, not left running
  });

  it('KILLS an output flood at the cap instead of capturing unboundedly', async () => {
    const exec = createProcessExec({ timeoutSeconds: 10, maxStdoutBytes: 4096 });
    await expect(
      exec(node, ['-e', 'while(true){process.stdout.write("x".repeat(65536))}'], { cwd }),
    ).rejects.toThrow(OutputLimitError);
  });

  it('surfaces a missing binary as an error (e.g. CLI not installed)', async () => {
    const exec = createProcessExec({ timeoutSeconds: 2, maxStdoutBytes: 1024 });
    await expect(exec('definitely-not-a-real-binary-xyz', [], { cwd })).rejects.toThrow();
  });
});
