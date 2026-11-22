export interface AdminUserCandidate {
  email?: string | null;
  email_verified?: boolean;
}

/**
 * Platform Admin Authorization Invariant:
 * Grants platform-level operator access IF AND ONLY IF:
 * 1. The account is authenticated.
 * 2. The account email is verified by a trusted identity provider (email_verified === true).
 * 3. The email strictly matches the configured platform admin identity from LEADLOOM_PLATFORM_ADMIN_EMAIL.
 * 
 * Strict Zero-Hardcoded-Fallback Rule:
 * Fails closed (false) if LEADLOOM_PLATFORM_ADMIN_EMAIL is not explicitly configured.
 */
export function isPlatformAdmin(user: AdminUserCandidate | null | undefined): boolean {
  if (!user?.email || !user.email_verified) return false;
  const configured = process.env.LEADLOOM_PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configured) return false;
  return user.email.trim().toLowerCase() === configured;
}
