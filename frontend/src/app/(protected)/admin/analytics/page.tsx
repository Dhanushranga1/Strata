'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/contexts/OrganizationContext';
import api from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  BarChart3,
  TrendingUp,
  Users,
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Download,
  FileText,
  FileSpreadsheet,
  Braces,
  Star,
  AlertTriangle,
  Zap,
  Database,
  Wifi,
} from 'lucide-react';
import { PageShell } from '@/ui/motion/PageShell';

function BarFill({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        ref={el => {
          if (el) el.style.setProperty('width', `${pct}%`);
        }}
      />
    </div>
  );
}

interface AnalyticsSummary {
  total_tickets: number;
  resolution_rate: number;
  avg_response_hours: number;
  avg_customer_rating: number | null;
  open_tickets: number;
  overdue_tickets: number;
  needs_attention: number;
}

interface StatusCount {
  status: string;
  count: number;
}
interface PriorityCount {
  priority: string;
  count: number;
}
interface CategoryData {
  status_counts: StatusCount[];
  priority_counts: PriorityCount[];
}

interface Rep {
  name: string;
  tickets_handled: number;
  tickets_resolved: number;
  resolution_rate: number;
  avg_response_hours: number;
}

interface TagItem {
  tag: string;
  count: number;
  pct: number;
}

interface SystemHealth {
  api: boolean;
  db_latency_ms: number | null;
  db_ok: boolean;
}

const formatHours = (h: number): string => {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
};

