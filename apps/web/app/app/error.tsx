'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { EmptyState, Button } from '@leadloom/ui';
import { AlertCircle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { mapErrorMessage } from '@/lib/notify';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Workspace runtime error:', error);
  }, [error]);

  const friendlyMessage = mapErrorMessage(error);

  return (
    <div className="p-6 max-w-3xl mx-auto font-sans flex items-center justify-center min-h-[60vh]">
      <div className="w-full">
        <EmptyState
          icon={
            <div className="w-12 h-12 rounded-2xl bg-signal-failed/15 border border-signal-failed/30 flex items-center justify-center text-signal-failed">
              <AlertCircle className="w-6 h-6" />
            </div>
          }
          title="Workspace View Error"
          description={friendlyMessage}
          action={
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => reset()}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry View</span>
              </Button>
              <Link href="/app">
                <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
