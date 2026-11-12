'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

/**
 * Approval slab (Approval Key direction, Kamal 2026-11-12): the hero object is
 * the approval queue itself - an obsidian glass card with the glowing amber
 * Approve key. The card tilts toward the pointer on soft springs; the key
 * breathes with a slow amber glow and an occasional light sweep. All motion
 * disappears under reduced-motion. Content is an illustrative preview of the
 * approval flow (fixture person and company), labelled as such.
 */
export function ApprovalSlab() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 60, damping: 18, mass: 0.9 });
  const sry = useSpring(ry, { stiffness: 60, damping: 18, mass: 0.9 });

  const onMove = (e: React.PointerEvent) => {
    if (reduceMotion || !ref.current || e.pointerType === 'touch') return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 7);
    rx.set(py * -6);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <div className="slab-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        ref={ref}
        className="slab-card"
        style={reduceMotion ? undefined : { rotateX: srx, rotateY: sry, transformPerspective: 1400 }}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="title-4 text-text-primary">Approval queue</span>
            <span className="caption-4 rounded-full border border-border-muted px-2 py-0.5 text-text-muted">
              Illustrative preview
            </span>
          </div>
          <span className="caption-4 text-text-muted">1 of 3</span>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-weave text-caption-3 text-text-primary">
              JD
            </span>
            <div>
              <p className="body-5 text-text-primary">Jordan Doe</p>
              <p className="caption-4 text-text-muted">VP of Operations - horizon.example.com</p>
            </div>
          </div>
          <div>
            <p className="caption-4 text-text-muted">Subject</p>
            <p className="body-5 text-text-primary">A faster way to scale your outbound</p>
          </div>
          <p className="body-6 text-text-secondary">
            Hi Jordan - noticed Horizon is expanding into new markets. We put together a short
            note on how teams keep outreach personal while volumes grow. Open to a quick
            15-minute chat next week?
          </p>
        </div>

        <div className="flex items-center gap-3 border-t border-border-subtle px-5 py-4">
          <button
            type="button"
            className="button-sm rounded-lg border border-border-muted px-4 py-2 text-text-secondary transition-colors hover:text-text-primary"
          >
            Edit
          </button>
          <button type="button" className="approve-key button-sm flex-1 rounded-xl px-4 py-2.5 font-semibold">
            Approve send
          </button>
        </div>

        <p className="caption-4 flex items-center gap-1.5 px-5 pb-4 text-text-muted">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Human approval required before anything sends
        </p>
      </motion.div>
    </div>
  );
}
