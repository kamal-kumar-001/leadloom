'use client';

import React, { useEffect, useState } from 'react';

/**
 * Approval scene (Approval Key direction, Kamal 2026-11-12): prerendered
 * cinematic loop of the approval queue as a dimensional object - deep-glass
 * slab with the interface on its face, a physically luminous amber Approve
 * key breathing in front of a slowly turning globe of buying signals.
 * Rendered offline frame-by-frame (Three.js + bloom, deterministic time
 * hook) and delivered as a plain muted looping video, so the page ships no
 * runtime WebGL and motion is identically smooth on every device.
 * Reduced motion: the poster frame (a still of the same scene) shows instead.
 */
export function ApprovalScene() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="relative lg:-mx-16 xl:-mx-24">
      <div className="relative [mask-image:radial-gradient(115%_100%_at_50%_45%,black_60%,transparent_100%)]">
        {reduced ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hero/approval-scene-v5-poster.png"
            alt="Illustrative 3D preview of the approval queue: a glass slab with an approval request and a glowing amber Approve send key before a globe of signal points."
            className="h-auto w-full"
          />
        ) : (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/hero/approval-scene-v5-poster.png"
            aria-hidden="true"
            className="h-auto w-full"
          >
            <source src="/hero/approval-scene-v5.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <p className="caption-2 mt-3 text-center text-text-muted">Illustrative 3D preview of the approval queue.</p>
    </div>
  );
}
