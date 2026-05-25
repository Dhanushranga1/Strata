'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import { PageShell } from '@/ui/motion/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Ticket, Search, ArrowLeft, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  priority_level: number | null;
  needs_attention: boolean;
  is_overdue: boolean;
  created_at: string;
  last_message_at: string;
  org_name: string;
  assignee_email: string | null;
}

interface OrgOption {
  id: string;
  name: string;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-950/40 text-red-400 border border-red-800',
  2: 'bg-orange-950/40 text-orange-400 border border-orange-800',
  3: 'bg-yellow-950/40 text-yellow-400 border border-yellow-800',
  4: 'bg-blue-950/40 text-blue-400 border border-blue-800',
  5: 'bg-indigo-950/40 text-indigo-400 border border-indigo-800',
  6: 'bg-violet-950/40 text-violet-400 border border-violet-800',
  7: 'bg-zinc-800/60 text-zinc-400 border border-zinc-700',
};

function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${Math.floor(diff / 60000)}m ago`;
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const loadOrgs = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/organizations');
      setOrgs(data.map((o: any) => ({ id: o.id, name: o.name })));
    } catch {
      // non-fatal
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      });
      if (selectedOrg !== 'all') params.set('org_id', selectedOrg);
      if (statusFilter !== 'all') params.set('status_filter', statusFilter);
      if (search) params.set('q', search);
      const data = await api.get(`/api/admin/tickets?${params}`);
      setTickets(data.items);
      setTotal(data.total);
    } catch (e: any) {
      if (e?.message?.includes('403')) {
        router.replace('/dashboard');
      } else {
        toast.error('Failed to load tickets');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, statusFilter, search, offset, router]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return (
    <PageShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Ticket className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">All Tickets</h1>
            <p className="text-sm text-muted-foreground">
              Platform-wide ticket view across all organisations · {total} total
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedOrg}
            onValueChange={v => {
              setSelectedOrg(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All organisations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organisations</SelectItem>
              {orgs.map(o => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={v => {
              setStatusFilter(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets…"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="pl-8 w-56 h-9"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
              <Ticket className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No tickets match the current filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => (
              <Link key={t.id} href={`/tickets/${t.id}`} className="block">
                <Card className="hover:bg-accent/40 transition-colors cursor-pointer border-border/60">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      {t.priority_level && (
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5',
                            PRIORITY_COLORS[t.priority_level] ?? ''
                          )}
                        >
                          P{t.priority_level}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {t.title}
                          </p>
                          {t.needs_attention && (
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                          )}
                          {t.is_overdue && (
                            <Clock className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <StatusBadge status={t.status as any} />
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0"
                          >
                            {t.org_name}
                          </Badge>
                          {t.assignee_email && (
                            <span className="text-xs text-muted-foreground truncate">
                              {t.assignee_email}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">
                            {timeAgo(t.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex justify-center items-center gap-4 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
