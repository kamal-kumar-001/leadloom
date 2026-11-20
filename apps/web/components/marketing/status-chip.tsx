import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';

/**
 * Honest status chip shared by the nav mega menus and the feature grid.
 * "Live" means verified working runtime behavior in production today;
 * "Key storage" means the vault stores that provider's key today while
 * live runs are not yet available; "Coming soon" means still being built.
 * Never shown on anything whose status is unverified.
 */
export function StatusChip({ status }: { status: 'live' | 'keys' | 'soon' }) {
  if (status === 'keys') {
    return (
      <span
        className="caption-3 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5"
        style={{ color: 'var(--signal-verified-strong)' }}
      >
        <CheckCircle className="h-3 w-3" />
        Key storage
      </span>
    );
  }
  // color drives both text and border (currentColor); strong tone keeps the
  // 12px label at AA contrast (>= 4.5:1) on light surfaces.
  return status === 'live' ? (
    <span
      className="caption-3 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5"
      style={{ color: 'var(--signal-verified-strong)' }}
    >
      <CheckCircle className="h-3 w-3" />
      Live
    </span>
  ) : (
    <span className="caption-3 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-canvas-elevated px-2 py-0.5 text-text-muted">
      <Clock className="h-3 w-3" />
      Coming soon
    </span>
  );
}
