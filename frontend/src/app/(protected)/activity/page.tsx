'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Clock,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api-client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface ActivityItem {
  id: string;
  type:
    | 'ticket_created'
    | 'ticket_resolved'
    | 'message_sent'
    | 'status_changed';
  ticket_id: string;
  user: string;
  detail: string;
  ts: string;
}

function timeAgo(isoStr: string): string {
  const secs = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  ticket_created: <MessageSquare className="h-4 w-4" />,
  ticket_resolved: <CheckCircle className="h-4 w-4" />,
  message_sent: <ArrowUpRight className="h-4 w-4" />,
  status_changed: <AlertTriangle className="h-4 w-4" />,
};

const TYPE_COLOR: Record<string, string> = {
  ticket_created: 'text-blue-400',
  ticket_resolved: 'text-green-400',
  message_sent: 'text-violet-400',
  status_changed: 'text-amber-400',
};

const TYPE_LABEL: Record<string, string> = {
  ticket_created: 'Created',
  ticket_resolved: 'Resolved',
  message_sent: 'Replied',
  status_changed: 'Updated',
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ticket_created', label: 'Created' },
  { value: 'ticket_resolved', label: 'Resolved' },
  { value: 'message_sent', label: 'Messages' },
] as const;

export default function ActivityPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [error, setError] = useState(false);

  const load = useCallback(
    async (showSpinner = true) => {
      if (!orgId) return;
      if (showSpinner) setLoading(true);
      else setRefreshing(true);
      setError(false);
      try {
        const data = await api.get<ActivityItem[]>(
          '/api/admin/activity?limit=50',
          orgId
        );
        setActivities(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filterType === 'all'
      ? activities
      : activities.filter(a => a.type === filterType);

  // Today / yesterday / older grouping
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const yesterdayStart = todayStart - 86400000;

  const todayCount = activities.filter(
    a => new Date(a.ts).getTime() >= todayStart
  ).length;
  const createdToday = activities.filter(
    a => a.type === 'ticket_created' && new Date(a.ts).getTime() >= todayStart
  ).length;
  const resolvedToday = activities.filter(
    a => a.type === 'ticket_resolved' && new Date(a.ts).getTime() >= todayStart
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">
            Admin access required to view activity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
            <p className="text-muted-foreground">
              Recent ticket events for your organization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => (
            <Button
              key={f.value}
              variant={filterType === f.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilterType(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Activity
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayCount}</div>
            <p className="text-xs text-muted-foreground">
              events since midnight
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tickets Created Today
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{createdToday}</div>
            <p className="text-xs text-muted-foreground">new tickets today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Resolved Today
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedToday}</div>
            <p className="text-xs text-muted-foreground">
              tickets resolved today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Showing {filtered.length} of {activities.length} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No activity yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(activity => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={`p-2 rounded-full bg-muted shrink-0 ${TYPE_COLOR[activity.type] ?? 'text-muted-foreground'}`}
                  >
                    {TYPE_ICON[activity.type] ?? (
                      <Activity className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-medium text-sm truncate">
                        {activity.user}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${TYPE_COLOR[activity.type] ?? ''}`}
                      >
                        {TYPE_LABEL[activity.type] ?? activity.type}
                      </Badge>
                      {activity.detail && (
                        <span className="text-sm text-muted-foreground truncate max-w-[280px]">
                          {activity.detail}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{timeAgo(activity.ts)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
