'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session check error:', error);
          if (active) router.replace('/login');
          return;
        }

        const session = data.session;
        if (!session && active) {
          router.replace('/login');
        } else if (active) {
          setReady(true);
        }
      } catch (err) {
        console.error('Unexpected auth error:', err);
        if (active) router.replace('/login');
      } finally {
        if (active) setLoading(false);
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, !!session);

      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login');
      } else if (event === 'SIGNED_IN' && session) {
        setReady(true);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ready) return null;
  return <>{children}</>;
}
