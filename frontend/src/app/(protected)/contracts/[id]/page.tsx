"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import api from "@/lib/api-client";
import {
  FileText, ArrowLeft, Building2, Calendar, DollarSign,
  ExternalLink, Link2, X, Trash2, Pencil, Save,
  CheckCircle2, Clock, XCircle, AlertTriangle, History,
  Monitor, Plus, RefreshCw, Shield, Zap, Star,
  ChevronRight, BarChart3, TrendingUp, Bell, CheckCheck,
  Mail, Phone, CircleAlert, Info, ChevronDown,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Contract {
  id: string; title: string; vendor_id: string | null;
  vendor_name: string | null; vendor_support_email: string | null;
  vendor_support_phone: string | null; account_manager: string | null;
  contract_number: string | null; status: string;
  contract_type: string | null; description: string | null;
  start_date: string | null; end_date: string | null;
  renewal_date: string | null; auto_renews: boolean;
  renewal_notice_days: number; total_value: number | null;
  currency: string; payment_schedule: string | null;
  payment_amount: number | null; key_terms: Record<string, any>;
  document_url: string | null; owner_email: string | null;
  creator_email: string | null;
  days_until_expiry: number | null; is_expired: boolean;
  expiry_status: "ok" | "warning" | "critical" | "expired";
  linked_assets: LinkedAsset[];
  history: HistoryEntry[];
  created_at: string; updated_at: string;
}

interface LinkedAsset {
  id: string; asset_tag: string; name: string;
  category: string; status: string; linked_at: string;
}

interface HistoryEntry {
  id: string; event_type: string; field_changed: string | null;
  old_value: string | null; new_value: string | null;
  note: string | null; actor_email: string | null; created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; dot: string; icon: React.ReactNode; label: string }> = {
  active:     { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-400", icon: <CheckCircle2 size={13} />, label: "Active" },
  draft:      { color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/25",          dot: "bg-zinc-400",    icon: <Clock size={13} />,        label: "Draft" },
  expired:    { color: "text-red-400 bg-red-500/10 border-red-500/25",             dot: "bg-red-400",     icon: <XCircle size={13} />,     label: "Expired" },
  terminated: { color: "text-orange-400 bg-orange-500/10 border-orange-500/25",    dot: "bg-orange-400",  icon: <XCircle size={13} />,     label: "Terminated" },
  renewed:    { color: "text-blue-400 bg-blue-500/10 border-blue-500/25",          dot: "bg-blue-400",    icon: <CheckCircle2 size={13} />, label: "Renewed" },
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  service: "Service Agreement", hardware: "Hardware",
  software_license: "Software License", maintenance: "Maintenance",
  support: "Support", lease: "Lease", nda: "NDA",
  sla: "SLA", cloud: "Cloud Services", other: "Other",
};

const PAYMENT_LABELS: Record<string, string> = {
  one_time: "One-time", monthly: "Monthly", quarterly: "Quarterly",
  annual: "Annual", custom: "Custom",
};

const CONTRACT_TYPES = [
  { v: "service", l: "Service Agreement" }, { v: "hardware", l: "Hardware" },
  { v: "software_license", l: "Software License" }, { v: "maintenance", l: "Maintenance" },
  { v: "support", l: "Support" }, { v: "lease", l: "Lease" },
  { v: "nda", l: "NDA" }, { v: "sla", l: "SLA" },
  { v: "cloud", l: "Cloud Services" }, { v: "other", l: "Other" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "SGD", "AED"];

const fetcher = (url: string) => api.get(url).then(r => r.data);

function fmtCurrency(v: number | null, cur = "USD") {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

function fmtDate(d: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", opts ?? { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(iso, { month: "short", day: "numeric" });
}

// ── Expiry timeline bar ────────────────────────────────────────────────────────

function ExpiryTimeline({ contract }: { contract: Contract }) {
  if (!contract.start_date || !contract.end_date) return null;

  const start     = new Date(contract.start_date).getTime();
  const end       = new Date(contract.end_date).getTime();
  const now       = Date.now();
  const total     = end - start;
  const elapsed   = Math.max(0, Math.min(total, now - start));
  const pct       = Math.round((elapsed / total) * 100);
  const noticePct = contract.renewal_notice_days
    ? Math.round(((end - contract.renewal_notice_days * 86_400_000 - start) / total) * 100)
    : null;

  const barColor =
    contract.is_expired     ? "bg-red-500"   :
    contract.expiry_status === "critical" ? "bg-orange-500" :
    contract.expiry_status === "warning"  ? "bg-amber-500"  :
    "bg-emerald-500";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Contract Lifecycle</h2>
        {contract.days_until_expiry != null && (
          <span className={`text-xs font-medium ${
            contract.is_expired ? "text-red-400" :
            contract.expiry_status === "critical" ? "text-orange-400" :
            contract.expiry_status === "warning"  ? "text-amber-400" :
            "text-zinc-400"
          }`}>
            {contract.is_expired ? "Expired" : `${contract.days_until_expiry} days left`}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden mb-3">
        <div className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${pct}%` }} />
        {noticePct != null && noticePct > 0 && noticePct < 100 && (
          <div className="absolute top-0 h-full w-px bg-amber-400/60"
            style={{ left: `${noticePct}%` }} />
        )}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{fmtDate(contract.start_date, { month: "short", year: "numeric" })}</span>
        {noticePct != null && noticePct > 0 && noticePct < 100 && (
          <span className="text-amber-400/70">Notice {fmtDate(contract.renewal_date, { month: "short", day: "numeric" })}</span>
        )}
        <span>{fmtDate(contract.end_date, { month: "short", year: "numeric" })}</span>
      </div>
    </div>
  );
}

// ── Key Terms card ─────────────────────────────────────────────────────────────

const KEY_TERM_LABELS: Record<string, { label: string; icon: React.ReactNode; fmt?: (v: any) => string }> = {
  sla_response_hours: { label: "SLA Response",    icon: <Bell size={13} className="text-blue-400" />,   fmt: v => `${v}h response` },
  uptime_guarantee:   { label: "Uptime",          icon: <CheckCheck size={13} className="text-emerald-400" />, fmt: v => String(v) },
  support_hours:      { label: "Support Hours",   icon: <Clock size={13} className="text-violet-400" /> },
  notice_period_days: { label: "Notice Period",   icon: <Bell size={13} className="text-amber-400" />,   fmt: v => `${v} days` },
  penalty_clause:     { label: "Penalty Clause",  icon: <Shield size={13} className="text-red-400" /> },
  payment_terms:      { label: "Payment Terms",   icon: <DollarSign size={13} className="text-emerald-400" /> },
  governing_law:      { label: "Governing Law",   icon: <Shield size={13} className="text-zinc-400" /> },
};

function KeyTermsCard({ keyTerms }: { keyTerms: Record<string, any> }) {
  const entries = Object.entries(keyTerms).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={14} className="text-violet-400" />
        <h2 className="text-sm font-medium text-white">Key Terms</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries.map(([k, v]) => {
          const def = KEY_TERM_LABELS[k];
          const label = def?.label ?? k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const display = def?.fmt ? def.fmt(v) : String(v);
          return (
            <div key={k} className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              {def?.icon ?? <Info size={13} className="text-zinc-500 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="text-sm font-medium text-zinc-200 mt-0.5 truncate">{display}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Payment schedule display ───────────────────────────────────────────────────

function PaymentCard({ contract }: { contract: Contract }) {
  if (!contract.payment_schedule && !contract.payment_amount && !contract.total_value) return null;

  const getAnnual = () => {
    if (!contract.payment_amount || !contract.payment_schedule) return null;
    const multiplier: Record<string, number> = {
      monthly: 12, quarterly: 4, annual: 1, one_time: 0, custom: 0,
    };
    const m = multiplier[contract.payment_schedule];
    return m ? contract.payment_amount * m : null;
  };

  const annual = getAnnual();

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign size={14} className="text-emerald-400" />
        <h2 className="text-sm font-medium text-white">Financials</h2>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Total Contract Value</span>
          <span className="text-base font-bold text-white">{fmtCurrency(contract.total_value, contract.currency)}</span>
        </div>
        {contract.payment_schedule && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Payment</span>
            <div className="text-right">
              <span className="text-sm text-zinc-200">
                {contract.payment_amount ? fmtCurrency(contract.payment_amount, contract.currency) : "—"}
                {" / "}{PAYMENT_LABELS[contract.payment_schedule] ?? contract.payment_schedule}
              </span>
            </div>
          </div>
        )}
        {annual != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Annualised</span>
            <span className="text-sm text-zinc-300">{fmtCurrency(annual, contract.currency)}/yr</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Currency</span>
          <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{contract.currency}</span>
        </div>
      </div>
    </div>
  );
}

// ── Inline status changer ──────────────────────────────────────────────────────

function StatusChanger({ contract }: { contract: Contract }) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const st = STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.draft;
  const STATUSES = ["draft", "active", "expired", "terminated", "renewed"];

  async function changeStatus(s: string) {
    if (s === contract.status) { setOpen(false); return; }
    setSaving(true);
    try {
      await api.post(`/api/contracts/${contract.id}/status?status=${s}`, {});
      mutate(`/api/contracts/${contract.id}`);
    } catch (e) { /* noop */ }
    finally { setSaving(false); setOpen(false); }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => !saving && setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-opacity cursor-pointer ${st.color} ${saving ? "opacity-60" : "hover:opacity-80"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${saving ? "animate-pulse" : ""}`} />
        {st.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-30 bg-zinc-800 border border-zinc-700 rounded-xl py-1.5 min-w-[150px] shadow-xl">
          <p className="px-3 py-1 text-xs text-zinc-500 font-medium uppercase tracking-wide">Change status</p>
          {STATUSES.map(s => {
            const sc = STATUS_CONFIG[s];
            return (
              <button key={s} type="button" onClick={() => changeStatus(s)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-700 transition-colors ${s === contract.status ? "opacity-40 pointer-events-none" : ""}`}>
                <span className={`w-2 h-2 rounded-full ${sc?.dot}`} />
                {sc?.label}
                {s === contract.status && <CheckCircle2 size={12} className="ml-auto text-zinc-400" />}
              </button>
            );
          })}
          <button type="button" onClick={() => setOpen(false)}
            aria-label="Close status menu"
            className="absolute top-1.5 right-1.5 p-1 text-zinc-500 hover:text-white rounded">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Renew confirmation modal ───────────────────────────────────────────────────

function RenewModal({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRenew() {
    setLoading(true); setError("");
    try {
      const res = await api.post(`/api/contracts/${contract.id}/renew`, {});
      onClose();
      router.push(`/contracts/${res.data.new_contract.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Renewal failed");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <RefreshCw size={18} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Renew Contract</h2>
            <p className="text-sm text-zinc-400">Create a renewal draft from this contract</p>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-xl p-4 mb-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Current end date</span>
            <span className="text-zinc-200">{fmtDate(contract.end_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">New start date</span>
            <span className="text-zinc-200">{contract.end_date ? fmtDate(new Date(new Date(contract.end_date).getTime() + 86400000).toISOString()) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">This contract</span>
            <span className="text-blue-400">→ marked as Renewed</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">New contract</span>
            <span className="text-zinc-400">Created as Draft</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleRenew} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {loading ? "Creating…" : "Create Renewal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit modal (same as before but condensed) ──────────────────────────────────

function EditContractModal({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const [form, setForm] = useState({
    title:               contract.title,
    contract_type:       contract.contract_type ?? "",
    description:         contract.description ?? "",
    start_date:          contract.start_date ?? "",
    end_date:            contract.end_date ?? "",
    renewal_date:        contract.renewal_date ?? "",
    auto_renews:         contract.auto_renews,
    renewal_notice_days: String(contract.renewal_notice_days),
    total_value:         contract.total_value != null ? String(contract.total_value) : "",
    currency:            contract.currency,
    payment_schedule:    contract.payment_schedule ?? "",
    payment_amount:      contract.payment_amount != null ? String(contract.payment_amount) : "",
    document_url:        contract.document_url ?? "",
    description_new:     contract.description ?? "",
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await api.put(`/api/contracts/${contract.id}`, {
        title:               form.title,
        contract_type:       form.contract_type || null,
        description:         form.description || null,
        start_date:          form.start_date || null,
        end_date:            form.end_date || null,
        renewal_date:        form.renewal_date || null,
        auto_renews:         form.auto_renews,
        renewal_notice_days: Number(form.renewal_notice_days) || 30,
        total_value:         form.total_value ? Number(form.total_value) : null,
        currency:            form.currency,
        payment_schedule:    form.payment_schedule || null,
        payment_amount:      form.payment_amount ? Number(form.payment_amount) : null,
        document_url:        form.document_url || null,
      });
      mutate(`/api/contracts/${contract.id}`);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );

  const inp = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <h2 className="text-base font-semibold text-white">Edit Contract</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} className="text-zinc-400 hover:text-white transition-colors" />
          </button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          {error && <p className="col-span-2 text-sm text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="col-span-2"><F label="Title *"><input value={form.title} onChange={e => set("title", e.target.value)} aria-label="Title" className={inp} /></F></div>
          <F label="Type">
            <select value={form.contract_type} onChange={e => set("contract_type", e.target.value)} aria-label="Contract type" className={inp}>
              <option value="">—</option>
              {CONTRACT_TYPES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </F>
          <F label="Currency">
            <select value={form.currency} onChange={e => set("currency", e.target.value)} aria-label="Currency" className={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </F>
          {(["start_date","end_date","renewal_date"] as const).map(k => (
            <F key={k} label={k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}>
              <input type="date" value={form[k]} onChange={e => set(k, e.target.value)} aria-label={k} className={inp} />
            </F>
          ))}
          <F label="Notice Period (days)">
            <input type="number" min="0" value={form.renewal_notice_days} onChange={e => set("renewal_notice_days", e.target.value)} aria-label="Notice period" className={inp} />
          </F>
          <F label="Total Value">
            <input type="number" min="0" step="0.01" value={form.total_value} onChange={e => set("total_value", e.target.value)} aria-label="Total value" className={inp} />
          </F>
          <F label="Payment Schedule">
            <select value={form.payment_schedule} onChange={e => set("payment_schedule", e.target.value)} aria-label="Payment schedule" className={inp}>
              <option value="">—</option>
              {[["one_time","One-time"],["monthly","Monthly"],["quarterly","Quarterly"],["annual","Annual"],["custom","Custom"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </F>
          <F label="Payment Amount">
            <input type="number" min="0" step="0.01" value={form.payment_amount} onChange={e => set("payment_amount", e.target.value)} aria-label="Payment amount" className={inp} />
          </F>
          <div className="col-span-2"><F label="Document URL">
            <input type="url" value={form.document_url} onChange={e => set("document_url", e.target.value)} placeholder="https://…" aria-label="Document URL" className={inp} />
          </F></div>
          <div className="col-span-2"><F label="Description">
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} aria-label="Description" className={`${inp} resize-none`} />
          </F></div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.auto_renews} onChange={e => set("auto_renews", e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-0" />
              <span className="text-sm text-zinc-300">Auto-renews unless cancelled</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-800">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving || !form.title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50">
            <Save size={14} />{saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Link asset modal ───────────────────────────────────────────────────────────

function LinkAssetModal({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data } = useSWR(
    search.length >= 2 ? `/api/assets?search=${encodeURIComponent(search)}&limit=10` : null, fetcher
  );
  const results: { id: string; asset_tag: string; name: string; status: string }[] = data?.assets ?? [];

  async function link(assetId: string) {
    setLoading(true); setError("");
    try {
      await api.post(`/api/contracts/${contractId}/link-asset`, { asset_id: assetId });
      mutate(`/api/contracts/${contractId}`);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">Link Asset to Contract</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={16} className="text-zinc-400 hover:text-white" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by asset tag or name…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
          {results.length > 0 && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {results.map(a => (
                <button key={a.id} type="button" disabled={loading} onClick={() => link(a.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 text-left transition-colors">
                  <Monitor size={13} className="text-blue-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{a.name}</p>
                    <p className="text-xs text-zinc-500">{a.asset_tag}</p>
                  </div>
                  <span className="text-xs text-zinc-500 capitalize">{a.status}</span>
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && results.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-3">No assets found</p>
          )}
          {search.length < 2 && (
            <p className="text-xs text-zinc-600 text-center">Type 2+ characters to search</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();

  const [editOpen, setEditOpen]     = useState(false);
  const [linkOpen, setLinkOpen]     = useState(false);
  const [renewOpen, setRenewOpen]   = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [unlinking, setUnlinking]   = useState<string | null>(null);

  const { data: contract, error } = useSWR<Contract>(
    params.id ? `/api/contracts/${params.id}` : null, fetcher
  );

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/api/contracts/${params.id}`);
      router.push("/contracts");
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Delete failed");
      setDeleting(false);
    }
  }

  async function handleUnlink(assetId: string) {
    setUnlinking(assetId);
    try {
      await api.delete(`/api/contracts/${params.id}/link-asset/${assetId}`);
      mutate(`/api/contracts/${params.id}`);
    } finally { setUnlinking(null); }
  }

  if (error) return (
    <div className="flex-1 bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400">Contract not found.</p>
    </div>
  );
  if (!contract) return (
    <div className="flex-1 bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  const st = STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.draft;
  const canRenew = contract.status === "active" || contract.status === "expired";

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-6">
      {editOpen   && <EditContractModal contract={contract} onClose={() => setEditOpen(false)} />}
      {linkOpen   && <LinkAssetModal contractId={params.id} onClose={() => setLinkOpen(false)} />}
      {renewOpen  && <RenewModal contract={contract} onClose={() => setRenewOpen(false)} />}

      <div className="max-w-5xl mx-auto space-y-5">
        {/* ── Back ─────────────────────────────────────────────────────── */}
        <Link href="/contracts" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white transition-colors w-fit">
          <ArrowLeft size={14} /> Back to ContractVault
        </Link>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white leading-tight">{contract.title}</h1>
              <div className="flex items-center flex-wrap gap-2 mt-1.5">
                <StatusChanger contract={contract} />
                {contract.contract_type && (
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type}
                  </span>
                )}
                {contract.contract_number && (
                  <span className="text-xs text-zinc-600">#{contract.contract_number}</span>
                )}
                {contract.auto_renews && (
                  <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                    <RefreshCw size={10} /> Auto-renews
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canRenew && (
              <button type="button" onClick={() => setRenewOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/30 border border-emerald-500/30 hover:bg-emerald-900/50 text-sm text-emerald-300 transition-colors">
                <RefreshCw size={13} /> Renew
              </button>
            )}
            <button type="button" onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-white transition-colors">
              <Pencil size={13} /> Edit
            </button>
            {!delConfirm ? (
              <button type="button" onClick={() => setDelConfirm(true)} aria-label="Delete contract"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/30 text-sm text-zinc-400 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-400">Delete?</span>
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white transition-colors disabled:opacity-50">
                  {deleting ? "…" : "Confirm"}
                </button>
                <button type="button" onClick={() => setDelConfirm(false)} aria-label="Cancel delete"
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors">
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Expiry alert ──────────────────────────────────────────────── */}
        {contract.expiry_status !== "ok" && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            contract.is_expired
              ? "bg-red-950/20 border-red-500/25"
              : contract.expiry_status === "critical"
              ? "bg-orange-950/20 border-orange-500/25"
              : "bg-amber-950/15 border-amber-500/20"
          }`}>
            <CircleAlert size={17} className={contract.is_expired ? "text-red-400" : contract.expiry_status === "critical" ? "text-orange-400" : "text-amber-400"} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${contract.is_expired ? "text-red-300" : contract.expiry_status === "critical" ? "text-orange-300" : "text-amber-300"}`}>
                {contract.is_expired
                  ? `This contract expired on ${fmtDate(contract.end_date)}.`
                  : `Expires in ${contract.days_until_expiry} day${contract.days_until_expiry !== 1 ? "s" : ""} (${fmtDate(contract.end_date)}).`}
              </p>
              <p className="text-xs mt-0.5 opacity-70">
                {contract.auto_renews ? "Auto-renews. Verify terms are still favourable." : "Manual renewal required before the notice deadline."}
              </p>
            </div>
            {canRenew && (
              <button type="button" onClick={() => setRenewOpen(true)}
                className="shrink-0 flex items-center gap-1 text-xs text-emerald-400 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 hover:bg-emerald-500/10 transition-colors">
                <RefreshCw size={12} /> Renew now
              </button>
            )}
          </div>
        )}

        {/* ── Lifecycle bar ─────────────────────────────────────────────── */}
        <ExpiryTimeline contract={contract} />

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left col */}
          <div className="lg:col-span-1 space-y-4">

            {/* Dates */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Dates</h2>
              <div className="space-y-2.5">
                {[
                  { label: "Start Date",     value: fmtDate(contract.start_date) },
                  { label: "End Date",       value: contract.end_date ? <span className={contract.expiry_status !== "ok" ? "text-amber-400" : ""}>{fmtDate(contract.end_date)}</span> : "—" },
                  { label: "Renewal Date",   value: fmtDate(contract.renewal_date) },
                  { label: "Notice Period",  value: `${contract.renewal_notice_days} days` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-500 shrink-0">{label}</span>
                    <span className="text-sm text-zinc-200">{value ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financials */}
            <PaymentCard contract={contract} />

            {/* Key terms */}
            <KeyTermsCard keyTerms={contract.key_terms ?? {}} />

            {/* Vendor */}
            {contract.vendor_name && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Vendor</h2>
                <Link href={`/contracts/vendors/${contract.vendor_id}`}
                  className="flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors mb-3">
                  <Building2 size={14} />{contract.vendor_name}
                  <ChevronRight size={13} className="ml-auto" />
                </Link>
                <div className="space-y-2">
                  {contract.vendor_support_email && (
                    <a href={`mailto:${contract.vendor_support_email}`}
                      className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors">
                      <Mail size={12} />{contract.vendor_support_email}
                    </a>
                  )}
                  {contract.vendor_support_phone && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Phone size={12} />{contract.vendor_support_phone}
                    </div>
                  )}
                  {contract.account_manager && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Star size={12} className="text-amber-400" />AM: {contract.account_manager}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Document */}
            {contract.document_url && (
              <a href={contract.document_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/30 rounded-xl text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                <ExternalLink size={14} /> View Contract Document
              </a>
            )}
          </div>

          {/* Right col */}
          <div className="lg:col-span-2 space-y-5">

            {/* Description */}
            {contract.description && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Description</h2>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{contract.description}</p>
              </div>
            )}

            {/* Linked Assets */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Link2 size={14} className="text-blue-400" />
                  <h2 className="text-sm font-medium text-white">
                    Covered Assets <span className="text-zinc-500 font-normal ml-1">({contract.linked_assets.length})</span>
                  </h2>
                </div>
                <button type="button" onClick={() => setLinkOpen(true)}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                  <Plus size={12} /> Link asset
                </button>
              </div>
              {contract.linked_assets.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Monitor size={24} className="text-zinc-800 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500 mb-2">No assets linked yet.</p>
                  <button type="button" onClick={() => setLinkOpen(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    Link an asset →
                  </button>
                </div>
              ) : (
                <div>
                  {contract.linked_assets.map(a => (
                    <div key={a.id}
                      className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/50 last:border-b-0 hover:bg-zinc-800/30 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Monitor size={13} className="text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/assets/${a.id}`}
                          className="text-sm text-white hover:text-blue-300 transition-colors font-medium truncate block">
                          {a.name}
                        </Link>
                        <p className="text-xs text-zinc-500">{a.asset_tag} · <span className="capitalize">{a.category}</span> · <span className="capitalize">{a.status}</span></p>
                      </div>
                      <button type="button" onClick={() => handleUnlink(a.id)} disabled={unlinking === a.id}
                        aria-label={`Unlink ${a.name}`}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40">
                        {unlinking === a.id
                          ? <RefreshCw size={13} className="animate-spin" />
                          : <X size={13} />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit history */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
                <History size={14} className="text-zinc-400" />
                <h2 className="text-sm font-medium text-white">Activity & History</h2>
              </div>
              {contract.history.length === 0 ? (
                <p className="text-sm text-zinc-600 text-center py-8">No history yet.</p>
              ) : (
                <div className="relative px-5 py-2">
                  {/* Timeline line */}
                  <div className="absolute left-[26px] top-0 bottom-0 w-px bg-zinc-800" />
                  <div className="space-y-0">
                    {contract.history.map((h, idx) => {
                      const isCreate = h.event_type === "created";
                      return (
                        <div key={h.id} className="flex gap-4 py-3 relative">
                          <div className={`w-4 h-4 rounded-full shrink-0 mt-0.5 border-2 z-10 ${
                            isCreate
                              ? "bg-emerald-500 border-emerald-400"
                              : h.event_type === "renewed"
                              ? "bg-blue-500 border-blue-400"
                              : "bg-zinc-700 border-zinc-600"
                          }`} />
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm text-zinc-200 font-medium capitalize">
                                {h.event_type.replace(/_/g, " ")}
                                {h.field_changed && <span className="text-zinc-500 font-normal text-xs"> · {h.field_changed}</span>}
                              </p>
                              <span className="text-xs text-zinc-600 shrink-0">{timeAgo(h.created_at)}</span>
                            </div>
                            {h.note && <p className="text-xs text-zinc-400 mt-0.5">{h.note}</p>}
                            {h.old_value && h.new_value && (
                              <p className="text-xs text-zinc-600 mt-0.5">
                                <span className="line-through mr-1">{h.old_value}</span>→
                                <span className="text-zinc-400 ml-1">{h.new_value}</span>
                              </p>
                            )}
                            <p className="text-xs text-zinc-600 mt-0.5">{h.actor_email ?? "system"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
