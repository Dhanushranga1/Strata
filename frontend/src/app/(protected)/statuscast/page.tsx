"use client";

import { useState } from "react";
import useSWR from "swr";
import { Globe, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import api from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ModulePageSkeleton } from "@/components/skeletons/ModulePageSkeleton";

interface Service {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  current_status: string;
}

interface Stats {
  stats: string[];
  health: "healthy" | "warning" | "critical";
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  operational:   { label: "Operational",   dot: "bg-green-400",  badge: "bg-green-500/15 text-green-400 border-green-500/25" },
  maintenance:   { label: "Maintenance",   dot: "bg-blue-400",   badge: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  degraded:      { label: "Degraded",      dot: "bg-yellow-400", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" },
  partial_outage:{ label: "Partial outage",dot: "bg-orange-400", badge: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
  major_outage:  { label: "Major outage",  dot: "bg-red-400",    badge: "bg-red-500/15 text-red-400 border-red-500/25" },
};

function ServiceRow({ svc, onUpdate, onDelete }: {
  svc: Service;
  onUpdate: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[svc.current_status] ?? STATUS_CONFIG.operational;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card">
      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{svc.name}</p>
        {svc.description && <p className="text-xs text-muted-foreground">{svc.description}</p>}
      </div>
      <select
        value={svc.current_status}
        onChange={(e) => onUpdate(svc.id, e.target.value)}
        className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none"
      >
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold hidden sm:block", cfg.badge)}>
        {cfg.label}
      </span>
      <button onClick={() => onDelete(svc.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PostUpdateModal({ services, onClose, onPosted }: {
  services: Service[];
  onClose: () => void;
  onPosted: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    body: "",
    status_impact: "none",
    service_id: "",
    service_status: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/statuscast/post", {
        title: form.title,
        body: form.body || undefined,
        status_impact: form.status_impact,
        service_id: form.service_id || undefined,
        service_status: form.service_status || undefined,
      });
      onPosted();
      onClose();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <Globe className="w-5 h-5 text-teal-400" />
          <h2 className="font-semibold">Post Status Update</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. API latency issues resolved"
              className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Impact level</label>
            <select
              value={form.status_impact}
              onChange={(e) => setForm({ ...form, status_impact: e.target.value })}
              className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="none">None (informational)</option>
              <option value="maintenance">Maintenance</option>
              <option value="degraded">Degraded performance</option>
              <option value="partial_outage">Partial outage</option>
              <option value="major_outage">Major outage</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Affected service</label>
              <select
                value={form.service_id}
                onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="">All services</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {form.service_id && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Update service status</label>
                <select
                  value={form.service_status}
                  onChange={(e) => setForm({ ...form, service_status: e.target.value })}
                  className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none"
                >
                  <option value="">Keep current</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
              placeholder="Additional context for your users..."
              className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">Cancel</button>
          <button
            onClick={submit}
            disabled={submitting || !form.title.trim()}
            className="flex-1 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Publish Update
          </button>
        </div>
      </div>
    </div>
  );
}

function AddServiceModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", sort_order: 0 });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/statuscast/services", { ...form });
      onAdded();
      onClose();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Add Service</h2>
        </div>
        <div className="p-6 space-y-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Service name" className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)" className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">Cancel</button>
          <button onClick={submit} disabled={submitting || !form.name.trim()}
            className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
            Add Service
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StatusCastPage() {
  const [showPost, setShowPost] = useState(false);
  const [showAddService, setShowAddService] = useState(false);

  const { data: svcData, isLoading, mutate: mutateServices } = useSWR<{ services: Service[] }>("/api/statuscast/services");
  const { data: statsData, mutate: mutateStats } = useSWR<Stats>("/api/statuscast/platform-stats");
  const services = svcData?.services ?? [];
  const stats = statsData ?? null;

  const refresh = () => { mutateServices(); mutateStats(); };

  const updateServiceStatus = async (id: string, status: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    await api.patch(`/api/statuscast/services/${id}`, {
      name: svc.name,
      description: svc.description,
      sort_order: svc.sort_order,
      current_status: status,
    });
    mutateServices();
  };

  const deleteService = async (id: string) => {
    await api.delete(`/api/statuscast/services/${id}`);
    refresh();
  };

  const healthColor = stats?.health === "critical" ? "text-red-400" : stats?.health === "warning" ? "text-yellow-400" : "text-green-400";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {showPost && <PostUpdateModal services={services} onClose={() => setShowPost(false)} onPosted={refresh} />}
      {showAddService && <AddServiceModal onClose={() => setShowAddService(false)} onAdded={refresh} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-bold">StatusCast</h1>
            {stats && (
              <span className={cn("text-sm font-medium", healthColor)}>
                — {stats.stats[0]}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Manage your public status page</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddService(true)}
            className="flex items-center gap-2 px-3 py-2 border border-border text-sm rounded-xl hover:bg-accent transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
          <button
            onClick={() => setShowPost(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors"
          >
            <Globe className="w-4 h-4" />
            Post Update
          </button>
        </div>
      </div>

      {/* Overall health banner */}
      {stats && (
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl border",
          stats.health === "critical" ? "bg-red-500/10 border-red-500/25 text-red-400" :
          stats.health === "warning"  ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-400" :
                                        "bg-green-500/10 border-green-500/25 text-green-400"
        )}>
          {stats.health === "healthy"
            ? <CheckCircle2 className="w-5 h-5 shrink-0" />
            : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="font-medium text-sm">{stats.stats.join(" · ")}</span>
          <a
            href="#"
            className="ml-auto flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
            title="Public status page URL — share with customers"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Public page
          </a>
        </div>
      )}

      {isLoading ? (
        <ModulePageSkeleton rows={4} />
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <Globe className="w-12 h-12 text-teal-400/40" />
          <p className="font-semibold">No services configured</p>
          <p className="text-sm text-muted-foreground">Add your first service to start tracking status.</p>
          <button onClick={() => setShowAddService(true)} className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary/90">
            Add first service
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => (
            <ServiceRow key={svc.id} svc={svc} onUpdate={updateServiceStatus} onDelete={deleteService} />
          ))}
        </div>
      )}
    </div>
  );
}
