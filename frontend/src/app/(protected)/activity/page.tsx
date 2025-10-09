"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Clock,
  User,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Filter
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: 'ticket_created' | 'ticket_resolved' | 'message_sent' | 'status_changed';
  ticketId: string;
  user: string;
  action: string;
  timestamp: string;
  status?: string;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: '1',
      type: 'ticket_created',
      ticketId: '#1234',
      user: 'john@example.com',
      action: 'created a new ticket',
      timestamp: '2 minutes ago',
    },
    {
      id: '2',
      type: 'ticket_resolved',
      ticketId: '#1232',
      user: 'sarah@company.com',
      action: 'resolved ticket',
      timestamp: '15 minutes ago',
      status: 'resolved'
    },
    {
      id: '3',
      type: 'message_sent',
      ticketId: '#1231',
      user: 'rep@company.com',
      action: 'sent a response',
      timestamp: '32 minutes ago',
    },
    {
      id: '4',
      type: 'status_changed',
      ticketId: '#1230',
      user: 'admin@company.com',
      action: 'changed status to in-progress',
      timestamp: '1 hour ago',
      status: 'in-progress'
    },
    {
      id: '5',
      type: 'ticket_created',
      ticketId: '#1229',
      user: 'customer@domain.com',
      action: 'created a new ticket',
      timestamp: '2 hours ago',
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500);
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ticket_created': return <MessageSquare className="h-4 w-4" />;
      case 'ticket_resolved': return <CheckCircle className="h-4 w-4" />;
      case 'message_sent': return <ArrowUpRight className="h-4 w-4" />;
      case 'status_changed': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'ticket_created': return 'text-blue-600';
      case 'ticket_resolved': return 'text-green-600';
      case 'message_sent': return 'text-purple-600';
      case 'status_changed': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const filteredActivities = filterType === 'all' 
    ? activities 
    : activities.filter(activity => activity.type === filterType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
            <p className="text-muted-foreground">
              Recent system activity and ticket updates
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'ticket_created', label: 'Created' },
            { value: 'ticket_resolved', label: 'Resolved' },
            { value: 'message_sent', label: 'Messages' },
            { value: 'status_changed', label: 'Status' },
          ].map((filter) => (
            <Button
              key={filter.value}
              variant={filterType === filter.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilterType(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Activity Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Activity
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">
              +12 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tickets Created
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">
              +3 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tickets Resolved
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-muted-foreground">
              +5 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Users
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              Currently online
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Showing {filteredActivities.length} activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`p-2 rounded-full bg-muted ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{activity.user}</span>
                    <span className="text-sm text-muted-foreground">{activity.action}</span>
                    <Badge variant="outline" className="text-xs">
                      {activity.ticketId}
                    </Badge>
                    {activity.status && (
                      <Badge variant="secondary" className="text-xs">
                        {activity.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{activity.timestamp}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Load More */}
      <div className="text-center">
        <Button variant="outline">
          Load More Activity
        </Button>
      </div>
    </div>
  );
}