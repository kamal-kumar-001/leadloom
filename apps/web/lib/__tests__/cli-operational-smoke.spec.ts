import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import type { AddressInfo } from 'node:net';

import { createApplication } from '../../../../apps/engine/src/main';
import { InMemoryAgentTokenStore, AgentTokenService } from '../../../../apps/engine/src/modules/auth/agent-token.service';
import { InMemoryProjectRegistryStore, ProjectRegistryService } from '../../../../apps/engine/src/modules/project-context/project-registry.service';
import { InMemoryProjectContextStore, ProjectContextService } from '../../../../apps/engine/src/modules/project-context/project-context.service';
import { CLI_SCRIPT_CONTENT, buildSkillsBundle } from '../skills-bundle';

function runCliAsync(cliPath: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile('node', [cliPath, ...args], { cwd }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout ? stdout.toString() : '',
        stderr: stderr ? stderr.toString() : '',
        code: error && typeof error.code === 'number' ? error.code : (error ? 1 : 0),
      });
    });
  });
}

describe('CLI Operational Smoke Test (Disposable Real Engine Server)', () => {
  it('executes real context set and get via generated cli.mjs against listening disposable engine', async () => {
    const atStore = new InMemoryAgentTokenStore();
    const prStore = new InMemoryProjectRegistryStore();
    const pcStore = new InMemoryProjectContextStore(prStore);

    const atService = new AgentTokenService(atStore);
    const prService = new ProjectRegistryService(prStore);
    const pcService = new ProjectContextService(pcStore);

    const workspaceId = randomUUID();
    const userId = randomUUID();
    const projectId = randomUUID();

    atStore.workspaces.set(workspaceId, { active: true });
    atStore.users.set(userId, { role: 'admin', disabledAt: null });

    // Seed project in registry
    prStore.projects.set(projectId, {
      id: projectId,
      workspaceId,
      name: 'Logistics AI',
      slug: 'logistics-ai',
      description: 'Autonomous freight verification',
      createdByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Issue project-bound agent token
    const issued = await atService.issue(workspaceId, userId, {
      name: 'Smoke Agent Token',
      scopes: ['project:context:read', 'project:context:write'],
      projectId,
    });
    const agentToken = issued.token;

    // Start disposable Nest/Fastify app on ephemeral TCP port
    const sessionKey = Buffer.from('test_session_secret_key_32_bytes_long!!');
    const app = await createApplication({
      sessionKey,
      agentTokens: atService,
      projectContext: pcService,
      projectRegistry: prService,
    } as any);

    const fastify = app.getHttpAdapter().getInstance();
    await fastify.ready();
    const server = app.getHttpServer();
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });
    const address = server.address() as AddressInfo;
    const engineUrl = `http://127.0.0.1:${address.port}`;

    // Create a temporary customer project directory
    const testDir = mkdtempSync(join(tmpdir(), 'leadloom-cli-smoke-'));

    try {
      // 1. Verify buildSkillsBundle produces the cli.mjs and .env.local
      const { archive } = buildSkillsBundle({
        projectId,
        projectSlug: 'logistics-ai',
        tokenPlaceholder: agentToken,
        apiUrl: engineUrl,
      });
      expect(archive.length).toBeGreaterThan(0);

      // Write cli.mjs to temporary customer directory
      const cliPath = join(testDir, 'cli.mjs');
      writeFileSync(cliPath, CLI_SCRIPT_CONTENT, { mode: 0o755 });

      // Write .env.local with configured engine URL and project-bound token
      const envPath = join(testDir, '.env.local');
      writeFileSync(
        envPath,
        `LEADLOOM_API_URL="${engineUrl}"\nLEADLOOM_PROJECT_ID="${projectId}"\nLEADLOOM_AGENT_TOKEN="${agentToken}"\n`
      );

      // 2. Operational test: context set
      const testPayload = JSON.stringify({
        hypothesis: 'Automate freight broker detention recovery',
        milestone: 'smoke_test_passed',
        activeExperiments: 3,
      });

      const setResult = await runCliAsync(cliPath, ['context', 'set', testPayload], testDir);
      expect(setResult.code).toBe(0);
      const parsedSet = JSON.parse(setResult.stdout);
      expect(parsedSet.projectId).toBe(projectId);
      expect(parsedSet.context.hypothesis).toBe('Automate freight broker detention recovery');
      expect(parsedSet.context.milestone).toBe('smoke_test_passed');

      // 3. Operational test: context get
      const getResult = await runCliAsync(cliPath, ['context', 'get'], testDir);
      expect(getResult.code).toBe(0);
      const parsedGet = JSON.parse(getResult.stdout);
      expect(parsedGet.projectId).toBe(projectId);
      expect(parsedGet.context.hypothesis).toBe('Automate freight broker detention recovery');
      expect(parsedGet.context.milestone).toBe('smoke_test_passed');
      expect(parsedGet.context.activeExperiments).toBe(3);

      const noWorkspaceToken = await runCliAsync(cliPath, ['validator', 'list'], testDir);
      expect(noWorkspaceToken.code).toBe(1);
      expect(noWorkspaceToken.stderr).toContain('LEADLOOM_TOOL_TOKEN is unconfigured');

      // 4. Verify unconfigured sentinel exits code 1 with actionable guidance
      writeFileSync(
        envPath,
        `LEADLOOM_API_URL="SETUP_REQUIRED_CONFIGURE_ENGINE_PUBLIC_URL"\nLEADLOOM_PROJECT_ID="${projectId}"\nLEADLOOM_AGENT_TOKEN="${agentToken}"\n`
      );

      const unconfiguredResult = await runCliAsync(cliPath, ['context', 'get'], testDir);
      expect(unconfiguredResult.code).toBe(1);
      expect(unconfiguredResult.stderr).toContain('LEADLOOM_API_URL is unconfigured or set to SETUP_REQUIRED_CONFIGURE_ENGINE_PUBLIC_URL');
    } finally {
      // Clean up server and temp dir
      await app.close();
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {}
    }
  });
});
