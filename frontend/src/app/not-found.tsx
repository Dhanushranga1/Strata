import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="text-center space-y-4 p-8">
        <h2 className="text-2xl font-bold text-[rgb(var(--text))]">
          Page not found
        </h2>
        <p className="text-[rgb(var(--muted))] max-w-md">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
