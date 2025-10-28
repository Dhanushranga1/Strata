"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity
} from "lucide-react";
import { PageShell } from '@/ui/motion/PageShell'

interface AnalyticsSummary {
  total_tickets: number;
  resolution_rate: number;
  avg_response_hours: number;
}

interface CategoryData {
  by_status: Array<{ name: string; count: number }>;
  by_priority: Array<{ name: string; count: number }>;
}

interface RepPerformance {
  representatives: Array<{
    name: string;
    tickets_handled: number;
    tickets_resolved: number;
    resolution_rate: number;
    avg_response_hours: number;
  }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

// Utility functions for formatting
const formatResponseTime = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  } else if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  } else {
    return `${Math.round(hours / 24)}d`;
  }
};

const formatPercent = (value: number): string => {
  return `${Math.round(value)}%`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString();
};

export default function AdminAnalyticsPage() {
  const router = useRouter();
  
  // Organization context
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [repPerformance, setRepPerformance] = useState<RepPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  // Load analytics when org context is ready
  useEffect(() => {
    if (user && isReady && orgId) {
      loadAnalyticsData();
    }
  }, [user, isReady, orgId]);

  const checkAuthAndLoadData = async () => {
    try {
      console.log('📊 Admin Analytics: Starting authentication check...');
      
      // Use Supabase session instead of localStorage
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      console.log('🔑 Admin Analytics: Token from Supabase session:', token ? 'EXISTS' : 'NOT_FOUND');
      
      if (!token) {
        console.log('❌ Admin Analytics: No session found, redirecting to login');
        router.push('/login');
        return;
      }

      console.log('🌐 Admin Analytics: Making API request to /api/me...');
      const userData = await api.get('/api/me');

      console.log('✅ Admin Analytics: User data received:', { id: userData.id, email: userData.email, role: userData.role });
      setUser(userData);
      
      // Check if user is admin
      if (userData.role !== 'admin') {
        console.log('❌ Admin Analytics: User is not admin, redirecting to dashboard');
        router.push('/dashboard');
        return;
      }
      
      console.log('✅ Admin Analytics: Admin access confirmed');
    } catch (error) {
      console.error('💥 Admin Analytics: Auth check failed:', error);
      setError('Failed to load analytics data');
      router.push('/login');
      return;
    } finally {
      console.log('🏁 Admin Analytics: Authentication check complete');
      setLoading(false);
    }
  };

  const loadAnalyticsData = async () => {
    if (!orgId) return;
    
    try {
      console.log('📊 Admin Analytics: Loading analytics data for org:', orgId);
      
      // Load summary data
      const summaryData = await api.get<AnalyticsSummary>('/api/admin/analytics/summary', orgId);
      setSummary(summaryData);

      // Load category data
      const catData = await api.get<CategoryData>('/api/admin/analytics/by-category', orgId);
      setCategoryData(catData);

      // Load rep performance data
      const repData = await api.get<RepPerformance>('/api/admin/analytics/rep-performance', orgId);
      setRepPerformance(repData);
      
      console.log('✅ Admin Analytics: All analytics data loaded successfully');
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      setError('Failed to load analytics data');
    }
  };

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
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              System performance metrics and insights
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? summary.total_tickets.toLocaleString() : '...'}
              </div>
              <p className="text-xs text-muted-foreground">
                All time tickets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? formatResponseTime(summary.avg_response_hours) : '...'}
              </div>
              <p className="text-xs text-muted-foreground">
                Average first response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? `${summary.resolution_rate}%` : '...'}
              </div>
              <p className="text-xs text-muted-foreground">
                Resolved/closed tickets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">456</div>
              <p className="text-xs text-muted-foreground">
                +5.2% from last week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Detailed Analytics */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Volume Trend</CardTitle>
              <CardDescription>Daily ticket creation over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Chart visualization would go here</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Time Distribution</CardTitle>
              <CardDescription>Breakdown of response times by priority</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Response time chart would go here</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
              <CardDescription>Most common ticket categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Technical Issues</span>
                  <span className="text-sm font-medium">42%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Billing Questions</span>
                  <span className="text-sm font-medium">28%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Feature Requests</span>
                  <span className="text-sm font-medium">18%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">General Inquiries</span>
                  <span className="text-sm font-medium">12%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rep Performance</CardTitle>
              <CardDescription>Support representative efficiency metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Alice Johnson</span>
                  </div>
                  <span className="text-sm font-medium">98% satisfaction</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Bob Smith</span>
                  </div>
                  <span className="text-sm font-medium">95% satisfaction</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Carol Davis</span>
                  </div>
                  <span className="text-sm font-medium">91% satisfaction</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Real-time system status and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">API Status</p>
                  <p className="text-xs text-muted-foreground">All systems operational</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">High connection count</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Storage</p>
                  <p className="text-xs text-muted-foreground">75% capacity used</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}