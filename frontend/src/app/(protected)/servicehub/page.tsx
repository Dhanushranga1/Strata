"use client";

import { useState } from "react";
import useSWR from "swr";
import { LayoutGrid, Plus, Trash2, Edit2, Loader2, ExternalLink, Globe, Lock } from "lucide-react";
import api from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CardGridSkeleton } from "@/components/skeletons/ModulePageSkeleton";

interface FormField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox";
  required?: boolean;
  options?: string[];
}

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string;
  form_schema: FormField[];
  auto_assign_role: string | null;
  sla_priority: number;
  estimated_time: string | null;
  sort_order: number;
  is_active: boolean;
  is_public: boolean;
}

const SLA_LABELS: Record<number, string> = { 1: "Urgent", 2: "High", 3: "Medium", 4: "Low", 5: "Low" };

function CatalogCard({ item, onEdit, onDelete }: {
  item: CatalogItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 space-y-2 transition-opacity",
      !item.is_active && "opacity-50"
    )}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0 text-lg">
          <LayoutGrid className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{item.name}</span>
            {item.is_public
              ? <Globe className="w-3.5 h-3.5 text-green-400" />
              : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
            {!item.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
          </div>
          {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
          {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Priority: <strong>{SLA_LABELS[item.sla_priority] ?? "Medium"}</strong></span>
        {item.estimated_time && <><span>·</span><span>{item.estimated_time}</span></>}
        <span>·</span><span>{item.form_schema.length} field{item.form_schema.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

type FormMode = "create" | "edit";

function CatalogModal({ mode, initial, onClose, onSaved }: {
  mode: FormMode;
  initial?: CatalogItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "",
    estimated_time: initial?.estimated_time ?? "",
    auto_assign_role: initial?.auto_assign_role ?? "",
    sla_priority: initial?.sla_priority ?? 3,
    is_active: initial?.is_active ?? true,
    is_public: initial?.is_public ?? false,
  });
  const [fields, setFields] = useState<FormField[]>(initial?.form_schema ?? []);
  const [submitting, setSubmitting] = useState(false);

  const addField = () => setFields((p) => [...p, { key: "", label: "", type: "text", required: false }]);
  const updateField = (i: number, patch: Partial<FormField>) =>
    setFields((p) => p.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const removeField = (i: number) => setFields((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description || undefined,
        category: form.category || undefined,
        estimated_time: form.estimated_time || undefined,
        auto_assign_role: form.auto_assign_role || undefined,
        sla_priority: form.sla_priority,
        is_active: form.is_active,
        is_public: form.is_public,
        form_schema: fields.filter((f) => f.key && f.label),
        icon: "LayoutGrid",
      };
      if (mode === "edit" && initial) {
        await api.patch(`/api/servicehub/catalog/${initial.id}`, body);
      } else {
        await api.post("/api/servicehub/catalog", body);
      }
      onSaved();
      onClose();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <LayoutGrid className="w-5 h-5 text-cyan-400" />
          <h2 className="font-semibold">{mode === "edit" ? "Edit" : "New"} Service</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Request New Laptop"
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Hardware, Software, Access..."
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SLA Priority</label>
              <select value={form.sla_priority} onChange={(e) => setForm({ ...form, sla_priority: Number(e.target.value) })}
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
                <option value={1}>1 — Urgent</option>
                <option value={2}>2 — High</option>
                <option value={3}>3 — Medium</option>
                <option value={4}>4 — Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estimated time</label>
              <input value={form.estimated_time} onChange={(e) => setForm({ ...form, estimated_time: e.target.value })}
                placeholder="1-2 business days"
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auto-assign role</label>
              <input value={form.auto_assign_role} onChange={(e) => setForm({ ...form, auto_assign_role: e.target.value })}
                placeholder="rep, admin"
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                Active
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="rounded" />
                Public portal
              </label>
            </div>
          </div>

          {/* Form fields builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request form fields</label>
              <button onClick={addField} className="text-xs text-primary hover:underline">+ Add field</button>
            </div>
            {fields.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No fields yet — requester name and email are always collected automatically.</p>
            )}
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={f.key} onChange={(e) => updateField(i, { key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                    placeholder="field_key" className="w-28 text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none font-mono" />
                  <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder="Label" className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none" />
                  <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FormField["type"] })}
                    className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none">
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Select</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs shrink-0">
                    <input type="checkbox" checked={f.required ?? false} onChange={(e) => updateField(i, { required: e.target.checked })} />
                    Req
                  </label>
                  <button onClick={() => removeField(i)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">Cancel</button>
          <button
            onClick={submit}
            disabled={submitting || !form.name.trim()}
            className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "edit" ? "Save Changes" : "Create Service"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServiceHubPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  const { data, isLoading, mutate } = useSWR<{ catalog: CatalogItem[] }>("/api/servicehub/catalog?include_inactive=true");
  const items = data?.catalog ?? [];

  const deleteItem = async (id: string) => {
    await api.delete(`/api/servicehub/catalog/${id}`);
    mutate();
  };

  const publicCount = items.filter((i) => i.is_public && i.is_active).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {showCreate && <CatalogModal mode="create" onClose={() => setShowCreate(false)} onSaved={() => mutate()} />}
      {editing && <CatalogModal mode="edit" initial={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold">ServiceHub</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your service catalog — {publicCount} public service{publicCount !== 1 ? "s" : ""} visible to employees
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="#"
            className="flex items-center gap-2 px-3 py-2 border border-border text-sm rounded-xl hover:bg-accent transition-colors"
            title="View public employee portal"
          >
            <ExternalLink className="w-4 h-4" />
            Portal
          </a>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </div>

      {isLoading ? (
        <CardGridSkeleton cards={4} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <LayoutGrid className="w-12 h-12 text-cyan-400/40" />
          <p className="font-semibold">No services yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Add services employees can request — laptop setup, VPN access, software installation.
          </p>
          <button onClick={() => setShowCreate(true)} className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary/90">
            Add first service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <CatalogCard key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => deleteItem(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
