'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Accessible offline notification banner.
 * Monitors browser online/offline events and displays a polite status message when disconnected.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  });

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="w-full bg-signal-catchall/15 border-b border-signal-catchall/30 px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium text-signal-catchall z-50 select-none animate-fade-in"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>You are currently offline. Changes will not sync until connection is restored.</span>
    </aside>
  );
}
