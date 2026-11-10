'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from '@leadloom/ui';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible confirmation modal conforming to WAI-ARIA Alertdialog pattern.
 * Traps Tab focus inside the modal, dismisses on Escape, and restores focus to trigger element.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Preserve and restore focus on open/close
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      // Focus the cancel action by default for safety on destructive dialogs
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      if (typeof triggerRef.current.focus === 'function' && document.contains(triggerRef.current)) {
        triggerRef.current.focus();
      }
      triggerRef.current = null;
    }
  }, [isOpen]);

  // Keyboard navigation: Escape to cancel, Tab to trap focus
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-xs font-sans motion-reduce:transition-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="bg-canvas-surface border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl relative motion-reduce:animate-none motion-reduce:transition-none"
      >
        <div className="flex items-start gap-3.5">
          {variant === 'danger' && (
            <div className="w-10 h-10 rounded-xl bg-signal-failed/15 border border-signal-failed/30 flex items-center justify-center text-signal-failed shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-text-primary tracking-tight"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-description"
              className="mt-1.5 text-xs text-text-muted leading-relaxed"
            >
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button
            ref={cancelBtnRef}
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="text-xs focus-visible:ring-2 focus-visible:ring-brand-loom focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
          >
            {cancelLabel}
          </Button>

          {variant === 'danger' ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-medium rounded-md bg-signal-failed text-text-onAccent hover:opacity-90 transition-opacity disabled:opacity-50 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-failed focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onConfirm}
              disabled={isLoading}
              className="text-xs focus-visible:ring-2 focus-visible:ring-brand-loom focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
