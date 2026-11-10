'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchAuthMe, fetchWorkspaceSummary, type WorkspaceSummary } from '../../lib/engine-client';
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

  const [summaryState, setSummaryState] = useState<CardState<WorkspaceSummary>>({
    data: null,
    isLoading: true,
    error: null,
  });

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

  const loadSummary = useCallback(async () => {
    setSummaryState({ data: null, isLoading: true, error: null });
    try {
      const res = await fetchWorkspaceSummary();
      if (res.data) {
        setSummaryState({
          data: res.data,
          isLoading: false,
          error: null,
        });
      } else {
        setSummaryState({
          data: null,
          isLoading: false,
          error: res.error || 'Failed to fetch workspace summary',
        });
      }
    } catch (err: unknown) {
      setSummaryState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to connect to workspace summary',
      });
    }
  }, []);

  useEffect(() => {
    loadUserInfo();
    loadSummary();
  }, [loadUserInfo, loadSummary]);

  const hasProviderKeys = Boolean(summaryState.data && summaryState.data.providerKeys > 0);
  const hasMailboxes = Boolean(summaryState.data && summaryState.data.mailboxes > 0);
  const hasTables = Boolean(summaryState.data && summaryState.data.tables > 0);

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
        summaryState={summaryState}
        onRetry={loadSummary}
      />

      {/* 3. Getting Started Checklist */}
      <GettingStartedChecklist
        hasProviderKeys={hasProviderKeys}
        hasMailboxes={hasMailboxes}
        hasTables={hasTables}
      />

      {/* 4. Empty State if no provider keys connected */}
      {!summaryState.isLoading && !summaryState.error && summaryState.data?.providerKeys === 0 && (
        <EmptyVaultCard />
      )}
    </div>
  );
}
