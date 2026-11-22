import { TaskAuthority } from './types';

/**
 * What a connector can actually ENFORCE, not merely request. An authority
 * flag we cannot enforce at the executor is not security metadata - so a
 * connector must refuse to dispatch any task whose authority it cannot
 * enforce. "Don't pass the flag" is not enforcement.
 */
export interface Enforcement {
  filesystem: 'sandbox-flag' | 'none';
  network: 'enforced-deny' | 'none';
  toolAllowlist: 'flag' | 'none';
}

export interface AuthorityCheck {
  supported: boolean;
  reason?: string;
}

export function checkAuthority(authority: TaskAuthority, enforcement: Enforcement): AuthorityCheck {
  if (authority.networkAllowed && enforcement.network !== 'enforced-deny') {
    return { supported: false, reason: 'connector cannot enforce network policy' };
  }
  if (authority.allowedTools.length > 0 && enforcement.toolAllowlist !== 'flag') {
    return { supported: false, reason: 'connector has no tool-allowlist mechanism to enforce' };
  }
  if (authority.writeAllowed && enforcement.filesystem !== 'sandbox-flag') {
    return { supported: false, reason: 'connector cannot enforce filesystem write boundaries' };
  }
  if (!authority.writeAllowed && enforcement.filesystem === 'none') {
    return {
      supported: false,
      reason: 'connector cannot enforce read-only; running the agent at all grants it ambient capabilities. Run under external isolation first',
    };
  }
  return { supported: true };
}
