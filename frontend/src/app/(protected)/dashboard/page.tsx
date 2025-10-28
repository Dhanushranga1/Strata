'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useOrganization } from '@/contexts/OrganizationContext'
import api from '@/lib/api-client'
import { BentoGrid, BentoGridItem } from '@/components/ui/BentoGrid'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FieldError } from '@/components/FieldError'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { 
  TicketIcon, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  MessageSquare,
  BarChart3,
  User,
  ArrowUpRight,
  Activity,
  Zap,
  Settings
} from 'lucide-react'
import { PageShell } from '@/ui/motion/PageShell'

type Me = { id: string; email?: string; role?: string }

interface DashboardStats {
  tickets: {
    total: number
    open: number
    pending: number
    resolved: number
    urgent: number
  }
  performance: {
    avgResponseTime: string
    satisfaction: number
    resolution_rate: number
  }
  activity: {
    today: number
    thisWeek: number
    trend: 'up' | 'down' | 'stable'
  }
}

interface AdminAnalytics {
  total_tickets: number;
  resolution_rate: number;
  avg_response_hours: number;
}

interface RepCounts {
  needs_attention: number;
  open_active: number;
  escalated: number;
  closed_recent: number;
}

interface TicketItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface TicketsResponse {
  items: TicketItem[];
  total: number;
  offset: number;
  limit: number;
}

