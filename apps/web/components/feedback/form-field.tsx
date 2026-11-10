'use client';

import React from 'react';

export interface FormFieldProps {
  id: string;
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children:
    | React.ReactNode
    | ((props: {
        id: string;
        'aria-describedby'?: string;
        'aria-invalid'?: boolean;
      }) => React.ReactNode);
}

/**
 * Accessible form field wrapper providing label, helper hint, inline validation error,
 * and automatic aria-describedby + aria-invalid wiring.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className = 'space-y-1.5 text-left',
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  let renderedChild: React.ReactNode;

  if (typeof children === 'function') {
    renderedChild = children({
      id,
      'aria-describedby': describedBy,
      'aria-invalid': Boolean(error),
    });
  } else if (React.isValidElement(children)) {
    const childProps = children.props as Record<string, unknown>;
    renderedChild = React.cloneElement(children, {
      id: childProps.id ?? id,
      'aria-describedby': childProps['aria-describedby'] ?? describedBy,
      'aria-invalid': childProps['aria-invalid'] ?? Boolean(error),
    } as React.Attributes);
  } else {
    renderedChild = children;
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
          {label}
          {required && <span className="text-signal-failed ml-0.5">*</span>}
        </label>
      )}

      {renderedChild}

      {hint && !error && (
        <p id={hintId} className="text-[11px] text-text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" aria-live="polite" aria-atomic="true" className="text-[11px] text-signal-failed font-medium motion-reduce:animate-none">
          {error}
        </p>
      )}
    </div>
  );
}
