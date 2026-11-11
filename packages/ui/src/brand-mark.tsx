'use client';

import React, { useId } from 'react';
import { cn } from './utils';

/**
 * LeadLoom brand mark. Strokes use theme tokens (accent loom/weave/matrix),
 * so the mark keeps contrast on both light and dark surfaces. It has no
 * fixed background tile of its own; wrap it in a tinted container if wanted.
 */
export function BrandMark({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent-loom)" />
          <stop offset="0.5" stopColor="var(--accent-weave)" />
          <stop offset="1" stopColor="var(--accent-matrix)" />
        </linearGradient>
      </defs>
      <rect
        x="26"
        y="8"
        width="12"
        height="48"
        rx="6"
        stroke={`url(#${gradientId})`}
        strokeWidth="5"
      />
      <path
        d="M12 22 C 26 31, 38 35, 52 44"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M12 44 C 26 35, 38 31, 52 22"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
