import { describe, it, expect, afterEach } from 'vitest';
import { trustedClientIp } from '../client-ip';

const H = (entries: Record<string, string>) => new Headers(entries);

describe('trustedClientIp (fail-closed client-IP forwarding)', () => {
  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.LEADLOOM_TRUSTED_CLIENT_IP_HEADER;
  });

  it('never forwards raw client x-forwarded-for by default', () => {
    expect(trustedClientIp(H({ 'x-forwarded-for': '203.0.113.7' }))).toBeUndefined();
  });

  it('on Vercel trusts the platform-overwritten XFF chain', () => {
    process.env.VERCEL = '1';
    // Documented guarantee: Vercel overwrites XFF itself, so here XFF is the edge value, not the attacker's.
    expect(trustedClientIp(H({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(trustedClientIp(H({ 'x-vercel-forwarded-for': '203.0.113.8, 10.0.0.1' }))).toBe('203.0.113.8');
    expect(trustedClientIp(H({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
  });

  it('off Vercel the same header names are client-spoofable and ignored', () => {
    expect(trustedClientIp(H({ 'x-real-ip': '203.0.113.7' }))).toBeUndefined();
    expect(trustedClientIp(H({ 'x-vercel-forwarded-for': '203.0.113.8' }))).toBeUndefined();
  });

  it('honours a named trusted-ingress header, and refuses x-forwarded-for as that name', () => {
    process.env.LEADLOOM_TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';
    expect(trustedClientIp(H({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    process.env.LEADLOOM_TRUSTED_CLIENT_IP_HEADER = 'x-forwarded-for';
    expect(trustedClientIp(H({ 'x-forwarded-for': '198.51.100.4' }))).toBeUndefined();
  });
});
