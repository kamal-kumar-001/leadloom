import type { Role } from '../auth/rbac';

export interface ProvisionedMember { userId: string; workspaceId: string; role: Role; created: boolean }

/**
 * Persistence port. `createWorkspaceWithAdmin` must be atomic (workspace, user
 * and audit row together or not at all) and return null when the email already
 * exists, so concurrent first sign-ins converge on one account.
 */
export interface ProvisioningStore {
  findByEmail(email: string): Promise<{ userId: string; workspaceId: string; role: Role } | null>;
  createWorkspaceWithAdmin(input: { email: string; name: string | null; workspaceName: string }): Promise<{ userId: string; workspaceId: string } | null>;
}

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/**
 * First sign-in provisioning. Input is ONLY a provider-verified email (and a
 * display name for the label). There is no parameter for workspace or role:
 * a new user always gets a brand-new workspace and is admin of that workspace
 * alone. Joining an existing workspace needs an invite flow (not built), and
 * platform privileges are never granted here. No plan is assigned, so
 * entitlement gates deny until an owner or billing flow assigns one.
 */
export class ProvisioningService {
  constructor(private readonly store: ProvisioningStore) {}

  async provision(verifiedEmail: string, displayName?: string | null): Promise<ProvisionedMember> {
    const email = verifiedEmail.trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 320) throw new Error('Invalid email');
    const existing = await this.store.findByEmail(email);
    if (existing) return { ...existing, created: false };
    const name = (displayName ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 255) || null;
    const workspaceName = (name ? `${name}'s workspace` : `${email.split('@')[0]}'s workspace`).slice(0, 255);
    const made = await this.store.createWorkspaceWithAdmin({ email, name, workspaceName });
    if (made) return { ...made, role: 'admin', created: true };
    const raced = await this.store.findByEmail(email); // lost a race: converge on the winner
    if (!raced) throw new Error('Provisioning failed');
    return { ...raced, created: false };
  }
}
