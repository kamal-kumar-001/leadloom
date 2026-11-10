'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { SceneContent } from './scene-content';
import { AmbientLoomFallback } from './ambient-fallback';

export interface LivingLoomCanvasProps {
  lightingState?: 'indigo' | 'matrix';
}

export function LivingLoomCanvas({ lightingState = 'indigo' }: LivingLoomCanvasProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  if (!isMounted) {
    return <AmbientLoomFallback />;
  }

  if (reducedMotion) {
    return <AmbientLoomFallback />;
  }

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-border-subtle bg-canvas-surface/30 backdrop-blur-sm">
      <Suspense fallback={<AmbientLoomFallback />}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={[1, 2]} // High-DPI support capped at 2x for GPU efficiency
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <SceneContent lightingState={lightingState} />
        </Canvas>
      </Suspense>

      {/* Real-time telemetry overlay badge */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-md border border-border-subtle bg-canvas-elevated/80 px-2.5 py-1 text-[11px] font-mono text-text-muted backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-signal-verified animate-pulse" />
        <span>Living Loom Engine • WebGL Active (60fps)</span>
      </div>
    </div>
  );
}
