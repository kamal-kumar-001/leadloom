import { describe, it, expect, vi } from 'vitest';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from './main';

const key = randomBytes(32);
const workspaceId = randomUUID();

function token(role = 'member') {
  const payload = Buffer.from(
    JSON.stringify({ sub: randomUUID(), workspaceId, role, exp: Math.floor(Date.now() / 1000) + 60 })
  ).toString('base64url');
  return payload + '.' + createHmac('sha256', key).update(payload).digest('base64url');
}

describe('outbound approval routes (G9)', () => {
  it('enforces session, role permissions and returns honest sendingEnabled: false', async () => {
    const credentials = { save: vi.fn(), list: vi.fn(async () => []), delete: vi.fn() } as any;
    const outbound = {
      enqueue: vi.fn(async () => randomUUID()),
      suppress: vi.fn(async () => {}),
      listPendingApprovals: vi.fn(async () => [
        {
          id: randomUUID(),
          workspaceId,
          campaignId: randomUUID(),
          campaignName: 'Test Campaign',
          recipientEmail: 'test@example.invalid',
          stepNumber: 1,
          subject: 'Review Subject',
          bodySnippet: 'Review Body',
          status: 'pending_approval',
          scheduledAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ]),
      approve: vi.fn(async () => ({ approvedCount: 1 })),
      reject: vi.fn(async () => ({ rejectedCount: 1 })),
      getApprovalStats: vi.fn(async () => ({ pendingCount: 1, approvedCount: 0, rejectedCount: 0 })),
    } as any;

    const app = await createApplication({ credentials, outbound, sessionKey: key });
    try {
      const server = app.getHttpAdapter().getInstance();

      // 1. Unauthenticated requests are rejected
      expect((await server.inject({ method: 'GET', url: '/outbound/approvals' })).statusCode).toBe(401);
      expect((await server.inject({ method: 'POST', url: '/outbound/approvals/approve', payload: {} })).statusCode).toBe(401);
      expect((await server.inject({ method: 'POST', url: '/outbound/approvals/reject', payload: {} })).statusCode).toBe(401);

      // 2. Read-only role cannot mutate approvals
      expect(
        (
          await server.inject({
            method: 'POST',
            url: '/outbound/approvals/approve',
            headers: { authorization: 'Bearer ' + token('read_only') },
            payload: { all: true },
          })
        ).statusCode
      ).toBe(403);

      // 3. GET /outbound/approvals lists pending items with stats
      const getRes = await server.inject({
        method: 'GET',
        url: '/outbound/approvals',
        headers: { authorization: 'Bearer ' + token() },
      });
      expect(getRes.statusCode).toBe(200);
      const json = getRes.json();
      expect(json.items).toHaveLength(1);
      expect(json.stats.pendingCount).toBe(1);
      expect(json.sendingEnabled).toBe(false);
      expect(outbound.listPendingApprovals).toHaveBeenCalledWith(workspaceId, undefined);

      // 4. POST /outbound/approvals/approve batch
      const approveRes = await server.inject({
        method: 'POST',
        url: '/outbound/approvals/approve',
        headers: { authorization: 'Bearer ' + token() },
        payload: { all: true },
      });
      expect(approveRes.statusCode).toBe(200);
      expect(approveRes.json().approvedCount).toBe(1);
      expect(approveRes.json().sendingEnabled).toBe(false);
      expect(outbound.approve).toHaveBeenCalledWith(workspaceId, { all: true });

      // 5. POST /outbound/approvals/reject batch
      const rejectRes = await server.inject({
        method: 'POST',
        url: '/outbound/approvals/reject',
        headers: { authorization: 'Bearer ' + token() },
        payload: { all: true, reason: 'Test reject' },
      });
      expect(rejectRes.statusCode).toBe(200);
      expect(rejectRes.json().rejectedCount).toBe(1);
      expect(outbound.reject).toHaveBeenCalledWith(workspaceId, { all: true, reason: 'Test reject' });

      // 6. Single item approve & reject
      const testJobId = randomUUID();
      const singleApprove = await server.inject({
        method: 'POST',
        url: `/outbound/approvals/${testJobId}/approve`,
        headers: { authorization: 'Bearer ' + token() },
      });
      expect(singleApprove.statusCode).toBe(200);
      expect(singleApprove.json().sendingEnabled).toBe(false);

      const singleReject = await server.inject({
        method: 'POST',
        url: `/outbound/approvals/${testJobId}/reject`,
        headers: { authorization: 'Bearer ' + token() },
      });
      expect(singleReject.statusCode).toBe(200);

      // 7. Enqueuing via /outbound/jobs sets status: 'pending_approval'
      const jobPost = await server.inject({
        method: 'POST',
        url: '/outbound/jobs',
        headers: { authorization: 'Bearer ' + token() },
        payload: {
          campaignId: randomUUID(),
          recipientEmail: 'lead@example.invalid',
          idempotencyKey: 'idem-1',
          stepNumber: 1,
          scheduledAt: new Date().toISOString(),
        },
      });
      expect(jobPost.statusCode).toBe(202);
      expect(jobPost.json().status).toBe('pending_approval');
      expect(jobPost.json().sendingEnabled).toBe(false);
      expect(outbound.enqueue.mock.calls[0][0].status).toBe('pending_approval');
    } finally {
      await app.close();
    }
  });
});
