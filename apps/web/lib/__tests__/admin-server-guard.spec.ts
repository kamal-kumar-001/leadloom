import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isPlatformAdmin } from '../platform-admin';

describe('Server & API Platform Admin Verified Guard Specification', () => {
  const originalEnv = process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL;

  beforeEach(() => {
    delete process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL = originalEnv;
    } else {
      delete process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL;
    }
  });

  it('rejects requests when LEADLOOM_PLATFORM_ADMIN_EMAIL is not configured on the server', () => {
    // Zero-fallback security invariant: unset env var always fails closed
    expect(isPlatformAdmin({ email: 'mr.kamal0120@gmail.com', email_verified: true })).toBe(false);
  });

  it('rejects unverified sessions even if the email strictly matches configured admin', () => {
    process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL = 'mr.kamal0120@gmail.com';

    // Must have cryptographic provider email_verified === true
    expect(isPlatformAdmin({ email: 'mr.kamal0120@gmail.com', email_verified: false })).toBe(false);
    expect(isPlatformAdmin({ email: 'mr.kamal0120@gmail.com' })).toBe(false);
    expect(isPlatformAdmin({ email: 'mr.kamal0120@gmail.com', email_verified: undefined })).toBe(false);
  });

  it('strictly approves provider-verified authenticated session matching configured email', () => {
    process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL = 'mr.kamal0120@gmail.com';

    expect(isPlatformAdmin({ email: 'mr.kamal0120@gmail.com', email_verified: true })).toBe(true);
    expect(isPlatformAdmin({ email: 'MR.KAMAL0120@GMAIL.COM', email_verified: true })).toBe(true);
  });

  it('rejects regular workspace admins and other email domains at the platform operator boundary', () => {
    process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL = 'mr.kamal0120@gmail.com';

    expect(isPlatformAdmin({ email: 'admin@acme.com', email_verified: true })).toBe(false);
    expect(isPlatformAdmin({ email: 'mrnormal128@gmail.com', email_verified: true })).toBe(false);
    expect(isPlatformAdmin({ email: 'mrnormal145@gmail.com', email_verified: true })).toBe(false);
  });
});
