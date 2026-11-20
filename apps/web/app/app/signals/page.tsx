import React from 'react';
import { auth } from '../../../auth';
import { buildDemoSignalsView } from '../../../lib/signals-view-model';
import { SignalsView } from '../../../components/signals/signals-view';
import { getDraftStoreForUser } from '../../../lib/signals-drafts-store';

export const dynamic = 'force-dynamic';

export default async function SignalsPage() {
  const { rows } = buildDemoSignalsView();
  const session = await auth();
  const queue = session?.user?.email ? getDraftStoreForUser(session.user.email).list() : [];
  return <SignalsView rows={rows} queue={queue} />;
}
