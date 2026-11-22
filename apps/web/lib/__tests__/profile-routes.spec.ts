import { describe, it, expect } from 'vitest';
import { validateProfileName, validatePasswordUpdate } from '../profile-validation';

describe('Profile Validation Specification', () => {
  describe('validateProfileName', () => {
    it('rejects non-string names', () => {
      expect(validateProfileName(null).ok).toBe(false);
      expect(validateProfileName(undefined).ok).toBe(false);
      expect(validateProfileName(12345).ok).toBe(false);
      expect(validateProfileName({}).ok).toBe(false);
    });

    it('rejects empty or whitespace-only names', () => {
      expect(validateProfileName('').ok).toBe(false);
      expect(validateProfileName('   ').ok).toBe(false);
    });

    it('rejects names exceeding 255 characters', () => {
      const longName = 'a'.repeat(256);
      expect(validateProfileName(longName).ok).toBe(false);
    });

    it('accepts and trims valid display names', () => {
      const res = validateProfileName('  Kamal Kumar  ');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.name).toBe('Kamal Kumar');
      }
    });
  });

  describe('validatePasswordUpdate', () => {
    it('rejects missing or non-string passwords', () => {
      expect(validatePasswordUpdate({}).ok).toBe(false);
      expect(validatePasswordUpdate({ newPassword: 1234567890, confirmPassword: 1234567890 }).ok).toBe(false);
    });

    it('rejects passwords shorter than 10 characters', () => {
      const res = validatePasswordUpdate({ newPassword: 'Short1!', confirmPassword: 'Short1!' });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('between 10 and 256 characters');
      }
    });

    it('rejects mismatched password and confirmation', () => {
      const res = validatePasswordUpdate({
        newPassword: 'StrongPassword123!',
        confirmPassword: 'DifferentPassword123!',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('do not match');
      }
    });

    it('rejects passwords containing email or username handle', () => {
      const res1 = validatePasswordUpdate({
        newPassword: 'mykamal@leadloom.com123',
        confirmPassword: 'mykamal@leadloom.com123',
        email: 'kamal@leadloom.com',
      });
      expect(res1.ok).toBe(false);
      if (!res1.ok) {
        expect(res1.error).toContain('must not contain your email');
      }

      const res2 = validatePasswordUpdate({
        newPassword: 'prefix-kamal-suffix123',
        confirmPassword: 'prefix-kamal-suffix123',
        email: 'kamal@leadloom.com',
      });
      expect(res2.ok).toBe(false);
    });

    it('accepts valid, compliant passwords', () => {
      const res = validatePasswordUpdate({
        newPassword: 'SuperSecureUniquePassword2026!',
        confirmPassword: 'SuperSecureUniquePassword2026!',
        email: 'kamal@leadloom.com',
      });
      expect(res.ok).toBe(true);
    });
  });
});
