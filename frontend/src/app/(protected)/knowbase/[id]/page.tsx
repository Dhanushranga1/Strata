"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { FeatureGate } from "@/components/FeatureGate";
import { PageShell } from "@/ui/motion/PageShell";
import { m } from "framer-motion";
import { v } from "@/ui/motion/variants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ThumbsUp,
  Eye,
  FolderOpen,
  User,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ArticleOut {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  author_id: string | null;
  author_email: string | null;
  is_published: boolean;
  is_public: boolean;
  view_count: number;
  helpful_votes: number;
  created_at: string;
  updated_at: string;
}

// Minimal markdown renderer — replaces headings, bold, italic, code blocks, inline code, lists
function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hup])(.+)$/gm, "<p>$1</p>");
}

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentOrganization, isReady, user } = useOrganization();
  const orgId = currentOrganization?.id;
  const [voted, setVoted] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isRep = user?.role === "rep" || user?.role === "admin";

  const key = isReady && orgId ? `/api/knowbase/articles/${id}` : null;
  const {
    data: article,
    isLoading,
    error,
    mutate,
  } = useSWR<ArticleOut>(key, () => api.get(`/api/knowbase/articles/${id}`, orgId));

  async function handleHelpful() {
    if (voted) return;
    try {
      await api.post(`/api/knowbase/articles/${id}/helpful`, {}, orgId);
      setVoted(true);
      mutate();
    } catch {}
  }

  async function handleDelete() {
    if (!confirm("Delete this article? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/api/knowbase/articles/${id}`, orgId);
      router.push("/knowbase");
    } catch {
      setDeleting(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <FeatureGate feature="know_base" requiredPlan="starter">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="max-w-3xl mx-auto space-y-6">
          {/* Nav */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/knowbase")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              KnowBase
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-24 text-destructive gap-2">
              <AlertCircle className="h-5 w-5" />
              Article not found
            </div>
          ) : article ? (
            <>
              {/* Title + metadata */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>
                  {isRep && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/knowbase/${id}/edit`)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {!article.is_published && (
                    <Badge variant="outline">Draft</Badge>
                  )}
                  {article.is_public && (
                    <Badge variant="secondary">Public</Badge>
                  )}
                  {article.category && (
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      {article.category}
                    </span>
                  )}
                  {article.author_email && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {article.author_email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated {formatDate(article.updated_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {article.view_count} views
                  </span>
                </div>

                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-muted px-2.5 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <div
                className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-card p-6"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
              />

              {/* Helpful vote */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground border-t pt-4">
                <span>Was this article helpful?</span>
                <Button
                  variant={voted ? "default" : "outline"}
                  size="sm"
                  onClick={handleHelpful}
                  disabled={voted}
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  {voted ? "Thanks!" : "Yes"} ({article.helpful_votes + (voted ? 1 : 0)})
                </Button>
              </div>
            </>
          ) : null}
        </m.div>
      </PageShell>
    </FeatureGate>
  );
}
