'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/StatusBadge'
import { RepActionBar } from '@/components/ui/RepActionBar'
import { AIMessage } from '@/components/ui/AIMessage'
import { AIResponseModal } from '@/components/rep/AIResponseModal'
import { KBIngestModal } from '@/components/ui/KBIngestModal'
import { buildAISuggestionQuery, prepareTicketContext } from '@/lib/ai/prompt'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'
import { Clock, MessageSquare, User, AlertTriangle, ExternalLink, Upload, CheckCircle, Phone, Mail, Bot } from 'lucide-react'
import { m } from 'framer-motion'
import { v } from '@/ui/motion/variants'
import { PageShell } from '@/ui/motion/PageShell'

interface QueueItem {
  id: string
  title: string
  status: string
  priority: string
  needs_attention: boolean
  assignee_id?: string
  message_count: number
  last_message_at: string
  created_at: string
  customer_email?: string
  customer_phone?: string
}

interface QueueCounts {
  needs_attention: number
  open_active: number
  escalated: number
  all: number
}

interface User {
  id: string
  email: string
  role: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'

// Simple skeleton loader component
const TicketCardSkeleton = () => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
        </div>
        <div className="h-6 bg-gray-200 rounded animate-pulse w-16"></div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-full"></div>
        <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3"></div>
        <div className="flex gap-2">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-20"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse w-20"></div>
        </div>
      </div>
    </CardContent>
  </Card>
)

