"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { FeatureGate } from "@/components/FeatureGate";
import { PageShell } from "@/ui/motion/PageShell";
import { m } from "framer-motion";
import { v } from "@/ui/motion/variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Save, X } from "lucide-react";

export default function NewArticlePage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!content.trim()) { setError("Content is required"); return; }
    setError(null);
    setSaving(true);
    try {
      const article = await api.post(
        "/api/knowbase/articles",
        { title, content, category: category || null, tags, is_published: isPublished, is_public: isPublic },
        orgId
      );
      router.push(`/knowbase/${article.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
      setSaving(false);
    }
  }

  return (
    <FeatureGate feature="know_base" requiredPlan="starter">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="max-w-3xl mx-auto space-y-6">
          {/* Nav */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.push("/knowbase")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              KnowBase
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Article
            </Button>
          </div>

          <h1 className="text-2xl font-bold">New Article</h1>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g. How to reset VPN credentials"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g. Network, Onboarding, Security"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Add a tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                />
                <Button variant="outline" type="button" onClick={addTag}>
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs bg-muted px-2.5 py-1 rounded-full"
                    >
                      {tag}
                      <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => removeTag(tag)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content * (Markdown supported)</Label>
              <Textarea
                id="content"
                placeholder="# Heading&#10;&#10;Write your article here…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={18}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Published</p>
                  <p className="text-xs text-muted-foreground">
                    Reps and customers can see published articles
                  </p>
                </div>
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Public (self-service)</p>
                  <p className="text-xs text-muted-foreground">
                    Visible in the self-service portal without login
                  </p>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  disabled={!isPublished}
                />
              </div>
            </div>
          </div>
        </m.div>
      </PageShell>
    </FeatureGate>
  );
}
