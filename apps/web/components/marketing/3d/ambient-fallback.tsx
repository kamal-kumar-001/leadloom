import React from 'react';

export function AmbientLoomFallback() {
  return (
    <div className="relative w-full h-[340px] sm:h-[440px] lg:h-[520px] flex items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-canvas-surface/40">
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18)_0%,transparent_70%)] pointer-events-none" />
      
      {/* CSS/SVG kinetic wireframe preview */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-4 text-center">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-brand-loom/30 animate-ping opacity-25" />
          <div className="w-24 h-24 rounded-full border border-brand-loom/60 bg-brand-loom/10 flex items-center justify-center shadow-lg shadow-brand-loom/20">
            <span className="text-2xl select-none">🧵</span>
          </div>
        </div>
        <p className="text-xs font-mono text-text-muted">
          Living Loom Core (WebGL Ambient Fallback)
        </p>
      </div>
    </div>
  );
}
