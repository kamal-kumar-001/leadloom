import React, { useId } from 'react';
import { cn } from './utils';
import { Button, type ButtonProps } from './button';

/**
 * Presentation of a feature state. The SERVER decides (EntitlementDecision from the engine);
 * this only renders it. A lock here is never enforcement: the engine must also refuse the call.
 *  - available: normal.
 *  - locked: exists but the plan or billing does not allow it. Shows a lock and a reason.
 *  - unavailable: not built yet. Different look and wording, no lock, no upgrade hint.
 */
export type GateState =
  | { kind: 'available' }
  | { kind: 'locked'; reason: string }
  | { kind: 'unavailable'; reason?: string };

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cn('w-3.5 h-3.5 shrink-0', className)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Small chip: lock plus short reason. */
export function LockBadge({ reason, className }: { reason: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border border-border-muted bg-canvas-elevated px-2 py-0.5 text-[10px] font-medium text-text-muted', className)}>
      <LockIcon className="w-3 h-3" />
      {reason}
    </span>
  );
}

export interface GatedButtonProps extends Omit<ButtonProps, 'disabled'> {
  gate: GateState;
  /** Optional: called when a locked button is activated (for example to explain). Never grants access. */
  onLockedClick?: () => void;
}

/** Button that reflects a gate. Locked and unavailable buttons stay focusable and explain themselves. */
export function GatedButton({ gate, onLockedClick, children, onClick, className, variant, ...props }: GatedButtonProps) {
  const descId = useId();
  if (gate.kind === 'available') {
    return (
      <Button variant={variant} className={className} onClick={onClick} {...props}>
        {children}
      </Button>
    );
  }
  const locked = gate.kind === 'locked';
  const reason = gate.reason || (locked ? 'Not included in your plan' : 'Not available yet');
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        {...props}
        variant="secondary"
        aria-disabled="true"
        aria-describedby={descId}
        className={cn('opacity-70 cursor-not-allowed', className)}
        onClick={(e) => {
          e.preventDefault();
          if (locked) onLockedClick?.();
        }}
      >
        {locked ? <LockIcon /> : null}
        {children}
      </Button>
      <span id={descId} className="text-[10px] text-text-muted">{reason}</span>
    </span>
  );
}
