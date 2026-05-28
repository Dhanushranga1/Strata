"use client";

import { useState, useEffect } from "react";
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Info } from "lucide-react";
import api from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Action {
  type: string;
  params: Record<string, string>;
}

interface Rule {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  conditions: Condition[];
  actions: Action[];
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  ticket_created:        "Ticket created",
  ticket_updated:        "Ticket updated",
  ticket_status_changed: "Status changed",
  ticket_assigned:       "Ticket assigned",
  ticket_idle:           "Ticket idle",
  ticket_overdue:        "Ticket overdue",
  ticket_priority_changed: "Priority changed",
  message_added:         "Message added",
};

const CONDITION_FIELDS = ["status", "priority", "title", "category", "tags", "assignee_id"];
const CONDITION_OPS    = ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"];

const ACTION_TYPES: Record<string, { label: string; paramKey?: string; paramLabel?: string }> = {
  change_priority:  { label: "Change priority",  paramKey: "priority",  paramLabel: "Priority (urgent/high/medium/low)" },
  change_status:    { label: "Change status",     paramKey: "status",    paramLabel: "Status (open/in_progress/resolved/closed)" },
  assign_to_role:   { label: "Assign to role",    paramKey: "role",      paramLabel: "Role (rep/admin)" },
  add_tag:          { label: "Add tag",            paramKey: "tag",       paramLabel: "Tag name" },
  add_note:         { label: "Add internal note",  paramKey: "note",      paramLabel: "Note text" },
};

function EmptyCondition(): Condition { return { field: "status", operator: "equals", value: "" }; }
function EmptyAction(): Action { return { type: "change_priority", params: { priority: "medium" } }; }

function RuleCard({ rule, onDelete, onToggle }: { rule: Rule; onDelete: () => void; onToggle: () => void }) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 space-y-3 transition-opacity",
      !rule.is_active && "opacity-60"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{rule.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 font-medium">
              {TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event}
            </span>
            {!rule.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Disabled</span>
            )}
          </div>
          {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}</span>
            <span>•</span>
            <span>{rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}</span>
            {rule.run_count > 0 && <><span>•</span><span>Fired {rule.run_count}×</span></>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggle}
            title={rule.is_active ? "Disable rule" : "Enable rule"}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
          >
            {rule.is_active
              ? <ToggleRight className="w-4 h-4 text-green-400" />
              : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} title="Delete rule" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conditions */}
      {rule.conditions.length > 0 && (
        <div className="text-xs space-y-1">
          <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">IF (all match)</p>
          {rule.conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2.5 py-1 w-fit">
              <span className="font-mono text-violet-400">{c.field}</span>
              <span className="text-muted-foreground">{c.operator}</span>
              {c.value && <span className="font-mono">{c.value}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {rule.actions.length > 0 && (
        <div className="text-xs space-y-1">
          <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">THEN</p>
          {rule.actions.map((a, i) => {
            const meta = ACTION_TYPES[a.type];
            const paramVal = a.params ? Object.values(a.params)[0] : "";
            return (
              <div key={i} className="flex items-center gap-1.5 bg-yellow-500/10 rounded-lg px-2.5 py-1 w-fit">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span>{meta?.label ?? a.type}</span>
                {paramVal && <span className="text-muted-foreground">→ <strong>{paramVal}</strong></span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateRuleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("ticket_created");
  const [conditions, setConditions] = useState<Condition[]>([EmptyCondition()]);
  const [actions, setActions] = useState<Action[]>([EmptyAction()]);
  const [submitting, setSubmitting] = useState(false);

  const updateCond = (i: number, patch: Partial<Condition>) =>
    setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const updateAction = (i: number, type: string) =>
    setActions((prev) => prev.map((a, idx) => {
      if (idx !== i) return a;
      const meta = ACTION_TYPES[type];
      return { type, params: meta?.paramKey ? { [meta.paramKey]: "" } : {} };
    }));
  const updateActionParam = (i: number, val: string) =>
    setActions((prev) => prev.map((a, idx) => {
      if (idx !== i) return a;
      const meta = ACTION_TYPES[a.type];
      return { ...a, params: meta?.paramKey ? { [meta.paramKey]: val } : {} };
    }));

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/automation/rules", {
        name: name.trim(),
        description: description || undefined,
        trigger_event: triggerEvent,
        conditions: conditions.filter((c) => c.field),
        actions: actions.filter((a) => a.type),
        is_active: true,
      });
      onCreated();
      onClose();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h2 className="font-semibold">Create Automation Rule</h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rule name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Auto-assign urgent tickets"
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trigger event</label>
              <select
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value)}
                className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IF (all conditions must match)</label>
              <button onClick={() => setConditions((p) => [...p, EmptyCondition()])} className="text-xs text-primary hover:underline">+ Add</button>
            </div>
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={c.field} onChange={(e) => updateCond(i, { field: e.target.value })}
                    className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none">
                    {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={c.operator} onChange={(e) => updateCond(i, { operator: e.target.value })}
                    className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none">
                    {CONDITION_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  {!["is_empty", "is_not_empty"].includes(c.operator) && (
                    <input value={c.value} onChange={(e) => updateCond(i, { value: e.target.value })}
                      placeholder="value" className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none" />
                  )}
                  <button onClick={() => setConditions((p) => p.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">THEN (execute all)</label>
              <button onClick={() => setActions((p) => [...p, EmptyAction()])} className="text-xs text-primary hover:underline">+ Add</button>
            </div>
            <div className="space-y-2">
              {actions.map((a, i) => {
                const meta = ACTION_TYPES[a.type];
                const paramVal = a.params ? Object.values(a.params)[0] ?? "" : "";
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={a.type} onChange={(e) => updateAction(i, e.target.value)}
                      className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none">
                      {Object.entries(ACTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    {meta?.paramKey && (
                      <input value={paramVal} onChange={(e) => updateActionParam(i, e.target.value)}
                        placeholder={meta.paramLabel}
                        className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none" />
                    )}
                    <button onClick={() => setActions((p) => p.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">Cancel</button>
          <button
            onClick={submit}
            disabled={submitting || !name.trim()}
            className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Rule
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const data = await api.get<{ rules: Rule[] }>("/api/automation/rules");
      setRules(data.rules ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deleteRule = async (id: string) => {
    await api.delete(`/api/automation/rules/${id}`);
    load();
  };

  const toggleRule = async (id: string) => {
    await api.post(`/api/automation/rules/${id}/toggle`, {});
    load();
  };

  const activeCount = rules.filter((r) => r.is_active).length;
  const totalRuns   = rules.reduce((s, r) => s + r.run_count, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {showCreate && <CreateRuleModal onClose={() => setShowCreate(false)} onCreated={load} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            <h1 className="text-2xl font-bold">FlowBot</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">IF/THEN automation rules — route, tag, and escalate automatically</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total rules", value: rules.length },
          { label: "Active",      value: activeCount },
          { label: "Total fires", value: totalRuns },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Rules run synchronously after ticket events. Conditions are evaluated in AND logic — all must match for actions to fire.</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <Zap className="w-12 h-12 text-yellow-400/40" />
          <p className="font-semibold">No automation rules yet</p>
          <p className="text-sm text-muted-foreground">Create your first rule to automate repetitive ticket actions.</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary/90">
            Create first rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <RuleCard key={r.id} rule={r} onDelete={() => deleteRule(r.id)} onToggle={() => toggleRule(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
