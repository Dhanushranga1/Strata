'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Lock,
  Tag,
  Star,
  CheckCircle2,
  X,
  ChevronLeft,
  Clock,
  User,
  AlertTriangle,
  MessageSquare,
  Bot,
  UserCheck,
  Phone,
  History,
} from 'lucide-react';
import { CannedResponsePicker } from '@/components/rep/CannedResponsePicker';
import { CustomFieldsPanel } from '@/components/rep/CustomFieldsPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { FeatureGate } from '@/components/FeatureGate';
import api from '@/lib/api-client';
import { supabase } from '@/lib/supabaseClient';

// ── Types ────────────────────────────────────────────────────────────────────

interface MessageOut {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  created_at: string;
  is_internal: boolean;
  meta?: any;
}

interface TicketDetail {
  id: string;
  created_by: string;
  assignee_id?: string;
  assignee_email?: string;
  assignee_display_name?: string;
  assignee_phone?: string;
  customer_email?: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  priority_level?: number;
  needs_attention: boolean;
  is_overdue: boolean;
  message_count: number;
  last_message_at: string;
  created_at: string;
  updated_at?: string;
  tags: string[];
  escalated_to?: string;
  escalated_to_email?: string;
  escalated_at?: string;
  expected_resolve_at?: string;
  resolved_at?: string;
  resolution_note?: string;
  customer_rating?: number;
}

interface TicketWithMessages {
  ticket: TicketDetail;
  messages: MessageOut[];
}

