"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Plus, Clock, CheckCircle2, Loader2, ChevronDown, ChevronUp, Shield } from "lucide-react";
import api from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  ts: string;
  actor_id: string;
  action: string;
  status_change?: string;
}

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  commander_email: string | null;
  root_cause: string | null;
  resolution: string | null;
  timeline: TimelineEntry[];
  affected_services: string[];
  linked_ticket_ids: string[];
  declared_at: string | null;
  resolved_at: string | null;
  postmortem_done: boolean;
  duration_minutes: number | null;
}

const SEV_CONFIG: Record<string, { label: string; className: string }> = {
  p1: { label: "P1 Critical", className: "bg-red-500/20 text-red-400 border border-red-500/40" },
  p2: { label: "P2 High",     className: "bg-orange-500/20 text-orange-400 border border-orange-500/40" },
  p3: { label: "P3 Medium",   className: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40" },
  p4: { label: "P4 Low",      className: "bg-blue-500/20 text-blue-400 border border-blue-500/40" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:        { label: "Active",        className: "bg-red-500/20 text-red-400" },
  investigating: { label: "Investigating", className: "bg-orange-500/20 text-orange-400" },
  identified:    { label: "Identified",    className: "bg-yellow-500/20 text-yellow-400" },
  monitoring:    { label: "Monitoring",    className: "bg-blue-500/20 text-blue-400" },
  resolved:      { label: "Resolved",      className: "bg-green-500/20 text-green-400" },
};

function formatTs(ts: string) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function DurationBadge({ minutes }: { minutes: number | null }) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <span className="text-xs text-muted-foreground">
      {h > 0 ? `${h}h ${m}m` : `${m}m`}
    </span>
  );
}

function IncidentRow({ inc, onRefresh }: { inc: Incident; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sev = SEV_CONFIG[inc.severity] ?? { label: inc.severity, className: "bg-muted text-muted-foreground" };
  const st  = STATUS_CONFIG[inc.status] ?? { label: inc.status, className: "bg-muted text-muted-foreground" };

  const addUpdate = async () => {
    if (!updateMsg.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/api/incidents/${inc.id}/update`, {
        message: updateMsg,
        new_status: newStatus || undefined,
      });
      setUpdateMsg("");
      setNewStatus("");
      onRefresh();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  const resolve = async () => {
    if (!resolution.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/api/incidents/${inc.id}/resolve`, { resolution });
      setResolution("");
      onRefresh();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <AlertTriangle className={cn("w-5 h-5 mt-0.5 shrink-0",
          inc.severity === "p1" ? "text-red-400" :
          inc.severity === "p2" ? "text-orange-400" : "text-yellow-400"
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{inc.title}</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", sev.className)}>{sev.label}</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", st.className)}>{st.label}</span>
            {inc.postmortem_done && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-500/15 text-green-400">PM done</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {inc.commander_email && <span>Commander: {inc.commander_email}</span>}
            {inc.declared_at && <span>Declared: {formatTs(inc.declared_at)}</span>}
            <DurationBadge minutes={inc.duration_minutes} />
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 space-y-4">
          {inc.description && (
            <p className="text-sm text-muted-foreground pt-3">{inc.description}</p>
          )}

          {inc.affected_services.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {inc.affected_services.map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{s}</span>
              ))}
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timeline</p>
            <div className="space-y-2">
              {[...inc.timeline].reverse().map((entry, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32">{formatTs(entry.ts)}</span>
                  <span className={cn("flex-1", entry.status_change && "font-medium")}>{entry.action}</span>
                  {entry.status_change && (
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                      STATUS_CONFIG[entry.status_change]?.className ?? "bg-muted text-muted-foreground"
                    )}>→ {entry.status_change}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {inc.status !== "resolved" && (
            <>
              {/* Add Update */}
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Post Update</p>
                <textarea
                  value={updateMsg}
                  onChange={(e) => setUpdateMsg(e.target.value)}
                  placeholder="Describe what's happening..."
                  rows={2}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <div className="flex gap-2 items-center">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="text-sm bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Keep status</option>
                    <option value="investigating">Investigating</option>
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                  </select>
                  <button
                    onClick={addUpdate}
                    disabled={submitting || !updateMsg.trim()}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Post
                  </button>
                </div>
              </div>

              {/* Resolve */}
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolve Incident</p>
                <div className="flex gap-2">
                  <input
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Brief resolution summary..."
                    className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={resolve}
                    disabled={submitting || !resolution.trim()}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolve
                  </button>
                </div>
              </div>
            </>
          )}

          {inc.resolution && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-sm text-green-400">
              <strong>Resolution:</strong> {inc.resolution}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeclareModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", severity: "p2", affected_services: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/incidents", {
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
        affected_services: form.affected_services ? form.affected_services.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      onCreated();
      onClose();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="font-semibold">Declare Incident</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Production API down"
              className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Severity</label>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="p1">P1 — Critical (full outage)</option>
              <option value="p2">P2 — High (major degradation)</option>
              <option value="p3">P3 — Medium (partial impact)</option>
              <option value="p4">P4 — Low (minor issue)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Affected Services</label>
            <input
              value={form.affected_services}
              onChange={(e) => setForm({ ...form, affected_services: e.target.value })}
              placeholder="API, Database, Auth (comma-separated)"
              className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">Cancel</button>
          <button
            onClick={submit}
            disabled={submitting || !form.title.trim()}
            className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Declare Incident
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [showDeclare, setShowDeclare] = useState(false);

  const load = async () => {
    try {
      const data = filter === "active"
        ? await api.get<{ incidents: Incident[] }>("/api/incidents/active")
        : await api.get<{ incidents: Incident[]; total: number }>("/api/incidents?limit=50");
      setIncidents(data.incidents ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const activeCount = incidents.filter((i) => i.status !== "resolved").length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {showDeclare && <DeclareModal onClose={() => setShowDeclare(false)} onCreated={load} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
            <h1 className="text-2xl font-bold">IncidentBridge</h1>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                {activeCount} ACTIVE
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">P1 war room — declare, track, resolve, post-mortem</p>
        </div>
        <button
          onClick={() => setShowDeclare(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Declare Incident
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {(["active", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setLoading(true); }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filter === f ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "active" ? "Active / In-progress" : "All incidents"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Shield className="w-12 h-12 text-green-400 opacity-60" />
          <p className="text-lg font-semibold">All clear</p>
          <p className="text-sm text-muted-foreground">No active incidents. Systems operational.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <IncidentRow key={inc.id} inc={inc} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
