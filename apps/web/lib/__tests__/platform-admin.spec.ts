import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isPlatformAdmin } from '../platform-admin';

describe('Platform Admin Authorization Gate (Pure Configured - Zero Fallback)', () => {
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

  it('fails closed when LEADLOOM_PLATFORM_ADMIN_EMAIL is unset (zero hardcoded fallback)', () => {
    expect(
      isPlatformAdmin({
        email: 'mr.kamal0120@gmail.com',
        email_verified: true,
      })
    ).toBe(false);
  });

  it('authorizes provider-verified account when strictly matching LEADLOOM_PLATFORM_ADMIN_EMAIL', () => {
    process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL = 'mr.kamal0120@gmail.com';

    expect(
      isPlatformAdmin({
        email: 'mr.kamal0120@gmail.com',
        email_verified: true,
      })
    ).toBe(true);

    expect(
      isPlatformAdmin({
        email: 'MR.KAMAL0120@GMAIL.COM',
        email_verified: true,
      })
    ).toBe(true);
  });

  it('denies account if email is NOT provider-verified even if matching env var', () => {
    process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL = 'mr.kamal0120@gmail.com';

    expect(
      isPlatformAdmin({
        email: 'mr.kamal0120@gmail.com',
        email_verified: false,
      })
    ).toBe(false);

    expect(
      isPlatformAdmin({
        email: 'mr.kamal0120@gmail.com',
        email_verified: undefined,
      })
    ).toBe(false);
  });

  it('denies all other accounts when env var is set', () => {
    process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL = 'mr.kamal0120@gmail.com';

    expect(
      isPlatformAdmin({
        email: 'mrnormal128@gmail.com',
        email_verified: true,
      })
    ).toBe(false);

    expect(
      isPlatformAdmin({
        email: 'owner@demo.local',
        email_verified: true,
      })
    ).toBe(false);
  });

  it('denies anonymous or malformed inputs', () => {
    process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL = 'mr.kamal0120@gmail.com';

    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
    expect(isPlatformAdmin({ email: null, email_verified: true })).toBe(false);
    expect(isPlatformAdmin({ email: '', email_verified: true })).toBe(false);
  });
});
