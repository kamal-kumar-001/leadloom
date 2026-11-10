'use client';

import React from 'react';
import {
  AccountSettingsCard,
  AppearanceSettingsCard,
  PlanLimitsCard,
  TeamSettingsCard,
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
          Manage your account profile, theme appearance, contractual system limits, and team seats.
        </p>
      </div>

      {/* 1. Account & Workspace */}
      <AccountSettingsCard />

      {/* 2. Theme Appearance */}
      <AppearanceSettingsCard />

      {/* 3. Contractual Plan Limits */}
      <PlanLimitsCard />

      {/* 4. Team Members */}
      <TeamSettingsCard />
    </div>
  );
}
