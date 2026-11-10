'use client';

import React from 'react';
import {
  AccountSettingsCard,
  AppearanceSettingsCard,
  PlanLimitsCard,
  TeamSettingsCard,
  ProviderKeysCard,
} from '../../../components/settings';

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
          Workspace Settings
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Manage your account profile, provider keys, theme appearance, contractual system limits, and team seats.
        </p>
      </div>

      {/* 1. Account & Workspace */}
      <AccountSettingsCard />

      {/* 2. Provider Keys (BYOK Encrypted Vault) */}
      <ProviderKeysCard />

      {/* 3. Theme Appearance */}
      <AppearanceSettingsCard />

      {/* 4. Contractual Plan Limits */}
      <PlanLimitsCard />

      {/* 5. Team Members */}
      <TeamSettingsCard />
    </div>
  );
}
