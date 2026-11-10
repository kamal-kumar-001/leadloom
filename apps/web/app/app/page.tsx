'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { engineFetch, fetchAuthMe } from '../../lib/engine-client';
import type { MaskedBYOKCredential } from '@leadloom/contracts';
import {
  DashboardHeader,
  UserWorkspaceInfo,
  StatCardsGrid,
  CardState,
  GettingStartedChecklist,
  EmptyVaultCard,
} from '../../components/dashboard';

export default function AppPage() {
  const [userInfo, setUserInfo] = useState<UserWorkspaceInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  const [keysState, setKeysState] = useState<CardState<number>>({
    data: null,
    isLoading: true,
    error: null,
  });

  // The engine exposes no list endpoint for these yet (only POST), so no count is shown.
  const experimentsState: CardState<number> = { data: null, isLoading: false, error: null, unavailable: true };
  const jobsState: CardState<number> = { data: null, isLoading: false, error: null, unavailable: true };

  const loadUserInfo = useCallback(async () => {
    setUserLoading(true);
    setUserError(null);
    try {
      const [meRes, sessionRes] = await Promise.all([
        fetchAuthMe(),
        fetch('/api/auth/session')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (meRes.data) {
        const sessionEmail = sessionRes?.user?.email;
        const info: UserWorkspaceInfo = {
          userId: meRes.data.userId,
          workspaceId: meRes.data.workspaceId,
          role: meRes.data.role,
          email: sessionEmail || null,
        };
        setUserInfo(info);
      } else {
        setUserError(meRes.error || 'Failed to retrieve workspace identity');
      }
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'Engine connection error');
    } finally {
      setUserLoading(false);
    }
  }, []);

  const loadKeys = useCallback(async () => {
    setKeysState({ data: null, isLoading: true, error: null });
    try {
      const res = await engineFetch<MaskedBYOKCredential[]>('/vault/credentials');
      if (res.data) {
        setKeysState({
          data: Array.isArray(res.data) ? res.data.length : 0,
          isLoading: false,
          error: null,
        });
      } else {
        setKeysState({
          data: null,
          isLoading: false,
          error: res.error || 'Failed to fetch vault credentials',
        });
      }
    } catch (err: unknown) {
      setKeysState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to connect to vault',
      });
    }
  }, []);

  useEffect(() => {
    loadUserInfo();
    loadKeys();
  }, [loadUserInfo, loadKeys]);

  const hasProviderKeys = Boolean(keysState.data && keysState.data > 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* 1. Header with verified user & workspace */}
      <DashboardHeader
        info={userInfo}
        isLoading={userLoading}
        error={userError}
        onRetry={loadUserInfo}
      />

      {/* 2. Stat Cards Grid */}
      <StatCardsGrid
        keysState={keysState}
        experimentsState={experimentsState}
        jobsState={jobsState}
        onRetryKeys={loadKeys}
        onRetryExperiments={() => {}}
        onRetryJobs={() => {}}
      />

      {/* 3. Getting Started Checklist */}
      <GettingStartedChecklist
        hasProviderKeys={hasProviderKeys}
        hasMailboxes={false}
        hasTables={false}
      />

      {/* 4. Empty State if no provider keys connected */}
      {!keysState.isLoading && !keysState.error && keysState.data === 0 && (
        <EmptyVaultCard />
      )}
    </div>
  );
}
