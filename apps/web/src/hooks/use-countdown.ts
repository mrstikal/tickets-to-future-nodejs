'use client';

import { useEffect, useMemo, useState } from 'react';

export function useCountdown(expiresAt?: string): number {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setNow(null);
      return;
    }

    setNow(Date.now());

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [expiresAt]);

  return useMemo(() => {
    if (!expiresAt || now === null) {
      return 0;
    }

    const expiresAtMs = new Date(expiresAt).getTime();
    const diffMs = Math.max(expiresAtMs - now, 0);

    return Math.ceil(diffMs / 1000);
  }, [expiresAt, now]);
}