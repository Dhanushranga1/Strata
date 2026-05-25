'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Ticket } from 'lucide-react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/Sidebar';
import { useOrganization } from '@/contexts/OrganizationContext';

function OrgMissingScreen({
  refreshOrganizations,
}: {
  refreshOrganizations: () => Promise<void>;
}) {
  useEffect(() => {
    const id = setInterval(refreshOrganizations, 3000);
    return () => clearInterval(id);
  }, [refreshOrganizations]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 bg-background">
      <div className="relative">
        {/* Spinning gradient ring */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 animate-[spin_3s_linear_infinite] opacity-60 blur-[1px]" />
        <div className="relative w-12 h-12 bg-primary rounded-xl flex items-center justify-center z-10">
          <Ticket className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="text-center max-w-xs px-4">
        <h2 className="text-lg font-semibold">
          Creating your workspace&hellip;
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Your account is ready. Hang tight while we set up your organisation.
        </p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 bg-primary rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const {
    user,
    currentOrganization,
    loading,
    isOrgMissing,
    refreshOrganizations,
  } = useOrganization();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Redirect to login if not authenticated once loading finishes
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-5 bg-background">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Ticket className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">TicketPilot</span>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 bg-primary rounded-full"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (isOrgMissing) {
    return <OrgMissingScreen refreshOrganizations={refreshOrganizations} />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        userRole={user.role}
        orgRole={currentOrganization?.your_role}
        userName={user.email}
        userEmail={user.email}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Right-side content column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar — hidden on md+ */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <Ticket className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">
              TicketPilot
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
