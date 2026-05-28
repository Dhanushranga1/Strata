"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Loader2, Package, FileText, Ticket, BookOpen, X } from "lucide-react";
import api from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface EntityCard {
  entity_type: string;
  entity_id: string;
  label: string;
  score: number;
  href: string;
  namespace: string;
}

interface QueryResult {
  results: EntityCard[];
  query: string;
}

const NS_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  asset:           { icon: Package,  color: "text-blue-400",   label: "Asset" },
  contract:        { icon: FileText, color: "text-emerald-400",label: "Contract" },
  knowbase_article:{ icon: BookOpen, color: "text-indigo-400", label: "Article" },
  kb_chunk:        { icon: BookOpen, color: "text-indigo-400", label: "KB" },
  resolved_ticket: { icon: Ticket,   color: "text-violet-400", label: "Ticket" },
};

function ResultCard({ card, onNavigate }: { card: EntityCard; onNavigate: (href: string) => void }) {
  const ns = NS_CONFIG[card.namespace] ?? NS_CONFIG[card.entity_type] ?? { icon: Search, color: "text-muted-foreground", label: card.entity_type };
  const Icon = ns.icon;
  return (
    <button
      onClick={() => onNavigate(card.href)}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/60 transition-colors text-left"
    >
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", ns.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{card.label}</p>
        <p className="text-xs text-muted-foreground">{ns.label}</p>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0 mt-1">
        {Math.round(card.score * 100)}%
      </span>
    </button>
  );
}

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => { setMounted(true); }, []);

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(""); setResults([]); }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api.post<QueryResult>("/api/casper/query", { query: q, top_k: 5 });
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!mounted) return null;

  const trigger = (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background/60 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <Search className="w-3.5 h-3.5" />
      <span className="hidden sm:block">Search everything…</span>
      <kbd className="hidden sm:block text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono">⌘K</kbd>
    </button>
  );

  const modal = open ? (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center pt-[15vh] px-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {loading
            ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
            : <Search className="w-4 h-4 text-muted-foreground shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search tickets, assets, contracts, articles…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && !loading && query.trim() && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No results for &ldquo;{query}&rdquo;</p>
          )}
          {results.length === 0 && !loading && !query.trim() && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Ask anything — CASPER searches across all your data
            </p>
          )}
          {results.map((card) => (
            <ResultCard key={`${card.namespace}-${card.entity_id}`} card={card} onNavigate={navigate} />
          ))}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} · Powered by CASPER
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {createPortal(modal, document.body)}
    </>
  );
}
