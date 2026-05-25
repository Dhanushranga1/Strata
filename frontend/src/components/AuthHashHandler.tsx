'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Detects Supabase auth tokens in the URL hash (e.g. after password reset or magic link)
// and forwards them to /auth/callback which knows how to process them.
export function AuthHashHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname === '/auth/callback') return;

    const hash = window.location.hash.substring(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const error = params.get('error');

    if (accessToken || error) {
      router.replace(`/auth/callback#${hash}`);
    }
  }, [pathname, router]);

  return null;
}
