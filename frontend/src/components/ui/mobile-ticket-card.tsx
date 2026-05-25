import { Card, CardContent, CardHeader } from './card';
import { StatusBadge } from '../StatusBadge';
import { Badge } from './badge';
import { Clock, MessageSquare, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface TicketSummary {
  id: string;
  title: string;
  status: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

interface MobileTicketCardProps {
  ticket: TicketSummary;
  className?: string;
}

export function MobileTicketCard({ ticket, className }: MobileTicketCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Link href={`/tickets/${ticket.id}`}>
      <Card
        className={cn(
          'hover:border-primary/50 transition-all active:scale-[0.98]',
          'cursor-pointer touch-manipulation',
          className
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-base line-clamp-2 mb-2">
                {ticket.title}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                #{ticket.id.slice(0, 8)}
              </p>
            </div>
            <StatusBadge
              status={
                ticket.status as
                  | 'open'
                  | 'resolved'
                  | 'closed'
                  | 'in_progress'
                  | 'escalated'
              }
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {/* Message count */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>{ticket.message_count}</span>
              </div>

              {/* Time */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formatDate(ticket.created_at)}</span>
              </div>
            </div>

            {/* View icon */}
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
