'use client';

import React from 'react';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export function OtpInput({
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  id = 'otp-code',
}: OtpInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only accept numeric digits, up to 6 characters
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-medium text-text-secondary text-left">
        6-Digit Verification Code
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          disabled={disabled}
          autoFocus={autoFocus}
          value={value}
          onChange={handleChange}
          placeholder="000000"
          className="w-full bg-canvas-subtle border border-border-subtle focus:border-border-focus focus:outline-none rounded-lg px-4 py-3 text-center font-mono text-xl tracking-[0.45em] text-text-primary placeholder:text-text-muted transition-colors disabled:opacity-50"
        />
      </div>
      <p className="text-[11px] text-text-muted text-center">
        Single-use verification code (expires in 10 minutes)
      </p>
    </div>
  );
}
