'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Filter, Download, AlertCircle, Eye, Edit } from 'lucide-react'
import { DataTable } from '@/components/ui/DataTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/StatusBadge'
import { apiGet } from '@/lib/api'

// Types from backend schemas
interface TicketSummary {
  id: string;
  title: string;
  status: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

interface TicketListResponse {
  items: TicketSummary[];
  total: number;
  offset: number;
  limit: number;
}

const columns = [
  {
    id: 'id',
    accessorKey: 'id',
    header: 'Ticket ID',
    cell: ({ row }: { row: { original: TicketSummary } }) => (
      <Link
        href={`/tickets/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.id}
      </Link>
    ),
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }: { row: { original: TicketSummary } }) => (
      <div className="max-w-[300px] truncate">{row.original.title}</div>
    ),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: { row: { original: TicketSummary } }) => {
      const status = row.original.status as string
      return <StatusBadge status={status as "open" | "resolved" | "closed" | "in_progress" | "escalated"} />
    },
  },
  {
    id: 'message_count',
    accessorKey: 'message_count',
    header: 'Messages',
    cell: ({ row }: { row: { original: TicketSummary } }) => (
      <div className="text-sm">{row.original.message_count}</div>
    ),
  },
  {
    id: 'created_at',
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }: { row: { original: TicketSummary } }) => {
      const date = new Date(row.original.created_at)
      return (
        <div className="text-sm">
          {date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      )
    },
  },
]

// CSV Export function
function downloadCsv(rows: TicketSummary[]) {
  const headers = ["id", "title", "status", "message_count", "last_message_at", "created_at"];
  const csvContent = [
    headers.join(","),
    ...rows.map(row => [
      row.id,
      `"${row.title.replace(/"/g, '""')}"`, // Escape quotes in title
      row.status,
      row.message_count,
      row.last_message_at,
      row.created_at
    ].join(","))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tickets-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TicketsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const filterParam = searchParams.get('filter')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(filterParam || 'all')
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load tickets from API
  useEffect(() => {
    const loadTickets = async () => {
      try {
        console.log('🎫 Tickets: Loading tickets from API...');
        setLoading(true);
        
        const params = new URLSearchParams();
        if (statusFilter !== 'all') {
          params.append('status_filter', statusFilter);
        }
        if (searchTerm) {
          params.append('q', searchTerm);
        }
        
        const response = await apiGet<TicketListResponse>(`/api/tickets?${params.toString()}`);
        console.log('✅ Tickets: Loaded tickets:', response);
        setTickets(response.items || []);
        setError(null);
      } catch (err) {
        console.error('❌ Tickets: Failed to load tickets:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tickets');
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, [statusFilter, searchTerm]);

  // Filter tickets based on search and status (now applied to API data)
  const filteredTickets = tickets;

  // Calculate stats
  const totalTickets = tickets.length
  const openTickets = tickets.filter(t => t.status === 'open').length
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length
  const resolvedTickets = tickets.filter(t => t.status === 'resolved').length

  // DataTable actions
  const tableActions = [
    {
      id: "view",
      label: "View",
      icon: Eye,
      onClick: (row: TicketSummary) => router.push(`/tickets/${row.id}`)
    },
    {
      id: "edit",
      label: "Edit",
      icon: Edit,
      onClick: (row: TicketSummary) => router.push(`/tickets/${row.id}?mode=edit`)
    }
  ];

  return (
    <div className="flex flex-col space-y-8 p-8">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
        <p className="text-muted-foreground">
          Manage and track all customer support tickets
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-800">
                {error}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : totalTickets}</div>
            <p className="text-xs text-muted-foreground">
              All time tickets
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{loading ? '...' : openTickets}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting response
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{loading ? '...' : inProgressTickets}</div>
            <p className="text-xs text-muted-foreground">
              Being worked on
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{loading ? '...' : resolvedTickets}</div>
            <p className="text-xs text-muted-foreground">
              Completed tickets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="urgent">Urgent Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadCsv(filteredTickets)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Ticket</DialogTitle>
                <DialogDescription>
                  Create a new support ticket for a customer inquiry.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">
                    Title
                  </Label>
                  <Input id="title" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="customer" className="text-right">
                    Customer
                  </Label>
                  <Input id="customer" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="priority" className="text-right">
                    Priority
                  </Label>
                  <Select>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Textarea id="description" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={() => setNewTicketOpen(false)}>
                  Create Ticket
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>
            Showing {filteredTickets.length} of {totalTickets} tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredTickets}
            actions={tableActions}
            searchable={true}
            searchPlaceholder="Search tickets..."
            filterable={true}
            sortable={true}
            pagination={true}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  )
}
