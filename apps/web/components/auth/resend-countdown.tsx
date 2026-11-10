'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export interface ResendCountdownProps {
  onResend: () => Promise<boolean | void>;
  cooldownSeconds?: number;
  disabled?: boolean;
}

export function ResendCountdown({
  onResend,
  cooldownSeconds = 60,
  disabled = false,
}: ResendCountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(cooldownSeconds);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const handleResend = async () => {
    if (secondsRemaining > 0 || isResending || disabled) return;
    setIsResending(true);
    try {
      const ok = await onResend();
      if (ok !== false) {
        setSecondsRemaining(cooldownSeconds);
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="text-center text-xs text-text-secondary">
      {secondsRemaining > 0 ? (
        <span className="text-text-muted inline-flex items-center gap-1.5">
          <span>Resend code in</span>
          <span className="font-mono text-text-secondary font-medium">{secondsRemaining}s</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending || disabled}
          className="text-brand-loom hover:underline font-medium inline-flex items-center gap-1 focus:outline-none disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
          <span>{isResending ? 'Sending new code...' : 'Resend verification code'}</span>
        </button>
      )}
    </div>
  );
}