export default function DashboardPage() {
  console.log('📊 Dashboard: Component initialized');
  const router = useRouter()
  const { currentOrganization, isReady, switchingOrg } = useOrganization()
  const orgId = currentOrganization?.id
  const [me, setMe] = useState<Me | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboardStats = async (userRole: string, orgId: string) => {
    console.log('📊 Dashboard: Loading stats for role:', userRole);
    
    try {
      if (userRole === 'admin') {
        console.log('👑 Dashboard: Loading admin analytics...');
        const [analytics, categorystats] = await Promise.all([
          api.get<AdminAnalytics>('/api/admin/analytics/summary', orgId),
          api.get<any>('/api/admin/analytics/by-category', orgId).catch(() => ({ status_counts: [], priority_counts: [] }))
        ]);
        
        console.log('📈 Dashboard: Admin analytics received:', analytics);
        
        const statusCounts = categorystats.status_counts || [];
        const openCount = statusCounts.find((s: any) => s.status === 'open')?.count || 0;
        const resolvedCount = statusCounts.find((s: any) => s.status === 'resolved')?.count || 0;
        const urgentCount = statusCounts.find((s: any) => s.priority === 'urgent')?.count || 0;
        
        return {
          tickets: {
            total: analytics.total_tickets || 0,
            open: openCount,
            pending: statusCounts.find((s: any) => s.status === 'pending')?.count || 0,
            resolved: resolvedCount,
            urgent: urgentCount
          },
          performance: {
            avgResponseTime: `${analytics.avg_response_hours || 0}h`,
            satisfaction: analytics.resolution_rate || 0,
            resolution_rate: analytics.resolution_rate || 0
          },
          activity: {
            today: statusCounts.reduce((sum: number, s: any) => sum + s.count, 0),
            thisWeek: analytics.total_tickets || 0,
            trend: 'up' as const
          }
        };
        
      } else if (userRole === 'rep') {
        console.log('👨‍💼 Dashboard: Loading rep counts...');
        const counts = await api.get<RepCounts>('/api/rep/counts', orgId);
        console.log('📋 Dashboard: Rep counts received:', counts);
        
        return {
          tickets: {
            total: counts.needs_attention + counts.open_active + counts.escalated,
            open: counts.open_active || 0,
            pending: counts.needs_attention || 0,
            resolved: counts.closed_recent || 0,
            urgent: counts.escalated || 0
          },
          performance: {
            avgResponseTime: 'N/A',
            satisfaction: 0,
            resolution_rate: 0
          },
          activity: {
            today: counts.needs_attention || 0,
            thisWeek: counts.open_active || 0,
            trend: 'stable' as const
          }
        };
        
      } else {
        // Customer: get their own tickets
        console.log('👤 Dashboard: Loading customer tickets...');
        const myTickets = await api.get<TicketsResponse>('/api/tickets?mine=true&status=all&limit=100', orgId);
        console.log('🎫 Dashboard: Customer tickets received:', myTickets.total, 'tickets');
        
        const tickets = myTickets.items || [];
        const openCount = tickets.filter((t: TicketItem) => t.status === 'open').length;
        const pendingCount = tickets.filter((t: TicketItem) => t.status === 'pending').length;
        const resolvedCount = tickets.filter((t: TicketItem) => ['resolved', 'closed'].includes(t.status)).length;
        const urgentCount = tickets.filter((t: TicketItem) => t.priority === 'urgent').length;
        
        return {
          tickets: {
            total: myTickets.total || 0,
            open: openCount,
            pending: pendingCount,
            resolved: resolvedCount,
            urgent: urgentCount
          },
          performance: {
            avgResponseTime: 'N/A',
            satisfaction: 0,
            resolution_rate: resolvedCount > 0 ? Math.round((resolvedCount / myTickets.total) * 100) : 0
          },
          activity: {
            today: openCount + pendingCount,
            thisWeek: myTickets.total || 0,
            trend: 'stable' as const
          }
        };
      }
    } catch (error) {
      console.error('💥 Dashboard: Stats loading failed:', error);
      throw error;
    }
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!isReady || !orgId) {
        console.log('⏳ Dashboard: Waiting for org context...');
        setLoading(true);
        return;
      }

      console.log('📊 Dashboard: Starting data load...');
      try {
        setLoading(true)
        
        // Load user info
        console.log('👤 Dashboard: Fetching user info...');
        const userInfo = await api.get<Me>('/api/me')
        console.log('✅ Dashboard: User info received:', { id: userInfo.id, email: userInfo.email, role: userInfo.role });
        setMe(userInfo)
        
        // Load role-appropriate dashboard stats
        console.log('📊 Dashboard: Loading role-based stats...');
        const dashboardStats = await loadDashboardStats(userInfo.role || 'customer', orgId);
        setStats(dashboardStats);
        console.log('✅ Dashboard: Stats loaded successfully:', dashboardStats);
        console.log('✅ Dashboard: Data load complete');
        
      } catch (e: unknown) { 
        const error = e as Error
        console.error('💥 Dashboard: Data load failed:', error.message);
        setError(error.message) 
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [isReady, orgId])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const getStatusColor = (status: string): "open" | "in_progress" | "resolved" | "closed" | "escalated" => {
    switch (status.toLowerCase()) {
      case 'open': return 'open'
      case 'pending': return 'in_progress'
      case 'resolved': return 'resolved'
      case 'closed': return 'closed'
      case 'urgent': return 'escalated'
      default: return 'closed'
    }
  }

  return (
    <PageShell>
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Header Section - Mobile Optimized */}
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {getGreeting()}{me?.email ? `, ${me.email.split('@')[0]}` : ''}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Here&apos;s what&apos;s happening with your tickets today.
              </p>
            </div>
              
            {me && (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{me.email ?? me.id}</p>
                      <Badge variant="secondary" className="text-xs">
                        {me.role}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

            {error && <FieldError id="dashboard-error">{error}</FieldError>}

            {/* Show skeleton when switching orgs or initial load */}
            {(loading || switchingOrg) ? (
              <DashboardSkeleton />
            ) : stats && stats.tickets.total === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <h1 className="text-4xl font-bold mb-4">Welcome to TicketPilot! 🎉</h1>
                <p className="text-xl text-muted-foreground mb-8">
                  Let&apos;s get you started with AI-powered support
                </p>
                <Button size="lg" onClick={() => router.push('/tickets')}>
                  Create Your First Ticket
                  <ArrowUpRight className="ml-2 w-5 h-5" />
                </Button>
              </motion.div>
            ) : stats ? (
              <BentoGrid>
                {/* Tickets Overview */}
                <BentoGridItem
                  title="Total Tickets"
                  description="All tickets in the system"
                  icon={<TicketIcon className="h-5 w-5" />}
                  size="sm"
                  badge={stats.tickets.total.toString()}
                  badgeVariant="secondary"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Open</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status="open" />
                        <Badge variant="secondary">{stats.tickets.open}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pending</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status="in_progress" />
                        <Badge variant="secondary">{stats.tickets.pending}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Resolved</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status="resolved" />
                        <Badge variant="secondary">{stats.tickets.resolved}</Badge>
                      </div>
                    </div>
                  </div>
                </BentoGridItem>

                {/* Urgent Tickets */}
                <BentoGridItem
                  title="Urgent Tickets"
                  description="Requires immediate attention"
                  icon={<AlertTriangle className="h-5 w-5" />}
                  size="sm"
                  badge={stats.tickets.urgent.toString()}
                  badgeVariant="destructive"
                  interactive
                  onClick={() => router.push('/tickets?filter=urgent')}
                >
                  <div className="flex items-center gap-2 text-2xl font-bold text-destructive">
                    <Zap className="h-6 w-6" />
                    {stats.tickets.urgent}
                  </div>
                </BentoGridItem>

                {/* Performance Metrics */}
                <BentoGridItem
                  title="Performance"
                  description="Key performance indicators"
                  icon={<TrendingUp className="h-5 w-5" />}
                  size="lg"
                >
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {stats.performance.avgResponseTime}
                      </div>
                      <div className="text-xs text-muted-foreground">Avg Response</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {stats.performance.satisfaction}★
                      </div>
                      <div className="text-xs text-muted-foreground">Satisfaction</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {stats.performance.resolution_rate}%
                      </div>
                      <div className="text-xs text-muted-foreground">Resolution Rate</div>
                    </div>
                  </div>
                </BentoGridItem>

                {/* Activity Today */}
                <BentoGridItem
                  title="Today's Activity"
                  description="Tickets handled today"
                  icon={<Activity className="h-5 w-5" />}
                  size="sm"
                  badge={stats.activity.trend === 'up' ? '↗️' : stats.activity.trend === 'down' ? '↘️' : '→'}
                >
                  <div className="space-y-2">
                    <div className="text-3xl font-bold">{stats.activity.today}</div>
                    <div className="text-sm text-muted-foreground">
                      {stats.activity.thisWeek} this week
                    </div>
                  </div>
                </BentoGridItem>

                {/* Quick Actions */}
                <BentoGridItem
                  title="Quick Actions"
                  description="Common tasks and workflows"
                  icon={<Zap className="h-5 w-5" />}
                  size="md"
                >
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => router.push('/tickets')}
                    >
                      <TicketIcon className="h-4 w-4 mr-2" />
                      View All Tickets
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => router.push('/rep')}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Rep Console
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => router.push('/analytics')}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </Button>
                    {me?.role === 'admin' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => router.push('/admin')}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Admin Panel
                      </Button>
                    )}
                  </div>
                </BentoGridItem>

                {/* Recent Activity */}
                <BentoGridItem
                  title="Recent Activity"
                  description="Latest ticket updates"
                  icon={<Clock className="h-5 w-5" />}
                  size="lg"
                >
                  <div className="space-y-3">
                    {[
                      { id: '#1234', action: 'Ticket resolved', time: '2 minutes ago', status: 'resolved' },
                      { id: '#1235', action: 'New ticket created', time: '15 minutes ago', status: 'open' },
                      { id: '#1236', action: 'Response sent', time: '1 hour ago', status: 'pending' },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={getStatusColor(item.status)} />
                          <div>
                            <p className="text-sm font-medium">{item.id}</p>
                            <p className="text-xs text-muted-foreground">{item.action}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{item.time}</div>
                      </div>
                    ))}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full"
                      onClick={() => router.push('/activity')}
                    >
                      View All Activity
                      <ArrowUpRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </BentoGridItem>
              </BentoGrid>
            ) : null}
          </div>
        </main>
      </PageShell>
    )
  }