const STATUS_COLOURS: Record<string, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  escalated: 'bg-red-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-slate-400',
};
const PRIORITY_COLOURS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-slate-400',
};

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [reps, setReps] = useState<Rep[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(() => {
    const m = new Date().getMonth();
    return m === 0 ? 12 : m;
  });
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>(
    'pdf'
  );
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const userData = await api.get('/api/me');
      if (userData.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setUser(userData);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!user || !isReady || !orgId) return;
    Promise.all([
      api
        .get<AnalyticsSummary>('/api/admin/analytics/summary', orgId)
        .then(setSummary),
      api
        .get<CategoryData>('/api/admin/analytics/by-category', orgId)
        .then(setCategoryData),
      api
        .get<{
          representatives: Rep[];
        }>('/api/admin/analytics/rep-performance', orgId)
        .then(d => setReps(d.representatives)),
      api.get<TagItem[]>('/api/admin/analytics/top-tags', orgId).then(setTags),
    ]).catch(() => toast.error('Failed to load some analytics data'));

    // System health: real API + DB ping
    setHealthLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'}/api/wake`
    )
      .then(r => r.json())
      .then(d =>
        setHealth({
          api: true,
          db_ok: d.asyncpg?.ok ?? false,
          db_latency_ms: d.asyncpg?.latency_ms ?? null,
        })
      )
      .catch(() => setHealth({ api: false, db_ok: false, db_latency_ms: null }))
      .finally(() => setHealthLoading(false));
  }, [user, isReady, orgId]);

  const handleExport = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }
      const url = `${process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'}/api/admin/reports/monthly?year=${exportYear}&month=${exportMonth}&format=${exportFormat}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'X-Organization-ID': orgId,
        },
      });
      if (!res.ok) {
        toast.error('Export failed');
        return;
      }
      const blob =
        exportFormat === 'json'
          ? new Blob([JSON.stringify(await res.json(), null, 2)], {
              type: 'application/json',
            })
          : await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report_${exportYear}_${String(exportMonth).padStart(2, '0')}.${exportFormat}`;
      a.click();
      toast.success('Report downloaded');
      setExportOpen(false);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  const statusTotal =
    categoryData?.status_counts.reduce((s, r) => s + r.count, 0) || 1;
  const priorityTotal =
    categoryData?.priority_counts.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <PageShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">
                {currentOrganization?.name ?? 'Organisation'} · last 30 days
              </p>
            </div>
          </div>
          <Button onClick={() => setExportOpen(true)} className="gap-2">
            <Download className="h-4 w-4" />
            Export Monthly Report
          </Button>
        </div>

        {/* Export modal */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Export Monthly Report
              </DialogTitle>
              <DialogDescription>
                Full 8-section report: volume, rep performance, AI metrics, SLA
                compliance, and more.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Month</Label>
                  <Select
                    value={String(exportMonth)}
                    onValueChange={v => setExportMonth(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'January',
                        'February',
                        'March',
                        'April',
                        'May',
                        'June',
                        'July',
                        'August',
                        'September',
                        'October',
                        'November',
                        'December',
                      ].map((name, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Year</Label>
                  <Select
                    value={String(exportYear)}
                    onValueChange={v => setExportYear(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map(y => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Format</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        fmt: 'pdf' as const,
                        icon: FileText,
                        label: 'PDF',
                        desc: 'Formatted report',
                      },
                      {
                        fmt: 'csv' as const,
                        icon: FileSpreadsheet,
                        label: 'CSV',
                        desc: 'Spreadsheet-ready',
                      },
                      {
                        fmt: 'json' as const,
                        icon: Braces,
                        label: 'JSON',
                        desc: 'Raw data / API',
                      },
                    ] as const
                  ).map(({ fmt, icon: Icon, label, desc }) => (
                    <button
                      type="button"
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm transition-colors
                        ${exportFormat === fmt ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50 text-muted-foreground'}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{label}</span>
                      <span className="text-xs">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Report includes:</p>
                <p>
                  Executive summary · Weekly volume · Status &amp; priority
                  breakdown
                </p>
                <p>
                  Rep performance · AI metrics · SLA/ETR compliance · Top tags
                </p>
              </div>
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                {exporting
                  ? 'Generating…'
                  : `Download ${exportFormat.toUpperCase()}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Tickets
              </CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.total_tickets.toLocaleString() ?? '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary
                  ? `${summary.open_tickets} open · ${summary.overdue_tickets} overdue`
                  : 'Loading…'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg First Response
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary
                  ? summary.avg_response_hours === 0
                    ? 'N/A'
                    : formatHours(summary.avg_response_hours)
                  : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                Time to first rep reply
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Resolution Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? `${summary.resolution_rate}%` : '—'}
              </div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CSAT Score</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.avg_customer_rating != null
                  ? `${summary.avg_customer_rating} / 5`
                  : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary?.needs_attention
                  ? `${summary.needs_attention} tickets need attention`
                  : 'Customer satisfaction'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status + Priority distribution */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Status Breakdown</CardTitle>
              <CardDescription>
                Distribution across all statuses (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryData ? (
                categoryData.status_counts.map(row => {
                  const pct = Math.round((row.count / statusTotal) * 100);
                  return (
                    <div key={row.status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="capitalize">
                          {row.status.replace('_', ' ')}
                        </span>
                        <span className="text-muted-foreground font-medium">
                          {row.count} ({pct}%)
                        </span>
                      </div>
                      <BarFill
                        pct={pct}
                        colorClass={STATUS_COLOURS[row.status] ?? 'bg-primary'}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Priority Distribution</CardTitle>
              <CardDescription>
                Ticket volume by priority level (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryData ? (
                categoryData.priority_counts.map(row => {
                  const pct = Math.round((row.count / priorityTotal) * 100);
                  return (
                    <div key={row.priority}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="capitalize">{row.priority}</span>
                        <span className="text-muted-foreground font-medium">
                          {row.count} ({pct}%)
                        </span>
                      </div>
                      <BarFill
                        pct={pct}
                        colorClass={
                          PRIORITY_COLOURS[row.priority] ?? 'bg-primary'
                        }
                      />
                    </div>
                  );
                })
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Top Tags</CardTitle>
              <CardDescription>
                Most-used ticket tags (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tags.length > 0 ? (
                <div className="space-y-3">
                  {tags.map(t => (
                    <div key={t.tag}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs py-0">
                            {t.tag}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground font-medium">
                          {t.count} ({t.pct}%)
                        </span>
                      </div>
                      <BarFill pct={t.pct} colorClass="bg-primary/70" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                  {tags.length === 0
                    ? 'No tagged tickets in the last 30 days'
                    : 'Loading…'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rep Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Rep Performance</CardTitle>
              <CardDescription>
                Ticket metrics per support representative
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reps.length > 0 ? (
                <div className="space-y-4">
                  {reps.map((rep, i) => (
                    <div
                      key={rep.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            i === 0
                              ? 'bg-emerald-500'
                              : i === 1
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {rep.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rep.tickets_handled} tickets ·{' '}
                            {rep.avg_response_hours > 0
                              ? formatHours(rep.avg_response_hours) + ' resp.'
                              : 'no response data'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold">
                          {rep.resolution_rate}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          resolved
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                  No rep data for the last 30 days
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              System Health
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHealthLoading(true);
                  fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'}/api/wake`
                  )
                    .then(r => r.json())
                    .then(d =>
                      setHealth({
                        api: true,
                        db_ok: d.asyncpg?.ok ?? false,
                        db_latency_ms: d.asyncpg?.latency_ms ?? null,
                      })
                    )
                    .catch(() =>
                      setHealth({
                        api: false,
                        db_ok: false,
                        db_latency_ms: null,
                      })
                    )
                    .finally(() => setHealthLoading(false));
                }}
                disabled={healthLoading}
              >
                {healthLoading ? 'Checking…' : 'Refresh'}
              </Button>
            </CardTitle>
            <CardDescription>
              Live status of API and database connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* API */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg ${health?.api ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}
              >
                <Wifi
                  className={`h-5 w-5 ${health?.api ? 'text-emerald-600' : 'text-red-500'}`}
                />
                <div>
                  <p className="text-sm font-medium">API</p>
                  <p className="text-xs text-muted-foreground">
                    {health == null
                      ? 'Checking…'
                      : health.api
                        ? 'Operational'
                        : 'Unreachable'}
                  </p>
                </div>
              </div>

              {/* Database */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  health == null
                    ? 'bg-muted/30'
                    : health.db_ok && (health.db_latency_ms ?? 9999) < 1000
                      ? 'bg-emerald-50 dark:bg-emerald-950/30'
                      : health.db_ok
                        ? 'bg-amber-50 dark:bg-amber-950/30'
                        : 'bg-red-50 dark:bg-red-950/30'
                }`}
              >
                <Database
                  className={`h-5 w-5 ${
                    health == null
                      ? 'text-muted-foreground'
                      : health.db_ok && (health.db_latency_ms ?? 9999) < 1000
                        ? 'text-emerald-600'
                        : health.db_ok
                          ? 'text-amber-500'
                          : 'text-red-500'
                  }`}
                />
                <div>
                  <p className="text-sm font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">
                    {health == null
                      ? 'Checking…'
                      : !health.db_ok
                        ? 'Unreachable'
                        : health.db_latency_ms != null
                          ? `${health.db_latency_ms}ms latency`
                          : 'Connected'}
                  </p>
                </div>
              </div>

              {/* Attention required */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  (summary?.needs_attention ?? 0) > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30'
                    : 'bg-emerald-50 dark:bg-emerald-950/30'
                }`}
              >
                {(summary?.needs_attention ?? 0) > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                )}
                <div>
                  <p className="text-sm font-medium">Queue</p>
                  <p className="text-xs text-muted-foreground">
                    {summary == null
                      ? 'Loading…'
                      : summary.needs_attention > 0
                        ? `${summary.needs_attention} ticket${summary.needs_attention !== 1 ? 's' : ''} need attention`
                        : 'All tickets on track'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
