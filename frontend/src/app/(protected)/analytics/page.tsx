"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Star,
  Loader2
} from "lucide-react";
import api from "@/lib/api-client";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Summary {
  total_tickets: number;
  resolution_rate: number;
  avg_response_hours: number;
  avg_customer_rating: number | null;
}

interface CategoryData {
  status_counts: { status: string; count: number }[];
  priority_counts: { priority: string; count: number }[];
}

interface RepPerf {
  name: string;
  tickets_handled: number;
  tickets_resolved: number;
  resolution_rate: number;
  avg_response_hours: number;
}

const RANGE_DAYS: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };

const STATUS_COLORS: Record<string, string> = {
  open: "text-blue-400",
  in_progress: "text-yellow-400",
  resolved: "text-green-400",
  closed: "text-zinc-400",
  escalated: "text-red-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  normal: "text-blue-400",
  low: "text-zinc-400",
};

export default function AnalyticsPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [category, setCategory] = useState<CategoryData | null>(null);
  const [reps, setReps] = useState<RepPerf[]>([]);

  const load = useCallback(async (range: string) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const days = RANGE_DAYS[range] ?? 30;
      const [s, c, r] = await Promise.all([
        api.get<Summary>(`/api/admin/analytics/summary?days=${days}`, orgId),
        api.get<CategoryData>("/api/admin/analytics/by-category", orgId),
        api.get<{ representatives: RepPerf[] }>("/api/admin/analytics/rep-performance", orgId),
      ]);
      setSummary(s);
      setCategory(c);
      setReps(r.representatives ?? []);
    } catch {
      // non-admin fallback: leave as null
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(timeRange); }, [load, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Admin access required to view analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">Performance metrics and insights</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["1d", "7d", "30d", "90d"] as const).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "secondary" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_tickets.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">in the last {timeRange}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.resolution_rate}%</div>
            <div className="flex items-center text-xs text-green-400">
              <TrendingUp className="h-3 w-3 mr-1" />
              tickets resolved or closed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg First Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avg_response_hours < 1
                ? `${Math.round(summary.avg_response_hours * 60)}m`
                : `${summary.avg_response_hours}h`}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 mr-1" />
              time to first reply
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avg_customer_rating != null ? `${summary.avg_customer_rating}★` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">average satisfaction score</p>
          </CardContent>
        </Card>
      </div>

      {/* Status & Priority breakdown */}
      {category && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tickets by Status</CardTitle>
              <CardDescription>Current distribution across all tickets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.status_counts.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className={`text-sm font-medium capitalize ${STATUS_COLORS[s.status] ?? "text-muted-foreground"}`}>
                    {s.status.replace("_", " ")}
                  </span>
                  <Badge variant="outline">{s.count}</Badge>
                </div>
              ))}
              {category.status_counts.length === 0 && (
                <p className="text-sm text-muted-foreground">No ticket data</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tickets by Priority</CardTitle>
              <CardDescription>Breakdown by priority level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.priority_counts.map((p) => (
                <div key={p.priority} className="flex items-center justify-between">
                  <span className={`text-sm font-medium capitalize ${PRIORITY_COLORS[p.priority] ?? "text-muted-foreground"}`}>
                    {p.priority}
                  </span>
                  <Badge variant="outline">{p.count}</Badge>
                </div>
              ))}
              {category.priority_counts.length === 0 && (
                <p className="text-sm text-muted-foreground">No ticket data</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rep Performance */}
      {reps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rep Performance</CardTitle>
            <CardDescription>Resolution metrics per support representative</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reps.map((rep) => (
                <div key={rep.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{rep.name}</p>
                    <p className="text-xs text-muted-foreground">{rep.tickets_handled} tickets handled</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-sm font-medium text-green-400">{rep.resolution_rate}%</p>
                      <p className="text-xs text-muted-foreground">Resolution</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {rep.avg_response_hours < 1
                          ? `${Math.round(rep.avg_response_hours * 60)}m`
                          : `${rep.avg_response_hours}h`}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg Time</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {reps.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No rep performance data yet. Assign tickets to reps to start tracking.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
