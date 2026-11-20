import { describe, it, expect, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createApplication } from './main';

// J1: per-IP login limiting keys on the real client IP: X-Forwarded-For is
// trusted only from loopback peers (our own web proxy); direct non-loopback
// callers cannot spoof it.
describe('client-IP keying for per-IP limiters', () => {
  const prev = process.env.LEADLOOM_AUTH_ISSUER_ENABLED;
  process.env.LEADLOOM_AUTH_ISSUER_ENABLED = 'true';
  afterAll(() => { if (prev === undefined) delete process.env.LEADLOOM_AUTH_ISSUER_ENABLED; else process.env.LEADLOOM_AUTH_ISSUER_ENABLED = prev; });

  const services = {
    sessionKey: randomBytes(32),
    userDirectory: { findByEmail: async () => null }, // every login fails with 401
  } as never;

  const login = (server: any, headers: Record<string, string>, remoteAddress?: string) =>
    server.inject({ method: 'POST', url: '/auth/login', headers, remoteAddress, payload: { email: 'nobody@example.invalid', password: 'wrong-password' } });

  it('limits per forwarded client IP behind the loopback proxy, independently', async () => {
    const app = await createApplication(services);
    try {
      const server = app.getHttpAdapter().getInstance();
      const a = { 'x-forwarded-for': '203.0.113.10' };
      for (let i = 0; i < 5; i++) expect((await login(server, a)).statusCode).toBe(401);
      expect((await login(server, a)).statusCode).toBe(429); // sixth attempt from the same client IP
      // A different forwarded client IP keeps its own window.
      expect((await login(server, { 'x-forwarded-for': '203.0.113.99' })).statusCode).toBe(401);
    } finally { await app.close(); }
  }, 30000);

  it('ignores X-Forwarded-For from direct non-loopback callers (no spoofing)', async () => {
    const app = await createApplication(services);
    try {
      const server = app.getHttpAdapter().getInstance();
      for (let i = 0; i < 5; i++) expect((await login(server, {}, '10.9.8.7')).statusCode).toBe(401);
      expect((await login(server, {}, '10.9.8.7')).statusCode).toBe(429);
      // A forged XFF from the same direct peer does not reset the window.
      expect((await login(server, { 'x-forwarded-for': '203.0.113.200' }, '10.9.8.7')).statusCode).toBe(429);
    } finally { await app.close(); }
  }, 30000);
});
