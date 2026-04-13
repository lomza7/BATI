'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function StandaloneRedirect() {
  const router = useRouter();

  useEffect(() => {
    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
