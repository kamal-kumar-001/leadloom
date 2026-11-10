import React from 'react';
import Link from 'next/link';
import { EmptyState, Button } from '@leadloom/ui';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <EmptyState
          icon={
            <div className="w-12 h-12 rounded-2xl bg-canvas-elevated border border-border-subtle flex items-center justify-center text-text-muted">
              <Compass className="w-6 h-6" />
            </div>
          }
          title="Page not found"
          description="The page you requested could not be found or has been moved."
          action={
            <Link href="/app">
              <Button variant="primary" size="sm" className="text-xs gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Workspace</span>
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
