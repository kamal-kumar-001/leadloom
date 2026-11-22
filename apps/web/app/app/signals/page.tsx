import React from 'react';
import { currentWebAccess } from '../../../lib/current-web-access';
import { buildDemoSignalsView } from '../../../lib/signals-view-model';
import { SignalsView } from '../../../components/signals/signals-view';
import { getDraftStoreForUser } from '../../../lib/signals-drafts-store';

export const dynamic = 'force-dynamic';

export default async function SignalsPage() {
  const access = await currentWebAccess();
  if (!access.ok) return <p role="alert" className="p-6 text-sm text-text-secondary">{access.error} No saved signal drafts were loaded.</p>;
  const { rows } = buildDemoSignalsView();
  const queue = getDraftStoreForUser(access.email).list();
  return <SignalsView rows={rows} queue={queue} />;
}
