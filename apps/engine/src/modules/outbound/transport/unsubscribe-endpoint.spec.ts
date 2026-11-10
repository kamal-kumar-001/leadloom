import { describe, expect, it } from 'vitest';
import { buildListUnsubscribeHeaders, verifyUnsubscribeToken } from './unsubscribe';
import { createApplication } from '../../../main';

const KEY = Buffer.alloc(32, 9);
const PARAMS = { workspaceId: '7a2c1d90-5f3e-4b8c-9d1a-2e3f4a5b6c7d', campaignId: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e', recipientEmail: 'alice@example.com', signingKey: KEY };

describe('unsubscribe endpoint', () => {
  async function start(outbound: any, unsubscribeKey?: Buffer) {
    const app = await createApplication({ outbound, unsubscribeKey, sessionKey: Buffer.alloc(32, 1) } as any);
    const token = buildListUnsubscribeHeaders({ baseUrl: 'https://app.test/outbound/unsubscribe', ...PARAMS })['List-Unsubscribe'].match(/t=([^>&]+)/)![1];
    const q = `w=${PARAMS.workspaceId}&c=${PARAMS.campaignId}&e=${encodeURIComponent(PARAMS.recipientEmail)}&t=${token}`;
    return { app, q };
  }

  it('GET shows a confirmation page and never suppresses', async () => {
    let suppressed = 0;
    const { app, q } = await start({ suppress: async () => { suppressed += 1; } }, KEY);
    const res = await app.inject({ method: 'GET', url: `/outbound/unsubscribe?${q}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Confirm unsubscribe');
    expect(suppressed).toBe(0);
    await app.close();
  });

  it('POST with a valid token suppresses without cookies or auth', async () => {
    const calls: Array<{ w: string; e: string }> = [];
    const { app, q } = await start({ suppress: async (w: string, e: string) => { calls.push({ w, e }); } }, KEY);
    const res = await app.inject({ method: 'POST', url: `/outbound/unsubscribe?${q}`, payload: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual([{ w: PARAMS.workspaceId, e: PARAMS.recipientEmail }]);
    expect(verifyUnsubscribeToken({ ...PARAMS }, 'bad')).toBe(false);
    await app.close();
  });

  it('rejects tampered tokens and is absent without a signing key', async () => {
    const { app, q } = await start({ suppress: async () => undefined }, KEY);
    const bad = await app.inject({ method: 'POST', url: `/outbound/unsubscribe?${q}tampered` });
    expect(bad.statusCode).toBe(400);
    await app.close();
    const bare = await createApplication({ outbound: {}, sessionKey: Buffer.alloc(32, 1) } as any);
    expect((await bare.inject({ method: 'GET', url: `/outbound/unsubscribe?${q}` })).statusCode).toBe(404);
    await bare.close();
  });
});
