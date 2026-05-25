'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="text-center space-y-4 p-8">
        <h2 className="text-2xl font-bold text-[rgb(var(--text))]">
          Something went wrong
        </h2>
        <p className="text-[rgb(var(--muted))] max-w-md">
          An unexpected error occurred. Our team has been notified.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
