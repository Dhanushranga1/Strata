"use client";

import { useState, use } from "react";
import { Layers, Send, Search, CheckCircle2, AlertCircle, Loader2, ChevronRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

const CATEGORIES = ["Hardware", "Software", "Network", "Access / Accounts", "Printer", "Email", "Security", "Other"];
const PRIORITIES = [
  { value: 3, label: "Low — no rush" },
  { value: 4, label: "Normal" },
  { value: 5, label: "High — affecting my work" },
  { value: 6, label: "Urgent — work is stopped" },
];

interface OrgInfo {
  name: string;
  slug: string;
  support_email: string;
  portal_message: string;
}

interface SubmitForm {
  name: string;
  email: string;
  subject: string;
  description: string;
  category: string;
  priority: number;
}

interface SubmitResult {
  ref: string;
  ticket_id: string;
  message: string;
}

interface TicketStatus {
  ref: string;
  ticket_id: string;
  title: string;
  status: string;
  priority: number;
  created_at: string | null;
  updated_at: string | null;
  messages: { body: string; from_team: boolean; created_at: string | null }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open:        { label: "Open — awaiting reply",    color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  in_progress: { label: "In progress",              color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  escalated:   { label: "Escalated",                color: "text-red-400 bg-red-500/10 border-red-500/20" },
  resolved:    { label: "Resolved",                 color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  closed:      { label: "Closed",                   color: "text-muted-foreground bg-muted/50 border-border" },
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function CustomerPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [orgError, setOrgError] = useState("");
  const [orgLoading, setOrgLoading] = useState(true);

  // Fetch org info on mount
  useState(() => {
    fetch(`${API_BASE}/api/portal/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Portal not found");
        const d: OrgInfo = await r.json();
        setOrgInfo(d);
      })
      .catch(() => setOrgError("This support portal could not be found."))
      .finally(() => setOrgLoading(false));
  });

  const [tab, setTab] = useState<"submit" | "track">("submit");

  // ── Submit form ────────────────────────────────────────────────────────────
  const [form, setForm] = useState<SubmitForm>({
    name: "", email: "", subject: "", description: "", category: "", priority: 4,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_BASE}/api/portal/${slug}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: form.subject,
          description: form.description,
          category: form.category || null,
          priority: form.priority,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const result: SubmitResult = await res.json();
      setSubmitResult(result);
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Track form ────────────────────────────────────────────────────────────
  const [trackRef, setTrackRef] = useState("");
  const [trackEmail, setTrackEmail] = useState("");
  const [tracking, setTracking] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [trackError, setTrackError] = useState("");

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setTracking(true);
    setTrackError("");
    setTicketStatus(null);
    try {
      // Extract UUID from ref (last 8 chars → we need the full ID)
      // The portal returns ticket_id — user needs to enter full ref TKT-XXXXXXXX
      // We'll search by ref using the full ticket_id stored
      // For simplicity: let user enter the ticket_id or the TKT-XXXX ref
      // We pass it as the ticket_id path param; backend will match
      const id = trackRef.trim().toUpperCase().startsWith("TKT-")
        ? trackRef.trim().slice(4)   // strip TKT- prefix, use the 8-char suffix
        : trackRef.trim();

      // We need the full UUID. Since we only store/show last 8 chars,
      // we'll search by submitter_email + last 8 chars on the backend.
      // However our current backend takes the full UUID as path param.
      // Let's use a query param approach instead.
      const params = new URLSearchParams({ email: trackEmail });
      const res = await fetch(
        `${API_BASE}/api/portal/${slug}/tickets/${encodeURIComponent(id)}?${params}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Ticket not found — check your reference and email.");
      }
      const data: TicketStatus = await res.json();
      setTicketStatus(data);
    } catch (err: any) {
      setTrackError(err.message || "Ticket not found — check your reference and email.");
    } finally {
      setTracking(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="min-h-screen bg-[color:var(--bg)] flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h1 className="text-xl font-bold">Portal not found</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{orgError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[rgb(var(--text))] font-inter">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">{orgInfo?.name}</h1>
            <p className="text-xs text-muted-foreground">IT Support Portal</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">How can we help?</h2>
          {orgInfo?.portal_message ? (
            <p className="text-muted-foreground text-sm">{orgInfo.portal_message}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Submit a new request or check the status of an existing one.
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit mx-auto">
          {(["submit", "track"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "submit" ? <Send className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
              {t === "submit" ? "Submit a request" : "Track a request"}
            </button>
          ))}
        </div>

        {/* Submit tab */}
        {tab === "submit" && (
          <>
            {submitResult ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <div>
                  <p className="font-bold text-lg">Request received!</p>
                  <p className="text-muted-foreground text-sm mt-1">{submitResult.message}</p>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground">Your reference</span>
                  <span className="font-mono font-bold text-sm">{submitResult.ref}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Save this reference — you can use it to track your request on the "Track a request" tab.
                </p>
                <button
                  onClick={() => { setSubmitResult(null); setForm({ name: "", email: "", subject: "", description: "", category: "", priority: 4 }); }}
                  className="text-sm text-primary hover:underline"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" htmlFor="name">Your name <span className="text-red-400">*</span></label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" htmlFor="email">Email address <span className="text-red-400">*</span></label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="subject">Subject <span className="text-red-400">*</span></label>
                  <input
                    id="subject"
                    type="text"
                    required
                    value={form.subject}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Brief description of your issue"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" htmlFor="category">Category</label>
                    <select
                      id="category"
                      value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">— select —</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" htmlFor="priority">Priority</label>
                    <select
                      id="priority"
                      value={form.priority}
                      onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="description">
                    Description <span className="text-red-400">*</span>
                    <span className="text-muted-foreground font-normal ml-1">(please include as much detail as possible)</span>
                  </label>
                  <textarea
                    id="description"
                    required
                    rows={5}
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    placeholder="Describe the issue, what you were trying to do, any error messages…"
                  />
                  <p className="text-xs text-muted-foreground text-right">{form.description.length}/4000</p>
                </div>

                {submitError && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              </form>
            )}
          </>
        )}

        {/* Track tab */}
        {tab === "track" && (
          <div className="space-y-6">
            <form onSubmit={handleTrack} className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the reference you received when you submitted your request, along with your email address.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ref">Reference number <span className="text-red-400">*</span></label>
                <input
                  id="ref"
                  type="text"
                  required
                  value={trackRef}
                  onChange={e => setTrackRef(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. A1B2C3D4 or TKT-A1B2C3D4"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="track-email">Your email address <span className="text-red-400">*</span></label>
                <input
                  id="track-email"
                  type="email"
                  required
                  value={trackEmail}
                  onChange={e => setTrackEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="jane@company.com"
                />
              </div>

              {trackError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {trackError}
                </div>
              )}

              <button
                type="submit"
                disabled={tracking}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {tracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {tracking ? "Looking up…" : "Find my request"}
              </button>
            </form>

            {ticketStatus && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{ticketStatus.ref}</p>
                    <h3 className="font-semibold text-base mt-0.5">{ticketStatus.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted {formatDate(ticketStatus.created_at)}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-medium px-3 py-1.5 rounded-full border shrink-0",
                    STATUS_LABELS[ticketStatus.status]?.color ?? "text-muted-foreground bg-muted border-border"
                  )}>
                    {STATUS_LABELS[ticketStatus.status]?.label ?? ticketStatus.status}
                  </span>
                </div>

                {ticketStatus.messages.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Conversation
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {ticketStatus.messages.map((msg, i) => (
                        <div
                          key={i}
                          className={cn(
                            "rounded-xl p-3.5 text-sm",
                            msg.from_team
                              ? "bg-primary/10 border border-primary/20 ml-4"
                              : "bg-muted/40 border border-border mr-4"
                          )}
                        >
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            {msg.from_team ? "Support team" : "You"} · {formatDate(msg.created_at)}
                          </p>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ticketStatus.status === "resolved" && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    This request has been resolved. If you need further help, please submit a new request.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground/50 pb-4">
          Powered by <span className="font-medium">Strata</span>
        </div>
      </main>
    </div>
  );
}
