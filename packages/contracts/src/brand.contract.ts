/**
 * Resolved light-theme brand values for places that cannot read CSS variables
 * (email clients). Source of truth is apps/web/app/tokens.css [data-theme="light"];
 * a test in the engine fails if these drift. Change the accent in tokens.css, then here.
 */
export const BRAND_NAME = 'LeadLoom';

export const EMAIL_BRAND = {
  canvas: '#f8fafc',        // --bg-canvas
  surface: '#ffffff',       // --bg-surface
  elevated: '#f1f5f9',      // --bg-elevated
  borderSubtle: '#e2e8f0',  // --border-subtle
  textPrimary: '#0f172a',   // --text-primary
  textSecondary: '#475569', // --text-secondary
  textMuted: '#64748b',     // --text-muted
  accent: '#4f46e5',        // --accent-loom
  onAccent: '#ffffff',      // --on-accent
  accentSoft: '#eae9fc',    // --accent-loom at 12% over --bg-surface (matches --accent-loom-glow)
} as const;