interface Citation {
  label: string;
  doc_id: string;
  chunk_id: string;
  faiss_id: number;
  score?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const isSystemMessage = (m: MessageOut) =>
  m.sender_role === 'system' || m.body.startsWith('[system]');

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatShort = (s: string) => {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
};

function ActivityTimeline({
  ticket,
  messages,
}: {
  ticket: TicketDetail;
  messages: MessageOut[];
}) {
  type Event = { ts: string; icon: string; label: string; sub?: string };
  const events: Event[] = [];

  events.push({
    ts: ticket.created_at,
    icon: '🎫',
    label: 'Ticket created',
    sub: ticket.priority,
  });

  messages
    .filter(m => isSystemMessage(m))
    .forEach(m => {
      const body = m.body.replace('[system]', '').trim();
      const icon = body.toLowerCase().includes('assign')
        ? '👤'
        : body.toLowerCase().includes('escalat')
          ? '🚨'
          : body.toLowerCase().includes('casper')
            ? '🤖'
            : '⚙️';
      events.push({ ts: m.created_at, icon, label: body.slice(0, 80) });
    });

  if (ticket.resolved_at)
    events.push({
      ts: ticket.resolved_at,
      icon: '✅',
      label: `Ticket ${ticket.status}`,
      sub: ticket.resolution_note?.slice(0, 60),
    });

  events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <History className="h-4 w-4" /> Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-4">
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3">
            {events.map((e, i) => (
              <div key={i} className="relative flex gap-2.5 items-start">
                <span className="absolute -left-4 w-3.5 h-3.5 bg-card border border-border rounded-full flex items-center justify-center text-[9px] shrink-0 mt-0.5">
                  {e.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-snug">{e.label}</p>
                  {e.sub && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {e.sub}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatShort(e.ts)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PRIORITY_LEVEL_COLORS: Record<number, string> = {
  1: 'bg-red-950/40 text-red-400 border border-red-800',
  2: 'bg-orange-950/40 text-orange-400 border border-orange-800',
  3: 'bg-yellow-950/40 text-yellow-400 border border-yellow-800',
  4: 'bg-blue-950/40 text-blue-400 border border-blue-800',
  5: 'bg-indigo-950/40 text-indigo-400 border border-indigo-800',
  6: 'bg-violet-950/40 text-violet-400 border border-violet-800',
  7: 'bg-zinc-800/60 text-zinc-400 border border-zinc-700',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function SystemMessage({ message }: { message: MessageOut }) {
  return (
    <div className="my-2 text-center">
      <span className="inline-block px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs">
        {message.body.replace('[system]', '').trim()}
      </span>
    </div>
  );
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={cn(
            'h-6 w-6 cursor-pointer transition-colors',
            (hovered || value) >= n
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-zinc-600'
          )}
          onMouseEnter={() => onChange && setHovered(n)}
          onMouseLeave={() => onChange && setHovered(0)}
          onClick={() => onChange?.(n)}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ticketId } = use(params);
  const router = useRouter();
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [ticketData, setTicketData] = useState<TicketWithMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Message composer
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  // AI chat
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const [showCitations, setShowCitations] = useState<Record<string, boolean>>(
    {}
  );
  const [showCitationTip, setShowCitationTip] = useState(true);

  // Feedback
  const [feedbackGiven, setFeedbackGiven] = useState<
    Record<string, 'positive' | 'negative'>
  >({});
  const [feedbackLoading, setFeedbackLoading] = useState<
    Record<string, boolean>
  >({});

  // Tags editing
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  // CSAT
  const [csat, setCsat] = useState(0);
  const [csatComment, setCsatComment] = useState('');
  const [csatSubmitted, setCsatSubmitted] = useState(false);

  // Assignment
  const [reps, setReps] = useState<
    { user_id: string; email: string; open_tickets: number }[]
  >([]);
  const [assigning, setAssigning] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadTicket = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError('');
      const data: TicketWithMessages = await api.get(
        `/api/tickets/${ticketId}`,
        orgId
      );
      setTicketData(data);
      if (data.ticket.customer_rating) {
        setCsat(data.ticket.customer_rating);
        setCsatSubmitted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      try {
        const u = await api.get('/api/me');
        setCurrentUser(u);
      } catch {
        /* ignore */
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (isReady && orgId) loadTicket();
  }, [ticketId, isReady, orgId]);

  useEffect(() => {
    const userIsRep =
      currentUser?.role === 'rep' || currentUser?.role === 'admin';
    if (isReady && orgId && userIsRep) {
      api
        .get<{
          reps: { user_id: string; email: string; open_tickets: number }[];
        }>('/api/rep/workload', orgId)
        .then(d => setReps(d.reps))
        .catch(() => {});
    }
  }, [isReady, orgId, currentUser]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isRep = currentUser?.role === 'rep' || currentUser?.role === 'admin';
  const ticket = ticketData?.ticket;
  const messages = ticketData?.messages ?? [];
  const isOwner = ticket && currentUser && ticket.created_by === currentUser.id;
  const canCompose = ticket && !['resolved', 'closed'].includes(ticket.status);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !orgId) return;
    try {
      setSending(true);
      await api.post(
        `/api/tickets/${ticketId}/messages`,
        {
          body: newMessage.trim(),
          is_internal: isInternal,
        },
        orgId
      );
      toast.success(isInternal ? 'Internal note saved' : 'Message sent');
      setNewMessage('');
      setIsInternal(false);
      await loadTicket();
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }),
        100
      );
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || !orgId) return;
    try {
      setAiLoading(true);
      toast.loading('AI is thinking…', { id: 'ai' });
      await api.post(
        `/api/tickets/${ticketId}/chat`,
        { query: aiQuery.trim() },
        orgId
      );
      toast.success('AI responded!', { id: 'ai' });
      setAiQuery('');
      await loadTicket();
    } catch (err) {
      toast.error('Failed to get AI response', { id: 'ai' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleFeedback = async (
    messageId: string,
    feedbackType: 'positive' | 'negative'
  ) => {
    if (feedbackGiven[messageId] || !orgId) return;
    try {
      setFeedbackLoading(prev => ({ ...prev, [messageId]: true }));
      await api.post(
        '/api/ai/feedback',
        { message_id: messageId, feedback_type: feedbackType },
        orgId
      );
      setFeedbackGiven(prev => ({ ...prev, [messageId]: feedbackType }));
    } catch {
      /* ignore */
    } finally {
      setFeedbackLoading(prev => ({ ...prev, [messageId]: false }));
    }
  };

  const handleAddTag = async () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || !ticket || !orgId) return;
    if (ticket.tags.includes(tag)) {
      setTagInput('');
      return;
    }
    const newTags = [...ticket.tags, tag];
    try {
      setSavingTags(true);
      await api.patch(
        `/api/tickets/${ticketId}/tags`,
        { tags: newTags },
        orgId
      );
      setTicketData(prev =>
        prev ? { ...prev, ticket: { ...prev.ticket, tags: newTags } } : prev
      );
      setTagInput('');
    } catch {
      toast.error('Failed to save tag');
    } finally {
      setSavingTags(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!ticket || !orgId) return;
    const newTags = ticket.tags.filter(t => t !== tag);
    try {
      setSavingTags(true);
      await api.patch(
        `/api/tickets/${ticketId}/tags`,
        { tags: newTags },
        orgId
      );
      setTicketData(prev =>
        prev ? { ...prev, ticket: { ...prev.ticket, tags: newTags } } : prev
      );
    } catch {
      toast.error('Failed to remove tag');
    } finally {
      setSavingTags(false);
    }
  };

  const handleResolve = async () => {
    if (!orgId) return;
    try {
      setResolving(true);
      await api.post(
        `/api/tickets/${ticketId}/resolve`,
        {
          status: 'resolved',
          resolution_note: resolveNote || null,
        },
        orgId
      );
      toast.success('Ticket resolved');
      setResolveOpen(false);
      await loadTicket();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve ticket');
    } finally {
      setResolving(false);
    }
  };

  const handleAssign = async (repId: string) => {
    if (!orgId) return;
    try {
      setAssigning(true);
      await api.post(
        `/api/rep/tickets/${ticketId}/assign`,
        { assignee_id: repId },
        orgId
      );
      toast.success('Ticket assigned');
      await loadTicket();
      // refresh workload counts
      api
        .get<{
          reps: { user_id: string; email: string; open_tickets: number }[];
        }>('/api/rep/workload', orgId)
        .then(d => setReps(d.reps))
        .catch(() => {});
    } catch {
      toast.error('Failed to assign ticket');
    } finally {
      setAssigning(false);
    }
  };

  const handleCsatSubmit = async (rating: number) => {
    if (!orgId || csatSubmitted) return;
    try {
      await api.post(
        `/api/tickets/${ticketId}/rating`,
        { rating, comment: csatComment || undefined },
        orgId
      );
      setCsat(rating);
      setCsatSubmitted(true);
      toast.success('Thanks for your feedback!');
    } catch {
      toast.error('Failed to submit rating');
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !ticketData) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-950/30 border border-red-800 text-red-400 px-4 py-3 rounded mb-4">
          {error || 'Ticket not found'}
        </div>
        <Button variant="ghost" onClick={() => router.push('/tickets')}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to tickets
        </Button>
      </div>
    );
  }

  // Narrow ticket — guaranteed non-null after the !ticketData guard above
  if (!ticket) return null;

  const visibleMessages = messages.filter(
    m => showSystemMessages || !isSystemMessage(m)
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Back nav */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tickets">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to tickets
          </Link>
        </Button>
      </div>

      {/* Ticket header */}
      <div className="bg-card border rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold mb-2">
              {ticket.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
                #{ticket.id.slice(0, 8)}
              </span>
              <span>Created {formatShort(ticket.created_at)}</span>
              {ticket.customer_email && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" /> {ticket.customer_email}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={ticket.status as any} />
            {ticket.is_overdue && (
              <Badge variant="destructive" className="text-xs">
                OVERDUE
              </Badge>
            )}
            {ticket.needs_attention && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" /> FLAGGED
              </Badge>
            )}
            {ticket.priority_level != null && (
              <span
                className={cn(
                  'text-xs font-semibold px-1.5 py-0.5 rounded',
                  PRIORITY_LEVEL_COLORS[ticket.priority_level!]
                )}
              >
                P{ticket.priority_level}
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {ticket.tags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-full"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
              {isRep && (
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-destructive ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {isRep && (
            <div className="flex items-center gap-1">
              <Input
                className="h-6 text-xs w-24 px-2"
                placeholder="add tag…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e =>
                  e.key === 'Enter' && (e.preventDefault(), handleAddTag())
                }
                disabled={savingTags}
              />
              {tagInput && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={handleAddTag}
                  disabled={savingTags}
                >
                  Add
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="border-t pt-3">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {ticket.description}
          </p>
        </div>

        {/* Resolution note (visible when resolved) */}
        {ticket.resolution_note && (
          <div className="mt-3 bg-emerald-950/20 border border-emerald-800/50 rounded-lg p-3">
            <p className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolution note
            </p>
            <p className="text-sm text-emerald-200">{ticket.resolution_note}</p>
          </div>
        )}
      </div>

      {/* Rep contact card — shown to clients when a rep is assigned */}
      {!isRep &&
        ticket.assignee_id &&
        (ticket.assignee_email || ticket.assignee_display_name) && (
          <div className="bg-card border rounded-xl p-4 mb-2 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">
                {(ticket.assignee_display_name ||
                  ticket.assignee_email ||
                  'R')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                Your Support Rep
              </p>
              <p className="text-sm font-medium">
                {ticket.assignee_display_name || ticket.assignee_email}
              </p>
              {ticket.assignee_display_name && ticket.assignee_email && (
                <p className="text-xs text-muted-foreground">
                  {ticket.assignee_email}
                </p>
              )}
            </div>
            {ticket.assignee_phone && (
              <a
                href={`tel:${ticket.assignee_phone}`}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
              >
                <Phone className="h-3.5 w-3.5" />
                {ticket.assignee_phone}
              </a>
            )}
          </div>
        )}

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages — left/main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Thread header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversation ({messages.filter(m => !isSystemMessage(m)).length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSystemMessages(!showSystemMessages)}
            >
              {showSystemMessages ? (
                <EyeOff className="h-4 w-4 mr-1" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              {showSystemMessages ? 'Hide' : 'Show'} system logs
            </Button>
          </div>

          {/* Message list */}
          <div className="space-y-3">
            {visibleMessages.map(message =>
              isSystemMessage(message) ? (
                <SystemMessage key={message.id} message={message} />
              ) : (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-xl border p-4',
                    message.is_internal
                      ? 'bg-amber-950/20 border-amber-800/50'
                      : message.sender_role === 'ai'
                        ? 'bg-violet-950/20 border-violet-800/50'
                        : message.sender_role === 'rep' ||
                            message.sender_role === 'admin'
                          ? 'bg-blue-950/20 border-blue-800/50'
                          : 'bg-card'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                        message.sender_role === 'ai'
                          ? 'bg-violet-900/50 text-violet-300'
                          : message.sender_role === 'rep' ||
                              message.sender_role === 'admin'
                            ? 'bg-blue-900/50 text-blue-300'
                            : 'bg-zinc-800 text-zinc-300'
                      )}
                    >
                      {message.sender_role === 'ai' ? (
                        <Bot className="h-4 w-4" />
                      ) : message.sender_role === 'rep' ||
                        message.sender_role === 'admin' ? (
                        'R'
                      ) : (
                        'U'
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-medium">
                          {message.sender_role === 'ai'
                            ? 'AI Assistant'
                            : message.sender_role === 'rep' ||
                                message.sender_role === 'admin'
                              ? 'Support Rep'
                              : 'Customer'}
                        </span>
                        {message.is_internal && (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-700 text-amber-400 bg-amber-950/30"
                          >
                            <Lock className="h-2.5 w-2.5 mr-1" /> Internal note
                          </Badge>
                        )}
                        {message.sender_role === 'ai' &&
                          message.meta?.confidence != null && (
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded font-medium',
                                message.meta.confidence >= 0.7
                                  ? 'bg-green-950/40 text-green-400'
                                  : message.meta.confidence >= 0.4
                                    ? 'bg-yellow-950/40 text-yellow-400'
                                    : 'bg-red-950/40 text-red-400'
                              )}
                            >
                              {Math.round(message.meta.confidence * 100)}%
                              confidence
                            </span>
                          )}
                        <span className="text-xs text-muted-foreground">
                          {formatShort(message.created_at)}
                        </span>
                      </div>

                      {/* Low-confidence escalation prompt */}
                      {message.sender_role === 'ai' &&
                        message.meta?.suggest_escalation && (
                          <div className="mb-2 p-2 bg-yellow-950/30 border border-yellow-800/50 rounded text-xs text-yellow-400 flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            Low confidence — consider requesting human help.
                          </div>
                        )}

                      {/* Body */}
                      <p className="text-sm whitespace-pre-wrap">
                        {message.body}
                      </p>

                      {/* AI feedback */}
                      {message.sender_role === 'ai' && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            Helpful?
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              'h-7 px-2',
                              feedbackGiven[message.id] === 'positive' &&
                                'bg-green-950/40 text-green-400'
                            )}
                            disabled={
                              !!feedbackGiven[message.id] ||
                              feedbackLoading[message.id]
                            }
                            onClick={() =>
                              handleFeedback(message.id, 'positive')
                            }
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              'h-7 px-2',
                              feedbackGiven[message.id] === 'negative' &&
                                'bg-red-950/40 text-red-400'
                            )}
                            disabled={
                              !!feedbackGiven[message.id] ||
                              feedbackLoading[message.id]
                            }
                            onClick={() =>
                              handleFeedback(message.id, 'negative')
                            }
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </Button>
                          {feedbackGiven[message.id] && (
                            <span className="text-xs text-muted-foreground">
                              Thanks!
                            </span>
                          )}
                        </div>
                      )}

                      {/* AI citations */}
                      {message.sender_role === 'ai' &&
                        message.meta?.citations?.length > 0 && (
                          <div className="mt-2">
                            {showCitationTip && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mb-2 p-2 bg-blue-950/30 border border-blue-800/50 rounded text-xs text-blue-300 flex items-center gap-2"
                              >
                                <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                                Sources from the knowledge base are shown below.
                                <button
                                  onClick={() => setShowCitationTip(false)}
                                  className="ml-auto text-blue-400 font-medium"
                                >
                                  Got it
                                </button>
                              </motion.div>
                            )}
                            <button
                              onClick={() =>
                                setShowCitations(prev => ({
                                  ...prev,
                                  [message.id]: !prev[message.id],
                                }))
                              }
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {showCitations[message.id] ? '▼ Hide' : '▶ Show'}{' '}
                              sources ({message.meta.citations.length})
                            </button>
                            {showCitations[message.id] && (
                              <ul className="mt-1 p-2 bg-[rgb(var(--surface2))] rounded text-xs text-muted-foreground space-y-1">
                                {message.meta.citations.map(
                                  (c: Citation, i: number) => (
                                    <li
                                      key={i}
                                      className="flex justify-between"
                                    >
                                      <span>{c.label}</span>
                                      {c.score && (
                                        <span className="text-muted-foreground">
                                          {Math.round(c.score * 100)}%
                                        </span>
                                      )}
                                    </li>
                                  )
                                )}
                              </ul>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </motion.div>
              )
            )}
            <div ref={bottomRef} />
          </div>

          {/* AI Chat */}
          {canCompose && (
            <FeatureGate feature="ai_rag" description="AI Assistant requires Starter plan or above.">
              <div className="bg-violet-950/20 border border-violet-800/50 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-violet-300">
                  <Bot className="h-4 w-4" /> Ask AI Assistant
                </h3>
                <form onSubmit={handleAskAI} className="flex gap-2">
                  <Textarea
                    value={aiQuery}
                    onChange={e => setAiQuery(e.target.value)}
                    placeholder="Ask the AI assistant about this issue…"
                    rows={2}
                    maxLength={1000}
                    disabled={aiLoading}
                    className="flex-1 resize-none text-sm"
                  />
                  <Button type="submit" disabled={aiLoading || !aiQuery.trim()} className="self-end">
                    {aiLoading ? '…' : 'Ask'}
                  </Button>
                </form>
              </div>
            </FeatureGate>
          )}

          {/* Message composer */}
          {canCompose && (
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  {isRep
                    ? isInternal
                      ? '📝 Internal note (not visible to customer)'
                      : '💬 Reply to customer'
                    : '💬 Add a message'}
                </h3>
                {isRep && (
                  <div className="flex items-center gap-2">
                    {orgId && (
                      <CannedResponsePicker
                        orgId={orgId}
                        onSelect={body => setNewMessage(body)}
                      />
                    )}
                    <Button
                      variant={isInternal ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setIsInternal(p => !p)}
                      className={cn(
                        'text-xs',
                        isInternal &&
                          'bg-amber-500 hover:bg-amber-600 text-white'
                      )}
                    >
                      <Lock className="h-3 w-3 mr-1" />
                      {isInternal ? 'Internal' : 'Public'}
                    </Button>
                  </div>
                )}
              </div>
              <form onSubmit={handleSendMessage} className="space-y-3">
                <Textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={
                    isInternal
                      ? 'Private note (only reps see this)…'
                      : 'Type your message…'
                  }
                  rows={4}
                  maxLength={8000}
                  required
                  className={cn(
                    'text-sm resize-none',
                    isInternal && 'bg-amber-950/20 border-amber-800/60'
                  )}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {newMessage.length}/8000
                  </span>
                  <Button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                  >
                    {sending
                      ? 'Sending…'
                      : isInternal
                        ? 'Save note'
                        : 'Send message'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Closed state */}
          {ticket &&
            ['closed', 'resolved'].includes(ticket.status) &&
            !canCompose && (
              <div className="bg-muted rounded-xl p-6 text-center text-muted-foreground text-sm">
                This ticket is {ticket.status}.
                {!isRep && ticket.status === 'resolved' && !csatSubmitted && (
                  <div className="mt-4 space-y-3">
                    <p className="font-medium text-foreground">
                      How satisfied are you with the resolution?
                    </p>
                    <div className="flex justify-center">
                      <StarRating value={csat} onChange={v => setCsat(v)} />
                    </div>
                    <Textarea
                      value={csatComment}
                      onChange={e => setCsatComment(e.target.value)}
                      placeholder="Optional comment…"
                      rows={2}
                      maxLength={500}
                      className="text-sm resize-none"
                    />
                    <Button
                      size="sm"
                      disabled={csat === 0}
                      onClick={() => handleCsatSubmit(csat)}
                      className="w-full"
                    >
                      Submit Feedback
                    </Button>
                  </div>
                )}
                {!isRep && csatSubmitted && (
                  <div className="mt-3 text-emerald-600 font-medium">
                    ⭐ Thank you for rating ({csat}/5)
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Sidebar — right column */}
        <div className="space-y-4">
          {/* Ticket metadata */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={ticket.status as any} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span className="capitalize font-medium">
                  {ticket.priority}
                </span>
              </div>
              {ticket.priority_level != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Level</span>
                  <span
                    className={cn(
                      'text-xs font-semibold px-1.5 py-0.5 rounded',
                      PRIORITY_LEVEL_COLORS[ticket.priority_level!]
                    )}
                  >
                    P{ticket.priority_level}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assignee</span>
                <span className="font-medium text-right max-w-[140px] truncate">
                  {ticket.assignee_email ?? 'Unassigned'}
                </span>
              </div>
              {ticket.expected_resolve_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ETR</span>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      new Date(ticket.expected_resolve_at) < new Date()
                        ? 'text-red-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    {new Date(ticket.expected_resolve_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              {ticket.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved</span>
                  <span className="text-emerald-600 text-xs">
                    {formatShort(ticket.resolved_at)}
                  </span>
                </div>
              )}
              {ticket.customer_rating && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">CSAT</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        className={cn(
                          'h-3.5 w-3.5',
                          n <= ticket.customer_rating!
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-zinc-700'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-xs">{formatDate(ticket.created_at)}</span>
              </div>
              {ticket.escalated_to_email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Escalated to</span>
                  <span className="text-orange-600 text-xs truncate max-w-[140px]">
                    {ticket.escalated_to_email}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Fields */}
          {orgId && <CustomFieldsPanel ticketId={ticketId} orgId={orgId} />}

          {/* Activity Timeline */}
          <ActivityTimeline ticket={ticket} messages={messages} />

          {/* Rep actions */}
          {isRep && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Assign to rep */}
                {!['resolved', 'closed'].includes(ticket.status) &&
                  reps.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> Assign to rep
                      </p>
                      <select
                        aria-label="Assign ticket to rep"
                        className="w-full text-xs bg-[rgb(var(--surface2))] border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
                        value={ticket.assignee_id ?? ''}
                        disabled={assigning}
                        onChange={e =>
                          e.target.value && handleAssign(e.target.value)
                        }
                      >
                        <option value="">— Unassigned —</option>
                        {reps.map(r => (
                          <option key={r.user_id} value={r.user_id}>
                            {r.email} ({r.open_tickets} open)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                {!['resolved', 'closed'].includes(ticket.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-emerald-400 border-emerald-800 hover:bg-emerald-950/30"
                    onClick={() => setResolveOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Resolve ticket
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <Link href="/rep">← Rep Console</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Resolve dialog */}
      {resolveOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border shadow-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Resolve
              ticket
            </h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Resolution note (optional)
              </label>
              <Textarea
                rows={3}
                placeholder="Summarise how this was resolved (sent to customer)…"
                value={resolveNote}
                onChange={e => setResolveNote(e.target.value)}
                maxLength={2000}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setResolveOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                disabled={resolving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {resolving ? 'Resolving…' : 'Mark resolved'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
