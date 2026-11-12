'use client';

import React from 'react';
import { ApprovalSlab } from './approval-slab';

/**
 * Floating-signals hero (Kamal, 2026-11-12 20:46: the globe render is "not
 * good - improve it or change the idea"). Changed idea: the approval queue
 * itself is the hero object, with the buying signals that feed it floating
 * around it as small cards - the float pattern Kamal approved on DMPilot,
 * BakeryPOS and FeeFree. Pure DOM/CSS on shared tokens, so it renders crisp
 * at every size and themes light/dark natively; no video, no WebGL.
 * All motion honors reduced-motion (see marketing.css).
 */

const SIGNALS = [
  { title: 'Funding round', sub: 'Series B · Horizon Logistics', cls: 'float-chip-1' },
  { title: 'Hiring surge', sub: '14 new roles · Northwind', cls: 'float-chip-2' },
  { title: 'Tech integration', sub: 'Kubernetes adopted · Vela', cls: 'float-chip-3' },
  { title: 'Leadership change', sub: 'New VP Sales · Aster', cls: 'float-chip-4' },
];

export function FloatHero() {
  return (
    <div className="float-hero relative">
      <div className="float-hero-glow" aria-hidden="true" />
      {SIGNALS.map((s) => (
        <div key={s.title} className={`float-chip ${s.cls}`} aria-hidden="true">
          <span className="float-chip-dot" />
          <span className="min-w-0">
            <span className="float-chip-title">{s.title}</span>
            <span className="float-chip-sub">{s.sub}</span>
          </span>
        </div>
      ))}
      <ApprovalSlab />
    </div>
  );
}
