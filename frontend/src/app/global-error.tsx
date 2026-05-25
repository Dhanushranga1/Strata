'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-center space-y-4 p-8">
            <h2 className="text-2xl font-bold text-white">Critical error</h2>
            <p className="text-gray-400 max-w-md">
              The application encountered a critical error. Please reload.
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:opacity-90 transition-opacity"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
