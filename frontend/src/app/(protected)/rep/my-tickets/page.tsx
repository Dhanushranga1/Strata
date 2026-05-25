'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api-client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { PageShell } from '@/ui/motion/PageShell';
import { Inbox, Search, AlertTriangle, Clock, Building2 } from 'lucide-react';

interface MyTicket {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated';
  priority: string;
  priority_level?: number;
  needs_attention: boolean;
  is_overdue: boolean;
  message_count: number;
  last_message_at: string;
  created_at: string;
  organization_id: string;
  organization_name: string;
  customer_email?: string;
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

export default function MyTicketsPage() {
  const { currentOrganization } = useOrganization();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status_filter: statusFilter,
        limit: '50',
      });
      if (search) params.set('q', search);
      // my-tickets is cross-org — pass no org header (api client omits it when undefined)
      const data = await api.get(`/api/rep/my-tickets?${params}`);
      setTickets(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error('my-tickets load failed', e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = tickets.reduce<Record<string, MyTicket[]>>((acc, t) => {
    const key = t.organization_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <PageShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Inbox className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Tickets</h1>
            <p className="text-sm text-muted-foreground">
              All tickets assigned to you across every organization · {total}{' '}
              total
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="escalated">Escalated</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 w-56 h-9"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No tickets assigned to you</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([orgName, orgTickets]) => (
              <div key={orgName}>
                {/* Org header */}
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {orgName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({orgTickets.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {orgTickets.map(ticket => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="block"
                    >
                      <Card className="hover:bg-accent/40 transition-colors cursor-pointer border-border/60">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-start gap-3">
                            {/* Priority pill */}
                            {ticket.priority_level && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${PRIORITY_COLORS[ticket.priority_level] ?? ''}`}
                              >
                                P{ticket.priority_level}
                              </span>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">
                                  {ticket.title}
                                </p>
                                {ticket.needs_attention && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                                )}
                                {ticket.is_overdue && (
                                  <Clock className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <StatusBadge status={ticket.status} />
                                {ticket.customer_email && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {ticket.customer_email}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                  {timeAgo(
                                    ticket.last_message_at || ticket.created_at
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
