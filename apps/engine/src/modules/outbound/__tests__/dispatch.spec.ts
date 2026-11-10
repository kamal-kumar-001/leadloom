import { describe, it, expect, vi } from 'vitest';
import { DispatchService, type DispatchRepository, type DispatchSnapshot } from '../dispatch.service';
const now = new Date('2026-11-10T08:00:00Z');
function setup() {
  const snapshot: DispatchSnapshot = { workspaceId: 'a', campaignId: 'campaign', active: true,
    dailyLimitTotal: 50, sentToday: 0, mailboxes: [{ id: 'box', isPaused: false, healthScore: 100, sentToday: 0, dailySendLimit: 50 }] };
  const reservation = { id: 'reservation', workspaceId: 'a', campaignId: 'campaign', mailboxId: 'box', messageRef: 'synthetic-message' };
  const repository: DispatchRepository = {
    snapshot: vi.fn(async () => snapshot), claim: vi.fn(async () => reservation), finish: vi.fn(async () => {}),
  };
  const transport = { send: vi.fn(async () => ({ providerMessageId: 'synthetic-receipt' })) };
  const service = new DispatchService(repository, transport, () => now, () => 0);
  return { snapshot, reservation, repository, transport, service };
}
describe('Dispatch queue tick with fake repository/transport only', () => {
  it('reserves a 45-second earliest-next-send before calling transport', async () => {
    const t = setup();
    expect(await t.service.dispatchOnce('a', 'campaign')).toBe('accepted');
    expect(t.repository.claim).toHaveBeenCalledWith({ workspaceId: 'a', campaignId: 'campaign', mailboxId: 'box', now, nextDispatchAt: new Date(now.getTime() + 45000) });
    expect(t.repository.finish).toHaveBeenCalledWith('a', 'reservation', 'accepted', 'synthetic-receipt');
  });
  it('does not send paused campaigns or exhausted quotas', async () => {
    const t = setup(); t.snapshot.active = false;
    expect(await t.service.dispatchOnce('a','campaign')).toBe('idle');
    t.snapshot.active = true; t.snapshot.sentToday = 50;
    expect(await t.service.dispatchOnce('a','campaign')).toBe('idle');
    expect(t.transport.send).not.toHaveBeenCalled();
  });
  it('does not send when an atomic claim loses contention', async () => {
    const t = setup(); t.repository.claim = vi.fn(async () => null);
    expect(await t.service.dispatchOnce('a','campaign')).toBe('idle');
    expect(t.transport.send).not.toHaveBeenCalled();
  });
  it('rejects tenant substitutions before sending', async () => {
    const t = setup(); t.snapshot.workspaceId = 'b';
    await expect(t.service.dispatchOnce('a','campaign')).rejects.toThrow('Campaign scope mismatch');
    expect(t.transport.send).not.toHaveBeenCalled();
  });
  it('rejects reservation substitutions before sending', async () => {
    const t = setup(); t.reservation.workspaceId = 'b';
    await expect(t.service.dispatchOnce('a','campaign')).rejects.toThrow('Reservation scope mismatch');
    expect(t.transport.send).not.toHaveBeenCalled();
  });
  it('records provider errors as uncertain and does not retry', async () => {
    const t = setup(); t.transport.send.mockRejectedValue(new Error('synthetic timeout'));
    expect(await t.service.dispatchOnce('a','campaign')).toBe('uncertain');
    expect(t.transport.send).toHaveBeenCalledTimes(1);
    expect(t.repository.finish).toHaveBeenCalledWith('a', 'reservation', 'uncertain');
  });
  it('does not automatically resend on receipt persistence failure', async () => {
    const t = setup(); t.repository.finish = vi.fn(async () => { throw new Error('synthetic db error'); });
    await expect(t.service.dispatchOnce('a','campaign')).rejects.toThrow('synthetic db error');
    expect(t.transport.send).toHaveBeenCalledTimes(1);
  });
});
