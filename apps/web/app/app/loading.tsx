import React from 'react';
import { Card } from '@leadloom/ui';

export default function AppLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-6 w-48 bg-canvas-subtle rounded-md" />
        <div className="h-4 w-72 bg-canvas-subtle rounded-md" />
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-canvas-subtle rounded" />
              <div className="w-4 h-4 bg-canvas-subtle rounded-md" />
            </div>
            <div className="h-7 w-16 bg-canvas-subtle rounded" />
            <div className="h-3 w-28 bg-canvas-subtle rounded" />
          </Card>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div className="h-4 w-36 bg-canvas-subtle rounded" />
          <div className="h-7 w-24 bg-canvas-subtle rounded-md" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-10 w-full bg-canvas-subtle/60 rounded-lg" />
          <div className="h-10 w-full bg-canvas-subtle/60 rounded-lg" />
          <div className="h-10 w-full bg-canvas-subtle/60 rounded-lg" />
        </div>
      </Card>
    </div>
  );
}
