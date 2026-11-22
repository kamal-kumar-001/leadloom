/**
 * One bounded Leadloom e2e: a NO-TOOLS reply through the live Antigravity
 * connector, recorded in the run registry. Proves reply-only integration
 * (Leadloom dispatch -> agy -> parsed envelope -> registry record), NOT
 * coding readiness. Network confinement is UNVERIFIED; the registry label
 * says so and no record may imply otherwise.
 *
 * Run on the lab PC: npx tsx scripts/e2e-agy-reply.ts
 */
import { mkdirSync } from 'node:fs';
import {
  AntigravityCliConnector,
  createProcessExec,
  TokenBudget,
  READ_ONLY_AUTHORITY,
} from '../src/modules/agent-connect';
import { RunRegistryStore, registryPathFor } from '../src/modules/run-registry';

const REGISTRY_DIR = process.env.LEADLOOM_REGISTRY_DIR ?? '/tmp/leadloom-e2e';
const OWNER = 'kamal';

async function main(): Promise<void> {
  const workdir = '/tmp/agy-e2e-work';
  mkdirSync(workdir, { recursive: true });

  const budget = new TokenBudget();
  budget.assertWithin(OWNER, READ_ONLY_AUTHORITY.maxTotalTokens); // refuse before dispatch if exhausted

  const exec = createProcessExec({ timeoutSeconds: 120, maxStdoutBytes: 256 * 1024 });
  const connector = new AntigravityCliConnector(exec, 'scoped-verified');

  const startedAt = new Date().toISOString();
  const res = await connector.run({
    prompt: 'Reply with exactly: Leadloom connector online.',
    workdir,
    authority: { ...READ_ONLY_AUTHORITY },
  });
  budget.record(OWNER, res.usage);

  const store = new RunRegistryStore(registryPathFor(REGISTRY_DIR, OWNER));
  const record = await store.record({
    kind: 'agent-run',
    status: res.status,
    startedAt,
    finishedAt: new Date().toISOString(),
    label: 'agy no-tools reply e2e (reply-only integration; seven known permission actions denied; network unverified)',
    tokensUsed: res.usage.totalTokens,
    provenance: 'live-connector',
    ...(res.error ? { error: res.error } : {}),
  });
  console.log(JSON.stringify({ runResult: res, registryRecord: record }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
