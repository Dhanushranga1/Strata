'use client';

import AuthGate from '@/components/AuthGate';

export default function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">{children}</div>
    </AuthGate>
  );
}
