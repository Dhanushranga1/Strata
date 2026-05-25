'use client';

import { useState, useEffect } from 'react';
import { MessageSquareQuote, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import api from '@/lib/api-client';

interface CannedResponse {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

interface CannedResponsePickerProps {
  orgId: string;
  onSelect: (body: string) => void;
}

export function CannedResponsePicker({
  orgId,
  onSelect,
}: CannedResponsePickerProps) {
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<CannedResponse[]>('/api/canned-responses', orgId)
      .then(setResponses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, orgId]);

  const filtered = query
    ? responses.filter(r => r.title.toLowerCase().includes(query.toLowerCase()))
    : responses;

  const handleSelect = (body: string) => {
    onSelect(body);
    setOpen(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Insert canned response">
          <MessageSquareQuote className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm">Canned Responses</DialogTitle>
        </DialogHeader>
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by title…"
              className="h-7 text-xs border-0 p-0 focus-visible:ring-0 shadow-none"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Loading…
            </p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              {query ? 'No matches' : 'No canned responses yet'}
            </p>
          )}
          {!loading &&
            filtered.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r.body)}
                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0"
              >
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {r.body}
                </p>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
