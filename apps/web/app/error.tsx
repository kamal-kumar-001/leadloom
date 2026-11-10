'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { EmptyState, Button } from '@leadloom/ui';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { mapErrorMessage } from '@/lib/notify';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error locally for diagnostic review
    console.error('Unhandled application error:', error);
  }, [error]);

  const friendlyMessage = mapErrorMessage(error);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <EmptyState
          icon={
            <div className="w-12 h-12 rounded-2xl bg-signal-failed/15 border border-signal-failed/30 flex items-center justify-center text-signal-failed">
              <AlertTriangle className="w-6 h-6" />
            </div>
          }
          title="Something went wrong"
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
                <span>Try again</span>
              </Button>
              <Link href="/app">
                <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                  <Home className="w-3.5 h-3.5" />
                  <span>Return to App</span>
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
