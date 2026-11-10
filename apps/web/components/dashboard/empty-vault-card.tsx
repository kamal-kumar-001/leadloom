'use client';

import React from 'react';
import Link from 'next/link';
import { EmptyState, Button } from '@leadloom/ui';
import { Key, Plus } from 'lucide-react';

export function EmptyVaultCard() {
  return (
    <EmptyState
      icon={<Key className="w-8 h-8 text-brand-loom" />}
      title="No provider keys saved"
      description="Add your own enrichment provider keys in Settings. Saving a key does not verify it or connect a provider."
      action={
        <Link href="/app/settings">
          <Button variant="primary" size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>Add a Provider Key</span>
          </Button>
        </Link>
      }
    />
  );
}
