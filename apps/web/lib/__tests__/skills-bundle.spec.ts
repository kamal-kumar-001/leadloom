import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import zlib from 'node:zlib';
import fs from 'node:fs';
import { buildSkillsBundle, createTarGz, resolveSkillsDirectory } from '../skills-bundle';

vi.mock('server-only', () => ({}));
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

const mockAuth = vi.fn();
vi.mock('../../auth', () => ({
  auth: () => mockAuth(),
}));

const mockEngineCall = vi.fn();
vi.mock('../engine-server', () => ({
  engineBase: () => 'http://127.0.0.1:4010',
  mintBridgeToken: vi.fn((user: any) => (user?.email ? 'mock_bridge_jwt' : null)),
  engineCall: (...args: any[]) => mockEngineCall(...args),
}));

describe('skills-bundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AUTH_URL', 'https://leadloom.dmpilot.org');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('resolves the repository skills directory containing 8 skills', () => {
    const dir = resolveSkillsDirectory();
    expect(dir).toBeTruthy();
  });

  it('generates a valid posix ustar .tar.gz bundle containing 8 skills, .env.local, README.md, and dependency-free cli.mjs', () => {
    const { filename, archive, fileCount } = buildSkillsBundle({
      projectId: 'b0f80877-3e61-4608-8e6f-fb94e1d1f05a',
      projectSlug: 'logistics-ai',
      tokenPlaceholder: 'lld_agt_sample_dummy_token',
      apiUrl: 'https://leadloom.dmpilot.org',
    });

    expect(filename).toBe('leadloom-agent-skills-logistics-ai.tar.gz');
    expect(fileCount).toBe(12); // 9 skills + .env.local + README.md + cli.mjs
    expect(archive).toBeInstanceOf(Buffer);
    expect(archive.length).toBeGreaterThan(500);

    const decompressed = zlib.gunzipSync(archive);
    const tarString = decompressed.toString('utf-8');

    expect(tarString).toContain('skills/founder-workspace/SKILL.md');
    expect(tarString).toContain('skills/idea-feasibility/SKILL.md');
    expect(tarString).toContain('skills/competitor-review-mining/SKILL.md');
    expect(tarString).toContain('skills/landing-publish/SKILL.md');
    expect(tarString).toContain('skills/lead-capture/SKILL.md');
    expect(tarString).toContain('skills/outreach-recording/SKILL.md');
    expect(tarString).toContain('skills/scheduled-posting/SKILL.md');
    expect(tarString).toContain('skills/project-drafts/SKILL.md');
    expect(tarString).toContain('skills/investor-support/SKILL.md');
    expect(tarString).toContain('source ledger');
    expect(tarString).toContain('project-experiments results');
    expect(tarString).toContain('not provider/delivery receipts');
    expect(tarString).not.toContain('autonomous Go-To-Market execution skills');
    expect(tarString).toContain('project:assets:write');
    expect(tarString).toContain('.env.local');
    expect(tarString).toContain('README.md');
    expect(tarString).toContain('cli.mjs');
    expect(tarString).toContain('LEADLOOM_PROJECT_ID="b0f80877-3e61-4608-8e6f-fb94e1d1f05a"');
    expect(tarString).toContain('LEADLOOM_AGENT_TOKEN="lld_agt_sample_dummy_token"');
    expect(tarString).toContain('LEADLOOM_TOOL_TOKEN=');
    expect(tarString).toContain('Project-First Credentials');
  });

  it('refuses missing, blank or unreadable required packs instead of generating generic placeholder instructions',()=>{
    const exists=fs.existsSync.bind(fs),read=fs.readFileSync.bind(fs);
    for(const mode of ['directory','missing','blank','unreadable']){
      const missing=vi.spyOn(fs,'existsSync').mockImplementation((file:any)=>mode==='directory'?false:mode==='missing'&&String(file).endsWith('/investor-support/SKILL.md')?false:exists(file));
      const failed=vi.spyOn(fs,'readFileSync').mockImplementation(((file:any,...args:any[])=>{
        if(String(file).endsWith('/investor-support/SKILL.md')){if(mode==='blank')return '  \n ';if(mode==='unreadable')throw Error('Synthetic private filesystem diagnostics');}
        return (read as any)(file,...args);
      })as any);
      try{expect(()=>buildSkillsBundle({})).toThrow();}finally{failed.mockRestore();missing.mockRestore();}
    }
  });

  it('creates tar.gz from arbitrary file descriptors with 512-byte block alignment', () => {
    const archive = createTarGz([
      { name: 'test.txt', content: 'hello world' },
      { name: 'config.json', content: JSON.stringify({ ok: true }) },
    ]);
    expect(archive.length).toBeGreaterThan(0);
    const decompressed = zlib.gunzipSync(archive);
    expect(decompressed.length % 512).toBe(0);
    expect(decompressed.toString('utf-8')).toContain('test.txt');
    expect(decompressed.toString('utf-8')).toContain('hello world');
  });

  it('generates runnable cli.mjs that executes dependency-free with help output', async () => {
    const { execSync } = await import('node:child_process');
    const { CLI_SCRIPT_CONTENT } = await import('../skills-bundle');
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const tmpCli = join(tmpdir(), `test-leadloom-cli-${Date.now()}.mjs`);
    writeFileSync(tmpCli, CLI_SCRIPT_CONTENT, { mode: 0o755 });
    try {
      const output = execSync(`node "${tmpCli}" --help`, { encoding: 'utf-8' });
      expect(output).toContain('LeadLoom Customer Agent CLI');
      expect(output).toContain('context get');
      expect(output).toContain('context set');
      expect(output).toContain('validator create');
      expect(output).toContain('validator publish');
      expect(output).toContain('validator unpublish');
      expect(output).toContain('validator scorecard');
      expect(output).toContain('validator outreach');
      expect(output).toContain('research analyze');
      expect(output).toContain('research save');
      expect(output).toContain('assets search <kind|all>');
      expect(output).toContain('research leads');
    } finally {
      try { unlinkSync(tmpCli); } catch {}
    }
  });

  describe('GET /api/projects/[projectId]/bundle Route Handler (Browser-Session-Only)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      mockAuth.mockResolvedValue(null);
      const { GET } = await import('../../app/api/projects/[projectId]/bundle/route');
      const req = new Request('http://localhost:3000/api/projects/logistics-ai/bundle');
      const res = await GET(req, { params: Promise.resolve({ projectId: 'logistics-ai' }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Authentication required');
    });

    it('rejects path-traversal project identifiers with 400', async () => {
      const { GET } = await import('../../app/api/projects/[projectId]/bundle/route');
      const req = new Request('http://localhost:3000/api/projects/../bundle');
      const res = await GET(req, { params: Promise.resolve({ projectId: '..' }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid project identifier');
    });

    it('fails closed with 503 when the engine is unavailable', async () => {
      mockAuth.mockResolvedValue({ user: { email: 'founder@leadloom.com', idp: 'google', email_verified: true } });
      mockEngineCall.mockRejectedValue(new Error('Connection refused'));

      const { GET } = await import('../../app/api/projects/[projectId]/bundle/route');
      const req = new Request('http://localhost:3000/api/projects/logistics-ai/bundle');
      const res = await GET(req, { params: Promise.resolve({ projectId: 'logistics-ai' }) });
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe('Engine unavailable');
    });

    it('rejects with 404 when project does not belong to the user workspace', async () => {
      mockAuth.mockResolvedValue({ user: { email: 'founder@leadloom.com', idp: 'google', email_verified: true } });
      mockEngineCall.mockResolvedValue({
        ok: true,
        json: async () => [
          { id: '11111111-1111-1111-1111-111111111111', slug: 'other-project', name: 'Other Project' },
        ],
      });

      const { GET } = await import('../../app/api/projects/[projectId]/bundle/route');
      const req = new Request('http://localhost:3000/api/projects/foreign-project/bundle');
      const res = await GET(req, { params: Promise.resolve({ projectId: 'foreign-project' }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Project not found in this workspace');
    });

    it('returns uncached503 without a gzip/download or private diagnostics when a required pack is missing',async()=>{
      mockAuth.mockResolvedValue({user:{email:'founder@leadloom.com',idp:'google',email_verified:true}});
      mockEngineCall.mockResolvedValue({ok:true,json:async()=>[{id:'22222222-2222-2222-2222-222222222222',slug:'logistics-ai',name:'Logistics AI'}]});
      const {GET}=await import('../../app/api/projects/[projectId]/bundle/route'),exists=fs.existsSync.bind(fs),missing=vi.spyOn(fs,'existsSync').mockImplementation((file:any)=>String(file).endsWith('/investor-support/SKILL.md')?false:exists(file));
      try{const res=await GET(new Request('http://localhost/api/projects/logistics-ai/bundle'),{params:Promise.resolve({projectId:'logistics-ai'})});expect(res.status).toBe(503);expect(res.headers.get('content-type')).toContain('application/json');expect(res.headers.get('content-disposition')).toBeNull();expect(res.headers.get('cache-control')).toContain('no-store');const body=await res.json();expect(body).toEqual({error:'Project workflow bundle unavailable. No complete bundle was produced.'});}finally{missing.mockRestore();}
    });

    it('serves valid .tar.gz bundle with trusted base URL ignoring spoofed Host headers', async () => {
      mockAuth.mockResolvedValue({ user: { email: 'founder@leadloom.com', idp: 'google', email_verified: true } });
      mockEngineCall.mockResolvedValue({
        ok: true,
        json: async () => [
          { id: '22222222-2222-2222-2222-222222222222', slug: 'logistics-ai', name: 'Logistics AI' },
        ],
      });

      const { GET } = await import('../../app/api/projects/[projectId]/bundle/route');
      const req = new Request('http://localhost:3000/api/projects/logistics-ai/bundle', {
        headers: {
          host: 'malicious-spoof.com',
          'x-forwarded-host': 'evil.com',
          'x-forwarded-proto': 'https',
        },
      });
      const res = await GET(req, { params: Promise.resolve({ projectId: 'logistics-ai' }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/gzip');
      expect(res.headers.get('content-disposition')).toContain('leadloom-agent-skills-logistics-ai.tar.gz');

      const arrayBuf = await res.arrayBuffer();
      const gzBuf = Buffer.from(arrayBuf);
      const decompressed = zlib.gunzipSync(gzBuf);
      const tarString = decompressed.toString('utf-8');

      expect(tarString).toContain('skills/idea-feasibility/SKILL.md');
      expect(tarString).toContain('LEADLOOM_PROJECT_ID="22222222-2222-2222-2222-222222222222"');
      expect(tarString).toContain('# LEADLOOM_TOOL_TOKEN=""');
      expect(tarString).toContain('LEADLOOM_API_URL="https://leadloom.dmpilot.org/api/agent"');

      // Security invariant: never author destination URLs from untrusted request headers
      expect(tarString).not.toContain('malicious-spoof.com');
      expect(tarString).not.toContain('evil.com');
    });

    it('uses AUTH_URL-only configuration and refuses missing or malformed trusted destinations without Host fallback', async () => {
      mockAuth.mockResolvedValue({user:{email:'founder@leadloom.com',idp:'google',email_verified:true}});
      mockEngineCall.mockResolvedValue({ok:true,json:async()=>[{id:'22222222-2222-2222-2222-222222222222',slug:'logistics-ai',name:'Logistics AI'}]});
      const {GET}=await import('../../app/api/projects/[projectId]/bundle/route');
      vi.stubEnv('NEXT_PUBLIC_APP_URL','');vi.stubEnv('NEXTAUTH_URL','');
      for(const [authUrl,explicit,status] of [['https://configured.example','',200],['','',503],['https://configured.example','javascript:alert(1)',503]] as const){
        vi.stubEnv('AUTH_URL',authUrl);vi.stubEnv('LEADLOOM_PUBLIC_API_URL',explicit);
        const response=await GET(new Request('https://untrusted.example/api/projects/logistics-ai/bundle',{headers:{host:'untrusted.example','x-forwarded-host':'other.example'}}),{params:Promise.resolve({projectId:'logistics-ai'})});
        expect(response.status).toBe(status);
        if(status===200)expect(zlib.gunzipSync(Buffer.from(await response.arrayBuffer())).toString()).toContain('LEADLOOM_API_URL="https://configured.example/api/agent"');
        else{expect(response.headers.get('content-disposition')).toBeNull();expect(response.headers.get('cache-control')).toContain('no-store');}
      }
    });

    it('uses explicit LEADLOOM_PUBLIC_API_URL when configured', async () => {
      const orig = process.env.LEADLOOM_PUBLIC_API_URL;
      process.env.LEADLOOM_PUBLIC_API_URL = 'https://api.internal.leadloom.com';
      try {
        mockAuth.mockResolvedValue({ user: { email: 'founder@leadloom.com', idp: 'google', email_verified: true } });
        mockEngineCall.mockResolvedValue({
          ok: true,
          json: async () => [
            { id: '22222222-2222-2222-2222-222222222222', slug: 'logistics-ai', name: 'Logistics AI' },
          ],
        });

        const { GET } = await import('../../app/api/projects/[projectId]/bundle/route');
        const req = new Request('http://localhost:3000/api/projects/logistics-ai/bundle');
        const res = await GET(req, { params: Promise.resolve({ projectId: 'logistics-ai' }) });
        expect(res.status).toBe(200);

        const arrayBuf = await res.arrayBuffer();
        const decompressed = zlib.gunzipSync(Buffer.from(arrayBuf));
        expect(decompressed.toString('utf-8')).toContain('LEADLOOM_API_URL="https://api.internal.leadloom.com"');
      } finally {
        if (orig !== undefined) process.env.LEADLOOM_PUBLIC_API_URL = orig;
        else delete process.env.LEADLOOM_PUBLIC_API_URL;
      }
    });
  });

  describe('SEO & Crawl Policy (Verified Production Origin https://leadloom.dmpilot.org with Configured Override)', () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const originalAuthUrl = process.env.NEXTAUTH_URL;

    afterEach(() => {
      if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
      else delete process.env.NEXT_PUBLIC_APP_URL;

      if (originalAuthUrl !== undefined) process.env.NEXTAUTH_URL = originalAuthUrl;
      else delete process.env.NEXTAUTH_URL;
    });

    it('defaults to verified production origin https://leadloom.dmpilot.org when no env override is set', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXTAUTH_URL;

      const { getProductionBaseUrl, default: sitemap } = await import('../../app/sitemap');
      expect(getProductionBaseUrl()).toBe('https://leadloom.dmpilot.org');

      const items = sitemap();
      expect(items.length).toBe(4);
      expect(items.map((i) => i.url)).toEqual([
        'https://leadloom.dmpilot.org/',
        'https://leadloom.dmpilot.org/login',
        'https://leadloom.dmpilot.org/signup',
        'https://leadloom.dmpilot.org/forgot-password',
      ]);

      const { default: robots } = await import('../../app/robots');
      const policy = robots();
      expect(policy.sitemap).toBe('https://leadloom.dmpilot.org/sitemap.xml');
      expect(policy.host).toBe('https://leadloom.dmpilot.org');
    });

    it('honors configured environment override for public sitemap and robots', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://custom-domain.org';

      const { getProductionBaseUrl, default: sitemap } = await import('../../app/sitemap');
      expect(getProductionBaseUrl()).toBe('https://custom-domain.org');

      const items = sitemap();
      expect(items.length).toBe(4);
      expect(items.map((i) => i.url)).toEqual([
        'https://custom-domain.org/',
        'https://custom-domain.org/login',
        'https://custom-domain.org/signup',
        'https://custom-domain.org/forgot-password',
      ]);

      // Strictly verify no private data in sitemap
      for (const item of items) {
        expect(item.url).not.toMatch(/\/app(\/|$)/);
        expect(item.url).not.toMatch(/\/api(\/|$)/);
        expect(item.url).not.toMatch(/\/admin(\/|$)/);
        expect(item.url).not.toMatch(/\/projects(\/|$)/);
      }

      const { default: robots } = await import('../../app/robots');
      const policy = robots();
      expect(policy.sitemap).toBe('https://custom-domain.org/sitemap.xml');
      expect(policy.host).toBe('https://custom-domain.org');

      const rules = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules;
      expect(rules.disallow).toContain('/app/');
      expect(rules.disallow).toContain('/api/');
      expect(rules.disallow).toContain('/admin/');
      expect(rules.disallow).toContain('/*?*token=*');
    });
  });
});
