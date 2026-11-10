'use client';

import React, { useRef } from 'react';
import { cn } from './utils';

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
  className?: string;
}

export function SpotlightCard({
  children,
  spotlightColor = 'rgba(99, 102, 241, 0.18)',
  className,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    // Update CSS custom properties directly on the DOM node to eliminate React re-renders
    cardRef.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border-muted bg-canvas-surface/80 p-6 backdrop-blur-md transition-all duration-300 hover:border-brand-loom/40 hover:shadow-xl hover:shadow-brand-loom/5',
        className
      )}
      style={
        {
          '--spotlight-color': spotlightColor,
        } as React.CSSProperties
      }
      {...props}
    >
      {/* Zero-re-render radial glow layer */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(450px circle at var(--mouse-x, -500px) var(--mouse-y, -500px), var(--spotlight-color), transparent 80%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
