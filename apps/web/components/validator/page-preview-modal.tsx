'use client';

import React from 'react';
import { Badge } from '@leadloom/ui';
import { X } from 'lucide-react';

export interface OwnerPagePreview {
  slug: string;
  status: string;
  title: string;
  headline: string;
  subheadline: string;
  heroCtaText: string;
  surveyQuestions: { id: string; text: string; type: string; options?: string[] }[];
}

/**
 * Owner-only preview of the exact copy a smoke-test page will show once
 * published. Rendered from the authenticated owner route (any status); the
 * public route stays 404 until publish. Not counted as a page load.
 */
export function PagePreviewModal({ page, onClose }: { page: OwnerPagePreview; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border-muted bg-canvas p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted">/v/{page.slug}</span>
            <Badge variant={page.status === 'published' ? 'verified' : 'subtle'} className="text-[10px] font-mono">
              {page.status === 'published' ? 'Published' : 'Draft - only you can see this'}
            </Badge>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-canvas-elevated">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Exact public copy, in the same order the public page shows it */}
        <div className="text-center px-2">
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary leading-[1.15]">
            {page.headline}
          </h3>
          <p className="mt-4 text-sm sm:text-base text-text-secondary leading-relaxed max-w-lg mx-auto">
            {page.subheadline}
          </p>
          <div className="mt-6 max-w-md mx-auto flex flex-col sm:flex-row gap-3">
            <div className="flex-1 rounded-md border border-border-muted bg-canvas-elevated px-4 py-3 text-sm text-text-muted text-left">
              Enter your work email...
            </div>
            <div className="rounded-md bg-brand-loom px-6 py-3 text-sm font-semibold text-canvas">
              {page.heroCtaText}
            </div>
          </div>
        </div>

        {page.surveyQuestions.length > 0 && (
          <div className="mt-6 rounded-xl border border-border-subtle bg-canvas-surface p-4">
            <div className="text-[10px] uppercase font-mono text-text-muted mb-2">
              Questions shown after the email step ({page.surveyQuestions.length})
            </div>
            <ol className="space-y-1.5 text-xs text-text-secondary list-decimal list-inside">
              {page.surveyQuestions.map((q) => (
                <li key={q.id}>
                  {q.text}
                  {q.type === 'choice' && q.options ? (
                    <span className="text-text-muted"> ({q.options.join(' / ')})</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
