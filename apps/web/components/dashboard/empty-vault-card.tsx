'use client';

import React from 'react';
import Link from 'next/link';
import { EmptyState, Button } from '@leadloom/ui';
import { Key, Plus } from 'lucide-react';

export function EmptyVaultCard() {
  return (
    <EmptyState
      icon={<Key className="w-8 h-8 text-brand-loom" />}
      title="No enrichment providers connected"
      description="Connect your Apollo, Hunter, Dropcontact, or other enrichment provider keys to resolve contacts at wholesale cost."
      action={
        <Link href="/app/connectors">
          <Button variant="primary" size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>Connect First Provider</span>
          </Button>
        </Link>
      }
    />
  );
}
