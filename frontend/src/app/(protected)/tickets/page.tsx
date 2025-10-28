'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Filter, Download, AlertCircle, Eye, Edit } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { DataTable } from '@/components/ui/DataTable'
import { MobileTicketCard } from '@/components/ui/mobile-ticket-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TicketListSkeleton } from '@/components/skeletons/TicketListSkeleton'
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
import { useOrganization } from '@/contexts/OrganizationContext'
import api from '@/lib/api-client'

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

// Empty State Component
const EmptyTicketState = ({ onCreateClick }: { onCreateClick: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-16 px-4"
  >
    <div className="mx-auto w-24 h-24 mb-6 rounded-full bg-primary/10 flex items-center justify-center">
      <Plus className="w-12 h-12 text-primary" />
    </div>
    <h2 className="text-2xl font-semibold text-foreground mb-3">
      Welcome to TicketPilot! 👋
    </h2>
    <p className="text-muted-foreground max-w-md mx-auto mb-8">
      Get instant help from our AI assistant powered by your company&apos;s knowledge base. 
      Create your first ticket to get started.
    </p>
    
    <Button 
      size="lg" 
      onClick={onCreateClick}
      className="mb-8"
    >
      <Plus className="w-5 h-5 mr-2" />
      Create Your First Ticket
    </Button>
    
    <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
      <Card className="p-4">
        <div className="font-medium mb-2">📝 Be Specific</div>
        <div className="text-muted-foreground text-xs">
          Describe your issue clearly with relevant details
        </div>
      </Card>
      <Card className="p-4">
        <div className="font-medium mb-2">🤖 AI Helps First</div>
        <div className="text-muted-foreground text-xs">
          Our AI assistant will search our help docs instantly
        </div>
      </Card>
      <Card className="p-4">
        <div className="font-medium mb-2">👤 Human Backup</div>
        <div className="text-muted-foreground text-xs">
          If AI can&apos;t help, escalate to our support team
        </div>
      </Card>
    </div>
  </motion.div>
);

export default function TicketsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const filterParam = searchParams.get('filter')
  
  // Organization context
  const { currentOrganization, isReady, switchingOrg } = useOrganization()
  const orgId = currentOrganization?.id
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(filterParam || 'all')
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium'
  })
  const [validationErrors, setValidationErrors] = useState({
    title: '',
    description: ''
  })

  // Load tickets from API
  useEffect(() => {
    // Wait for org context to be ready
    if (!isReady || !orgId) {
      setLoading(true)
      return
    }

    const loadTickets = async () => {
      try {
        console.log('🎫 Tickets: Loading tickets from API for org:', orgId);
        setLoading(true);
        
        const params = new URLSearchParams();
        if (statusFilter !== 'all') {
          params.append('status_filter', statusFilter);
        }
        if (searchTerm) {
          params.append('q', searchTerm);
        }
        
        const response = await api.get<TicketListResponse>(`/api/tickets?${params.toString()}`, orgId);
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
  }, [statusFilter, searchTerm, isReady, orgId]);

  // Create ticket function
  const createTicket = async () => {
    // Reset validation errors
    setValidationErrors({ title: '', description: '' })

    // Validate title
    const errors: { title: string; description: string } = { title: '', description: '' }
    
    if (!newTicket.title.trim()) {
      errors.title = 'Title is required'
    } else if (newTicket.title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters'
    } else if (newTicket.title.trim().length > 200) {
      errors.title = 'Title must be less than 200 characters'
    }

    // Validate description
    if (!newTicket.description.trim()) {
      errors.description = 'Description is required'
    } else if (newTicket.description.trim().length < 20) {
      errors.description = 'Please provide more detail (at least 20 characters)'
    }

    // If there are validation errors, show them
    if (errors.title || errors.description) {
      setValidationErrors(errors)
      if (errors.title) {
        toast.error(errors.title)
      } else if (errors.description) {
        toast.error(errors.description)
      }
      return
    }

    if (!orgId) {
      toast.error('Organization context not loaded. Please refresh the page.')
      return
    }

    try {
      setCreating(true);
      const response = await api.post<{ id: string }>('/api/tickets', {
        title: newTicket.title,
        description: newTicket.description,
      }, orgId);
      
      // Show success toast
      toast.success('✅ Ticket created! Our AI is analyzing your question...', {
        duration: 4000,
      });
      
      // Reset form and validation
      setNewTicket({ title: '', description: '', priority: 'medium' });
      setValidationErrors({ title: '', description: '' })
      setNewTicketOpen(false);
      
      // Redirect with slight delay for toast visibility
      setTimeout(() => {
        router.push(`/tickets/${response.id}`);
      }, 500);
      
    } catch (error) {
      toast.error('Failed to create ticket. Please try again.');
      setError(error instanceof Error ? error.message : 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

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
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Ticket</DialogTitle>
                <DialogDescription>
                  Describe your issue below. Our AI will help find answers from our knowledge base.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Subject <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="title" 
                    placeholder="Brief summary of your issue"
                    value={newTicket.title}
                    onChange={(e) => {
                      setNewTicket({ ...newTicket, title: e.target.value })
                      // Clear error when user starts typing
                      if (validationErrors.title) {
                        setValidationErrors({ ...validationErrors, title: '' })
                      }
                    }}
                    className={validationErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    maxLength={200}
                  />
                  {validationErrors.title && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {validationErrors.title}
                    </p>
                  )}
                  {!validationErrors.title && newTicket.title && (
                    <p className="text-xs text-muted-foreground">
                      {newTicket.title.length}/200 characters
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description <span className="text-red-500">*</span>
                  </Label>
                  <Textarea 
                    id="description" 
                    value={newTicket.description}
                    onChange={(e) => {
                      setNewTicket({ ...newTicket, description: e.target.value })
                      // Clear error when user starts typing
                      if (validationErrors.description) {
                        setValidationErrors({ ...validationErrors, description: '' })
                      }
                    }}
                    placeholder="Describe your issue in detail. For example: 'I'm trying to reset my password, but the email link says it expired. I've tried 3 times in the last hour.'"
                    rows={6}
                    className={`resize-none ${validationErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    maxLength={500}
                  />
                  {validationErrors.description && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {validationErrors.description}
                    </p>
                  )}
                  {!validationErrors.description && (
                    <p className="text-xs text-muted-foreground">
                      {newTicket.description.length}/500 characters • More detail helps us assist you faster!
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setNewTicketOpen(false);
                    setNewTicket({ title: '', description: '', priority: 'medium' });
                    setValidationErrors({ title: '', description: '' });
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  onClick={createTicket}
                  disabled={
                    creating || 
                    !newTicket.title.trim() || 
                    !newTicket.description.trim() ||
                    newTicket.title.trim().length < 5 ||
                    newTicket.description.trim().length < 20
                  }
                >
                  {creating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Ticket'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Data Table or Empty State */}
      {(loading || switchingOrg) ? (
        <TicketListSkeleton />
      ) : filteredTickets.length === 0 && !searchTerm && statusFilter === 'all' ? (
        <EmptyTicketState onCreateClick={() => setNewTicketOpen(true)} />
      ) : (
        <>
          {/* Mobile Card View (< 768px) */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-sm text-muted-foreground">
                Showing {filteredTickets.length} of {totalTickets} tickets
              </p>
            </div>
            {filteredTickets.map((ticket) => (
              <MobileTicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <Card className="hidden md:block">
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
        </>
      )}
    </div>
  )
}
