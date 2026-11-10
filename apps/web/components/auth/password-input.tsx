'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function PasswordInput({
  label = 'Password',
  id = 'password',
  error,
  className = '',
  ...props
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5 text-left">
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
            {label}
          </label>
        </div>
      )}
      <div className="relative">
        <input
          {...props}
          id={id}
          type={show ? 'text' : 'password'}
          className={`w-full bg-canvas-subtle border ${
            error ? 'border-signal-failed' : 'border-border-subtle'
          } text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none rounded-md px-3 py-2.5 pr-10 text-xs font-sans transition-colors ${className}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((prev) => !prev)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 focus:outline-none transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-[11px] text-signal-failed">{error}</p>}
    </div>
  );
}
