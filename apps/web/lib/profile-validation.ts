export function validateProfileName(name: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof name !== 'string' || !name.trim() || name.length > 255) {
    return { ok: false, error: 'Display name must be between 1 and 255 characters' };
  }
  return { ok: true, name: name.trim() };
}

export function validatePasswordUpdate(input: {
  currentPassword?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
  email?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const { currentPassword, newPassword, confirmPassword, email } = input;

  if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 256) {
    return { ok: false, error: 'Password must be between 10 and 256 characters' };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'New password and confirmation do not match' };
  }

  if (email) {
    const normEmail = email.trim().toLowerCase();
    const localPart = normEmail.split('@')[0];
    const lowerPwd = newPassword.toLowerCase();
    if (lowerPwd.includes(normEmail) || (localPart.length >= 4 && lowerPwd.includes(localPart))) {
      return { ok: false, error: 'Password must not contain your email or username' };
    }
  }

  return { ok: true };
}
