"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  BarChart3,
  Settings,
  Shield,
  AlertTriangle,
  TrendingUp,
  Activity,
  Building2,
  Ticket,
  ScrollText,
} from "lucide-react";
import { PageShell } from '@/ui/motion/PageShell';
import { SystemHealthDashboard } from '@/components/admin/SystemHealthDashboard';

interface AdminStats {
  totalUsers: number;
  pendingRoleRequests: number;
  totalTickets: number;
  activeReps: number;
}

interface AdminAnalytics {
  total_tickets: number;
  resolution_rate: number;
  avg_response_hours: number;
}

interface UserItem {
  user_id: string;
  email: string;
  role: string;
  role_updated_at: string;
}

interface RoleRequest {
  id: string;
  user_id: string;
  email: string;
  reason: string;
  status: string;
  created_at: string;
  decided_at?: string;
}

export default function AdminPage() {
  const router = useRouter();
  
  // Organization context
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;
  
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    pendingRoleRequests: 0,
    totalTickets: 0,
    activeReps: 0
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAdminStats = async () => {
    if (!orgId) return;
    setStatsLoading(true);
    setError(null);

    try {
      const [analytics, users, roleRequests] = await Promise.all([
        api.get<AdminAnalytics>('/api/admin/analytics/summary', orgId),
        api.get<UserItem[]>('/api/admin/users', orgId),
        api.get<RoleRequest[]>('/api/admin/role-requests', orgId)
      ]);

      const activeReps = users.filter((u: UserItem) => u.role === 'rep').length;
      const pendingRequests = roleRequests.filter((r: RoleRequest) => r.status === 'pending').length;

      setStats({
        totalUsers: users.length,
        activeReps,
        pendingRoleRequests: pendingRequests,
        totalTickets: analytics.total_tickets || 0
      });
    } catch (error) {
      setError(`Failed to load statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          router.push('/login');
          return;
        }

        const userData = await api.get('/api/me');
        setUser(userData);

        if (userData.role !== 'admin') {
          router.push('/dashboard');
          return;
        }
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user && isReady && orgId) {
      loadAdminStats();
    }
  }, [user, isReady, orgId]);

  const adminSections = [
    {
      title: "Organisations",
      description: "Create orgs, assign reps, manage members",
      icon: Building2,
      href: "/admin/organizations",
      color: "bg-emerald-500",
      stats: "Manage all orgs"
    },
    {
      title: "Team Members",
      description: "Manage members, roles, and invites",
      icon: UserCheck,
      href: "/admin/users",
      color: "bg-indigo-500",
      stats: `${stats.totalUsers} members`
    },
    {
      title: "User Roles",
      description: "Manage user roles and permissions",
      icon: Users,
      href: "/admin/roles",
      color: "bg-blue-500",
      stats: `${stats.totalUsers} users`
    },
    {
      title: "Analytics",
      description: "System analytics and reports",
      icon: BarChart3,
      href: "/admin/analytics",
      color: "bg-green-500",
      stats: `${stats.totalTickets} tickets`
    },
    {
      title: "All Tickets",
      description: "Cross-org ticket view with filtering",
      icon: Ticket,
      href: "/admin/tickets",
      color: "bg-orange-500",
      stats: `${stats.totalTickets} total`
    },
    {
      title: "Audit Log",
      description: "Platform-wide action history",
      icon: ScrollText,
      href: "/admin/audit-log",
      color: "bg-slate-500",
      stats: "View log"
    },
    {
      title: "System Settings",
      description: "Configure system-wide settings",
      icon: Settings,
      href: "/admin/settings",
      color: "bg-purple-500",
      stats: "Configure"
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-muted-foreground">
              System administration and management tools
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
              <Button 
                onClick={loadAdminStats} 
                className="mt-2" 
                size="sm"
                disabled={statsLoading}
              >
                Retry Loading Stats
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? (
                  <div className="h-8 w-12 bg-muted animate-pulse rounded"></div>
                ) : (
                  stats.totalUsers
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Registered in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? (
                  <div className="h-8 w-12 bg-muted animate-pulse rounded"></div>
                ) : (
                  stats.pendingRoleRequests
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Role upgrade requests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? (
                  <div className="h-8 w-12 bg-muted animate-pulse rounded"></div>
                ) : (
                  stats.totalTickets
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                All time tickets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Reps</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeReps}</div>
              <p className="text-xs text-muted-foreground">
                Support representatives
              </p>
            </CardContent>
          </Card>
        </div>

        {/* System Health Dashboard - Phase 3: SI-3 */}
        <SystemHealthDashboard />

        {/* Admin Sections */}
        <div className="grid gap-6 md:grid-cols-2">
          {adminSections.map((section) => (
            <Card key={section.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${section.color}`}>
                    <section.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {section.title}
                    </CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {section.stats}
                  </span>
                  <Link href={section.href}>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {stats.pendingRoleRequests > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <UserCheck className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {stats.pendingRoleRequests} pending role request{stats.pendingRoleRequests !== 1 ? 's' : ''} need review
                  </span>
                </div>
                <Link href="/admin/roles">
                  <Button variant="outline" size="sm">Review</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}