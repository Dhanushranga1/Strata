"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Ticket } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user, loading, isOrgMissing, refreshOrganizations } = useOrganization();

  // Redirect to login if not authenticated once loading finishes
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Authenticated but workspace setup not complete yet
  if (isOrgMissing) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <Ticket className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Setting up your workspace&hellip;</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your account is ready. We&apos;re creating your organization &mdash; this takes just a moment.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshOrganizations}
            className="text-sm text-primary hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        userRole={user.role}
        userName={user.email}
        userEmail={user.email}
      />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
