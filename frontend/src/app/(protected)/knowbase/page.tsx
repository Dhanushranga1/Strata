"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { FeatureGate } from "@/components/FeatureGate";
import { PageShell } from "@/ui/motion/PageShell";
import { m } from "framer-motion";
import { v } from "@/ui/motion/variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookMarked,
  Plus,
  Search,
  Eye,
  ThumbsUp,
  FolderOpen,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ArticleSummary {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  is_published: boolean;
  is_public: boolean;
  view_count: number;
  helpful_votes: number;
  created_at: string;
  updated_at: string;
}

interface KnowBaseStats {
  total: number;
  published: number;
  categories: string[];
}

export default function KnowBasePage() {
  const router = useRouter();
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const statsKey = isReady && orgId ? `/api/knowbase/stats?_org=${orgId}` : null;
  const { data: stats } = useSWR<KnowBaseStats>(statsKey, () =>
    api.get("/api/knowbase/stats", orgId)
  );

  const articlesKey =
    isReady && orgId
      ? ["knowbase-articles", orgId, search, category]
      : null;
  const {
    data: articles,
    isLoading,
    error,
  } = useSWR<ArticleSummary[]>(articlesKey, async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("q", search);
    if (category) params.set("category", category);
    return api.get(`/api/knowbase/articles?${params}`, orgId);
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <FeatureGate
      feature="know_base"
      requiredPlan="starter"
      description="Create and manage internal SOPs, runbooks, and how-to guides."
    >
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BookMarked className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">KnowBase</h1>
                <p className="text-sm text-muted-foreground">
                  SOPs, runbooks, and how-to guides
                </p>
              </div>
            </div>
            <Button onClick={() => router.push("/knowbase/new")}>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Total articles</p>
                  <p className="text-xl font-semibold">{stats?.total ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Published</p>
                  <p className="text-xl font-semibold">{stats?.published ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Categories</p>
                  <p className="text-xl font-semibold">{stats?.categories.length ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search articles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  category === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                All
              </button>
              {stats?.categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat === category ? null : cat)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    category === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Article list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading articles…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-destructive gap-2">
              <AlertCircle className="h-5 w-5" />
              Failed to load articles
            </div>
          ) : !articles || articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center text-muted-foreground">
              <BookMarked className="h-12 w-12 opacity-30" />
              <p className="font-medium">No articles yet</p>
              <p className="text-sm">
                Create your first SOP, runbook, or how-to guide.
              </p>
              <Button variant="outline" onClick={() => router.push("/knowbase/new")}>
                <Plus className="h-4 w-4 mr-2" />
                New Article
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map((article) => (
                <button
                  type="button"
                  key={article.id}
                  onClick={() => router.push(`/knowbase/${article.id}`)}
                  className="w-full text-left rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                          {article.title}
                        </span>
                        {!article.is_published && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Draft
                          </Badge>
                        )}
                        {article.is_public && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Public
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {article.category && (
                          <span className="flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            {article.category}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {article.helpful_votes}
                        </span>
                        <span>Updated {formatDate(article.updated_at)}</span>
                      </div>
                      {article.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {article.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs bg-muted px-2 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </m.div>
      </PageShell>
    </FeatureGate>
  );
}