export default function RepConsolePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [countsLoading, setCountsLoading] = useState(false)
  const [tickets, setTickets] = useState<QueueItem[]>([])
  const [counts, setCounts] = useState<QueueCounts>({ needs_attention: 0, open_active: 0, escalated: 0, all: 0 })
  const [currentLane, setCurrentLane] = useState('needs_attention')
  const [searchQuery, setSearchQuery] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showKBModal, setShowKBModal] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  
  // AI-related state
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiResponse, setAiResponse] = useState<any>(null)
  const [aiCooldowns, setAiCooldowns] = useState<Record<string, number>>({})
  const [currentAiTicket, setCurrentAiTicket] = useState<string | null>(null)

  const limit = 20

  // Check authentication and role
  useEffect(() => {
    checkAuth()
  }, [])

  // Load data when filters change
  useEffect(() => {
    if (user) {
      loadTickets()
      loadCounts()
    }
  }, [user, currentLane, searchQuery, mineOnly, offset])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      loadTickets(true) // silent refresh
      loadCounts(true) // silent refresh
      setLastRefresh(Date.now())
    }, 30000)

    return () => clearInterval(interval)
  }, [user, currentLane, searchQuery, mineOnly, offset])

  // AI cooldown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setAiCooldowns(prev => {
        const now = Date.now()
        const updated = { ...prev }
        let hasChanges = false
        
        Object.keys(updated).forEach(ticketId => {
          if (updated[ticketId] <= now) {
            delete updated[ticketId]
            hasChanges = true
          }
        })
        
        return hasChanges ? updated : prev
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const checkAuth = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.replace('/login')
        return
      }

      const token = data.session.access_token
      const response = await fetch(`${API_BASE}/api/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        router.replace('/login')
        return
      }

      const userData = await response.json()
      if (!['rep', 'admin'].includes(userData.role)) {
        router.replace('/dashboard') // Redirect non-reps to dashboard
        return
      }

      setUser(userData)
    } catch (error) {
      console.error('Auth check failed:', error)
      router.replace('/login')
    } finally {
      setLoading(false)
    }
  }

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  const loadTickets = async (silent = false) => {
    try {
      if (!silent) setTicketsLoading(true)
      
      const token = await getAuthToken()
      const params = new URLSearchParams({
        lane: currentLane,
        offset: offset.toString(),
        limit: limit.toString()
      })
      
      if (searchQuery) params.append('q', searchQuery)
      if (mineOnly) params.append('mine', 'true')

      const response = await fetch(`${API_BASE}/api/rep/queue?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[RepConsole] Loaded tickets data:', data)
        console.log('[RepConsole] First ticket priority:', data.items?.[0]?.priority)
        console.log('[RepConsole] All ticket priorities:', data.items?.map((t: any) => t.priority))
        setTickets(data.items)
        setTotal(data.total)
      } else {
        if (!silent) {
          toast.error('Failed to load tickets')
        }
      }
    } catch (error) {
      console.error('Failed to load tickets:', error)
      if (!silent) {
        toast.error('Failed to load tickets')
      }
    } finally {
      if (!silent) setTicketsLoading(false)
    }
  }

  const loadCounts = async (silent = false) => {
    try {
      if (!silent) setCountsLoading(true)
      
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE}/api/rep/counts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setCounts(data)
      } else {
        if (!silent) {
          toast.error('Failed to load queue counts')
        }
      }
    } catch (error) {
      console.error('Failed to load counts:', error)
      if (!silent) {
        toast.error('Failed to load queue counts')
      }
    } finally {
      if (!silent) setCountsLoading(false)
    }
  }

  // Quick Action Handlers
  const handleQuickRespond = (ticket: QueueItem) => {
    // Navigate to ticket detail page and focus on composer
    toast.success('Opening ticket composer...')
    router.push(`/tickets/${ticket.id}#compose`)
  }

  const handleQuickCall = async (ticket: QueueItem) => {
    try {
      setActionLoading(ticket.id + 'call')
      
      if (ticket.customer_phone) {
        // Open tel: link for phone call
        window.open(`tel:${ticket.customer_phone}`, '_self')
        toast.success(`Calling ${ticket.customer_phone}`)
        
        // Also log a system message about the call
        const token = await getAuthToken()
        await fetch(`${API_BASE}/api/tickets/${ticket.id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            body: `📞 Call initiated to ${ticket.customer_phone}`,
            sender_role: 'system'
          })
        })
        
        // Optimistically update message count
        setTickets(prev => prev.map(t => 
          t.id === ticket.id 
            ? { ...t, message_count: t.message_count + 1 }
            : t
        ))
        
        // Reload tickets to sync with server
        await loadTickets(true)
      } else {
        // No phone number available, open modal to log call manually
        const callNote = prompt('Phone number not available. Log call details:')
        if (callNote) {
          const token = await getAuthToken()
          const response = await fetch(`${API_BASE}/api/tickets/${ticket.id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              body: `📞 Call logged: ${callNote}`,
              sender_role: 'system'
            })
          })
          
          if (response.ok) {
            toast.success('Call logged successfully')
            // Optimistically update message count
            setTickets(prev => prev.map(t => 
              t.id === ticket.id 
                ? { ...t, message_count: t.message_count + 1 }
                : t
            ))
            await loadTickets(true)
          } else {
            toast.error('Failed to log call')
          }
        }
      }
    } catch (error) {
      console.error('Failed to log call:', error)
      toast.error('Failed to log call')
    } finally {
      setActionLoading(null)
    }
  }

  const handleQuickEmail = async (ticket: QueueItem) => {
    try {
      setActionLoading(ticket.id + 'email')
      
      const subject = `[Ticket #${ticket.id.slice(0, 8)}] ${ticket.title}`
      const body = `Hi,\n\nRegarding your support ticket "${ticket.title}":\n\n[Your message here]\n\nBest regards,\nSupport Team`
      const mailtoUrl = `mailto:${ticket.customer_email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      
      window.open(mailtoUrl, '_self')
      toast.success('Email client opened')
      
      // Log that an email was sent
      const shouldLog = confirm('Email client opened. Log this email in the ticket?')
      if (shouldLog) {
        const token = await getAuthToken()
        const response = await fetch(`${API_BASE}/api/tickets/${ticket.id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            body: `📧 Email sent to ${ticket.customer_email || 'customer'}`,
            sender_role: 'system'
          })
        })
        
        if (response.ok) {
          toast.success('Email logged successfully')
          // Optimistically update message count
          setTickets(prev => prev.map(t => 
            t.id === ticket.id 
              ? { ...t, message_count: t.message_count + 1 }
              : t
          ))
          await loadTickets(true)
        } else {
          toast.error('Failed to log email')
        }
      }
    } catch (error) {
      console.error('Failed to handle email:', error)
      toast.error('Failed to handle email')
    } finally {
      setActionLoading(null)
    }
  }

  const handleQuickAI = async (ticket: QueueItem) => {
    // Check cooldown
    const now = Date.now()
    const cooldownEnd = aiCooldowns[ticket.id]
    if (cooldownEnd && cooldownEnd > now) {
      const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000)
      toast.error(`Please wait ${remainingSeconds} seconds before requesting another AI suggestion`, { 
        id: 'ai-cooldown-' + ticket.id 
      })
      return
    }

    try {
      setActionLoading(ticket.id + 'ai')
      toast.loading('Getting AI suggestion...', { id: 'ai-' + ticket.id })
      
      const token = await getAuthToken()
      
      // Fetch detailed ticket information including messages
      let ticketDetails = ticket
      let messages: any[] = []
      
      try {
        // Get full ticket details
        ticketDetails = await apiGet(`/api/tickets/${ticket.id}`, token)
        
        // Get recent messages (last 5)
        const messagesResponse = await apiGet(`/api/tickets/${ticket.id}/messages?limit=5&order=desc`, token)
        messages = Array.isArray(messagesResponse) ? messagesResponse.reverse() : []
      } catch (detailError) {
        console.warn('Could not fetch detailed ticket context:', detailError)
        // Continue with basic ticket info
      }

      // Prepare context and build query
      const context = prepareTicketContext(ticketDetails as unknown as Record<string, unknown>, messages)
      const query = buildAISuggestionQuery(context)

      // Make AI request with corrected field name
      const response = await fetch(`${API_BASE}/api/tickets/${ticket.id}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query  // Fixed: was 'prompt', now 'query'
        })
      })

      if (response.ok) {
        const aiResponseData = await response.json()
        
        toast.success('AI suggestion ready!', { id: 'ai-' + ticket.id })
        
        // Show in modal instead of alert
        setAiResponse(aiResponseData)
        setCurrentAiTicket(ticket.id)
        setAiModalOpen(true)
        
      } else if (response.status === 429) {
        // Handle rate limiting
        const retryAfter = response.headers.get('Retry-After')
        const cooldownSeconds = retryAfter ? parseInt(retryAfter) : 8
        
        setAiCooldowns(prev => ({
          ...prev,
          [ticket.id]: Date.now() + (cooldownSeconds * 1000)
        }))
        
        toast.error(`Rate limited. Please wait ${cooldownSeconds} seconds.`, { 
          id: 'ai-' + ticket.id 
        })
        
      } else if (response.status === 401) {
        toast.error('Authentication required. Please log in again.', { id: 'ai-' + ticket.id })
        router.push('/login')
        
      } else if (response.status === 404) {
        toast.error('Ticket not found', { id: 'ai-' + ticket.id })
        
      } else {
        const errorText = await response.text().catch(() => 'Unknown error')
        toast.error(`AI request failed: ${errorText}`, { id: 'ai-' + ticket.id })
      }
      
    } catch (error) {
      console.error('AI suggestion failed:', error)
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection.', { id: 'ai-' + ticket.id })
      } else {
        toast.error('AI suggestion failed', { id: 'ai-' + ticket.id })
      }
      
    } finally {
      setActionLoading(null)
    }
  }

  // AI Modal Handlers
  const handleAiInsert = (content: string) => {
    // For now, copy to clipboard and show notification
    // In a full implementation, this would insert into a reply composition area
    navigator.clipboard.writeText(content).then(() => {
      toast.success('AI suggestion copied to clipboard - paste it into your reply')
    }).catch(() => {
      toast.error('Failed to copy suggestion')
    })
    
    // Add audit trail
    if (currentAiTicket) {
      addAuditMessage(currentAiTicket, `AI suggestion applied (confidence ${Math.round((aiResponse?.confidence || 0) * 100)}%, model ${aiResponse?.model || 'unknown'})`)
    }
  }

  const handleAiEscalate = async () => {
    if (!currentAiTicket) return
    
    try {
      await performAction(currentAiTicket, 'escalate', { 
        reason: `AI suggested escalation (confidence ${Math.round((aiResponse?.confidence || 0) * 100)}%)` 
      })
      
      // Add audit trail
      addAuditMessage(currentAiTicket, `AI suggested escalation (confidence ${Math.round((aiResponse?.confidence || 0) * 100)}%)`)
    } catch (error) {
      console.error('Failed to escalate:', error)
      toast.error('Failed to escalate ticket')
    }
  }

  const handleAiFeedback = (positive: boolean) => {
    // Log feedback for analytics (could be enhanced to send to backend)
    console.log(`AI feedback for ticket ${currentAiTicket}:`, positive ? 'positive' : 'negative')
  }

  const addAuditMessage = async (ticketId: string, message: string) => {
    try {
      const token = await getAuthToken()
      await fetch(`${API_BASE}/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          body: `[system] ${message}`,
          sender_role: 'system'
        })
      })
    } catch (error) {
      console.warn('Failed to add audit message:', error)
    }
  }

  const performAction = async (ticketId: string, action: string, payload: any = {}) => {
    try {
      setActionLoading(ticketId + action)
      toast.loading(`Performing ${action}...`, { id: 'action-' + ticketId })
      
      const token = await getAuthToken()
      
      const response = await fetch(`${API_BASE}/api/rep/tickets/${ticketId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)} successful!`, { id: 'action-' + ticketId })
        
        // Optimistic UI update for certain actions
        if (action === 'assign') {
          setTickets(prev => prev.map(t => 
            t.id === ticketId 
              ? { ...t, assignee_id: user?.id }
              : t
          ))
        } else if (action === 'acknowledge') {
          setTickets(prev => prev.map(t => 
            t.id === ticketId 
              ? { ...t, needs_attention: false }
              : t
          ))
        }
        
        // Reload data to sync with server
        await loadTickets(true)
        await loadCounts(true)
      } else {
        const errorText = await response.text()
        toast.error(`${action} failed: ${errorText}`, { id: 'action-' + ticketId })
      }
    } catch (error) {
      console.error('Action failed:', error)
      toast.error(`${action} failed`, { id: 'action-' + ticketId })
    } finally {
      setActionLoading(null)
    }
  }

  const handleEscalate = async (ticketId: string) => {
    const reason = prompt('Escalation reason (optional):')
    if (reason !== null) { // User didn't cancel
      await performAction(ticketId, 'escalate', { reason: reason || null })
    }
  }

  const handleManualRefresh = async () => {
    toast.loading('Refreshing...', { id: 'manual-refresh' })
    try {
      await Promise.all([
        loadTickets(),
        loadCounts()
      ])
      setLastRefresh(Date.now())
      toast.success('Refreshed successfully', { id: 'manual-refresh' })
    } catch (error) {
      toast.error('Refresh failed', { id: 'manual-refresh' })
    }
  }

  const handleStatusChange = (ticketId: string, status: string) => {
    performAction(ticketId, 'status', { status })
  }

  const handlePriorityChange = (ticketId: string, priority: string) => {
    performAction(ticketId, 'priority', { priority })
  }

  const handleKBIngest = async (sources: any[]) => {
    console.log('🔄 Rep: Starting KB ingest for', sources.length, 'sources')
    
    for (const source of sources) {
      try {
        const formData = new FormData()
        
        if (source.type === 'file' && source.file) {
          formData.append('file', source.file)
        } else if (source.type === 'text' && source.content) {
          formData.append('raw_text', source.content)
          if (source.name) {
            formData.append('filename', source.name)
          }
        } else if (source.type === 'url' && source.url) {
          formData.append('raw_text', `URL: ${source.url}`)
          formData.append('filename', `url-${Date.now()}.txt`)
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/kb/ingest`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Upload failed: ${errorText}`)
        }

        const result = await response.json()
        console.log('✅ Rep: KB ingest successful for', source.name, ':', result)
        
      } catch (error) {
        console.error('❌ Rep: KB ingest failed for', source.name, ':', error)
      }
    }
    
    // Close modal after processing
    setShowKBModal(false)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      escalated: 'bg-red-100 text-red-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-red-100 text-red-800'
    }
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user || !['rep', 'admin'].includes(user.role)) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">You need rep or admin access to view this page.</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-col space-y-8 p-8 bg-gradient-to-br from-background to-muted/20 min-h-screen">
        {/* Header */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Rep Console</h1>
              <p className="text-muted-foreground">
                Manage customer support tickets and prioritize urgent issues
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/dashboard">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button onClick={() => setShowKBModal(true)}>
                <Upload className="mr-2 h-4 w-4" />
                KB Ingest
              </Button>
              <KBIngestModal
                open={showKBModal}
                onOpenChange={setShowKBModal}
                onIngest={handleKBIngest}
              />
              <AIResponseModal
                open={aiModalOpen}
                onClose={() => {
                  setAiModalOpen(false)
                  setAiResponse(null)
                  setCurrentAiTicket(null)
                }}
                response={aiResponse}
                ticketId={currentAiTicket || ''}
                onInsert={handleAiInsert}
                onEscalate={handleAiEscalate}
                onFeedback={handleAiFeedback}
              />
            </div>
          </div>
          
          {/* Refresh Controls */}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(lastRefresh).toLocaleTimeString()}
            </span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleManualRefresh}
              disabled={ticketsLoading || countsLoading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-red-600/5" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-red-600">
                {countsLoading ? (
                  <div className="h-8 bg-gray-200 rounded animate-pulse w-12"></div>
                ) : (
                  counts.needs_attention
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Urgent tickets requiring immediate action
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-blue-600/5" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium">Open/Active</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-blue-600">
                {countsLoading ? (
                  <div className="h-8 bg-gray-200 rounded animate-pulse w-12"></div>
                ) : (
                  counts.open_active
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently being worked on
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-orange-600/5" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium">Escalated</CardTitle>
              <User className="h-4 w-4 text-orange-600" />
            </CardHeader>
                    <CardContent className="relative">
            <div className="text-2xl font-bold text-orange-600">
              {countsLoading ? (
                <div className="h-8 bg-gray-200 rounded animate-pulse w-12"></div>
              ) : (
                counts.escalated
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Escalated to higher tiers
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-green-600/5" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium">Total Queue</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-green-600">
              {countsLoading ? (
                <div className="h-8 bg-gray-200 rounded animate-pulse w-12"></div>
              ) : (
                counts.all
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              All tickets in the system
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Queue Management */}
      <Card className="backdrop-blur-sm bg-card/40 border border-border/50">
        <CardHeader>
          <CardTitle>Queue Management</CardTitle>
          <CardDescription>
            Filter and manage your ticket queue efficiently
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Lane Tabs */}
            <Tabs value={currentLane} onValueChange={(value) => { setCurrentLane(value); setOffset(0) }}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="needs_attention" className="text-xs">
                  Needs Attention
                </TabsTrigger>
                <TabsTrigger value="open" className="text-xs">
                  Open/Active
                </TabsTrigger>
                <TabsTrigger value="escalated" className="text-xs">
                  Escalated
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs">
                  All Tickets
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search and Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search tickets by ID, title, or customer..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setOffset(0) }}
                  className="bg-background/50"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mine-only"
                    checked={mineOnly}
                    onCheckedChange={(checked) => { setMineOnly(checked as boolean); setOffset(0) }}
                  />
                  <label htmlFor="mine-only" className="text-sm font-medium">
                    My tickets only
                  </label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <m.div className="space-y-4" variants={v.list} initial="initial" animate="animate">
        {ticketsLoading && tickets.length === 0 ? (
          // Show skeleton loaders while loading
          Array.from({ length: 3 }).map((_, index) => (
            <TicketCardSkeleton key={`skeleton-${index}`} />
          ))
        ) : (
          tickets.map(ticket => (
            <m.div key={ticket.id} variants={v.item}>
              <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-200 bg-surface border">
                {ticket.needs_attention && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-danger" />
                )}
            <CardContent className="p-6">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-3">
                  {/* Title and Flagged Status */}
                  <div className="flex items-center gap-3">
                    <Link 
                      href={`/tickets/${ticket.id}`}
                      className="text-lg font-semibold text-primary hover:underline"
                    >
                      {ticket.title}
                    </Link>
                    {ticket.needs_attention && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        FLAGGED
                      </Badge>
                    )}
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-sm">
                    <StatusBadge status={ticket.status as "escalated" | "open" | "in_progress" | "resolved" | "closed"} />
                    <Badge variant={ticket.priority === 'high' ? 'destructive' : 
                                   ticket.priority === 'normal' ? 'default' : 'secondary'}>
                      {ticket.priority}
                    </Badge>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="h-3 w-3" />
                      {ticket.assignee_id ? 'Assigned' : 'Unassigned'}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      {ticket.message_count} messages
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(ticket.last_message_at)}
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                <RepActionBar
                  ticketId={ticket.id}
                  status={ticket.status as "open" | "resolved" | "closed" | "pending"}
                  priority={ticket.priority as "low" | "high" | "medium" | "urgent"}
                  quickActions={[
                    {
                      id: "respond",
                      label: "Respond",
                      description: "Send message to customer",
                      icon: MessageSquare,
                      color: "text-blue-500",
                      onClick: () => handleQuickRespond(ticket)
                    },
                    {
                      id: "call",
                      label: "Call",
                      description: "Start phone call",
                      icon: Phone,
                      color: "text-green-500",
                      onClick: () => handleQuickCall(ticket)
                    },
                    {
                      id: "email",
                      label: "Email",
                      description: "Send email update",
                      icon: Mail,
                      color: "text-purple-500",
                      onClick: () => handleQuickEmail(ticket)
                    },
                    {
                      id: "ai-assist",
                      label: (() => {
                        const cooldownEnd = aiCooldowns[ticket.id]
                        if (cooldownEnd && cooldownEnd > Date.now()) {
                          const remainingSeconds = Math.ceil((cooldownEnd - Date.now()) / 1000)
                          return `AI (${remainingSeconds}s)`
                        }
                        return "AI Assist"
                      })(),
                      description: (() => {
                        const cooldownEnd = aiCooldowns[ticket.id]
                        if (cooldownEnd && cooldownEnd > Date.now()) {
                          return "Rate limited - please wait"
                        }
                        return "Get AI suggestions"
                      })(),
                      icon: Bot,
                      color: (aiCooldowns[ticket.id] && aiCooldowns[ticket.id] > Date.now()) ? "text-muted-foreground" : "text-primary",
                      onClick: () => {
                        const cooldownEnd = aiCooldowns[ticket.id]
                        if (cooldownEnd && cooldownEnd > Date.now()) {
                          const remainingSeconds = Math.ceil((cooldownEnd - Date.now()) / 1000)
                          toast.error(`Please wait ${remainingSeconds} seconds`, { id: 'ai-cooldown-' + ticket.id })
                          return
                        }
                        handleQuickAI(ticket)
                      }
                    }
                  ]}
                  primaryActions={[
                    {
                      id: 'assign',
                      label: 'Assign to Me',
                      icon: User,
                      variant: 'secondary',
                      onClick: () => performAction(ticket.id, 'assign', {}),
                      disabled: actionLoading?.startsWith(ticket.id) || false
                    },
                    ...(ticket.needs_attention ? [{
                      id: 'acknowledge',
                      label: 'Acknowledge',
                      icon: CheckCircle,
                      variant: 'outline' as const,
                      onClick: () => performAction(ticket.id, 'acknowledge', {}),
                      disabled: actionLoading?.startsWith(ticket.id) || false
                    }] : []),
                    {
                      id: 'escalate',
                      label: 'Escalate',
                      icon: AlertTriangle,
                      variant: 'destructive',
                      onClick: () => handleEscalate(ticket.id),
                      disabled: actionLoading?.startsWith(ticket.id) || false
                    }
                  ]}
                />
                </div>
              </CardContent>
              </Card>
            </m.div>
          ))
        )}
      </m.div>

      {/* AI Assistant */}
      <AIMessage
        content="I'm here to help you manage your ticket queue efficiently. I can suggest prioritizations, provide insights on customer sentiment, and help draft responses."
        type="suggestion"
        onCopy={() => console.log("AI message copied")}
        onFeedback={(positive) => console.log("Feedback:", positive)}
        showActions={true}
      />

      {/* Pagination */}
      {total > limit && (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-center items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} tickets
              </div>
              <Button
                variant="outline"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </PageShell>
  )
}