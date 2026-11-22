'use client';

import React, { createContext, useContext } from 'react';

/** Who is signed in, from the engine (/auth/me) and the session. Never hardcoded. */
export interface ShellIdentity {
  updateName?: (name: string) => void;
  name: string | null;
  email: string | null;
  workspaceId: string | null;
  role: string | null;
  isPlatformAdmin: boolean;
}

const IdentityContext = createContext<ShellIdentity>({
  name: null,
  email: null,
  workspaceId: null,
  role: null,
  isPlatformAdmin: false,
});

export const IdentityProvider = IdentityContext.Provider;
export const useShellIdentity = () => useContext(IdentityContext);

export function shortWorkspaceId(id: string | null): string {
  return id ? id.slice(0, 8) : '';
}
