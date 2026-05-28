"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import api from "@/lib/api-client";
import {
  Building2, ArrowLeft, Star, Phone, Mail, Globe,
  MapPin, User, FileText, Plus, Pencil, Trash2,
  ChevronRight, CheckCircle2, Clock, XCircle, X, Save,
  Shield, AlertTriangle, TrendingUp, Package,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Analytics {
  total_contracts: number;
  active_contracts: number;
  expired_contracts: number;
  closed_contracts: number;
  active_value: number;
  total_value: number;
  avg_contract_value: number;
  latest_expiry: string | null;
  soonest_expiry: string | null;
  days_until_soonest_expiry: number | null;
  critical_expiring: number;
  risk_score: number;
  risk_level: "critical" | "warning" | "healthy";
  covered_assets: number;
}

interface Vendor {
  id: string; name: string; category: string | null;
  website: string | null; support_email: string | null;
  support_phone: string | null; account_manager: string | null;
  account_manager_email: string | null; address: string | null;
  notes: string | null; is_preferred: boolean;
  active_contracts: number; total_contracts: number;
  contracts?: Contract[];
  analytics?: Analytics;
}

interface Contract {
  id: string; title: string; status: string;
  contract_type: string | null; end_date: string | null;
  total_value: number | null; currency: string;
  days_until_expiry: number | null; is_expired: boolean; expiry_status: string;
}

const CATEGORY_OPTIONS = [
  { v: "hardware", l: "Hardware" }, { v: "software", l: "Software" },
  { v: "saas", l: "SaaS" }, { v: "services", l: "Services" },
  { v: "telecom", l: "Telecom" }, { v: "cloud", l: "Cloud" },
  { v: "maintenance", l: "Maintenance" }, { v: "other", l: "Other" },
];

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  active:     { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 size={12} /> },
  draft:      { color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",          icon: <Clock size={12} /> },
  expired:    { color: "text-red-400 bg-red-500/10 border-red-500/20",             icon: <XCircle size={12} /> },
  terminated: { color: "text-orange-400 bg-orange-500/10 border-orange-500/20",    icon: <XCircle size={12} /> },
  renewed:    { color: "text-blue-400 bg-blue-500/10 border-blue-500/20",          icon: <CheckCircle2 size={12} /> },
};

const RISK_CONFIG = {
  healthy:  { color: "text-emerald-400", bg: "bg-emerald-500", border: "border-emerald-500/20", bg10: "bg-emerald-500/10", icon: <Shield size={14} />,        label: "Low Risk"  },
  warning:  { color: "text-amber-400",   bg: "bg-amber-500",   border: "border-amber-500/20",   bg10: "bg-amber-500/10",   icon: <AlertTriangle size={14} />, label: "Medium Risk" },
  critical: { color: "text-red-400",     bg: "bg-red-500",     border: "border-red-500/20",     bg10: "bg-red-500/10",     icon: <AlertTriangle size={14} />, label: "High Risk" },
};

const fetcher = (url: string) => api.get(url).then((r) => r.data);

function formatCurrency(v: number | null | undefined, currency = "USD") {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Risk Score Bar ─────────────────────────────────────────────────────────────

function RiskScoreBar({ score, level }: { score: number; level: "critical" | "warning" | "healthy" }) {
  const rc = RISK_CONFIG[level];
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`flex items-center gap-1.5 text-sm font-medium ${rc.color}`}>
          {rc.icon} {rc.label}
        </span>
        <span className={`text-xs font-mono ${rc.color}`}>{score}/100</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${rc.bg} rounded-full transition-all`}
          style={{ width: `${score}%` }} />
      </div>
      {score >= 60 && (
        <p className="mt-1.5 text-xs text-red-400">
          Review expiring contracts and renew to reduce risk.
        </p>
      )}
      {score >= 30 && score < 60 && (
        <p className="mt-1.5 text-xs text-amber-400">
          Some contracts need attention soon.
        </p>
      )}
    </div>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditVendorModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const [form, setForm] = useState({
    name: vendor.name,
    category: vendor.category ?? "",
    website: vendor.website ?? "",
    support_email: vendor.support_email ?? "",
    support_phone: vendor.support_phone ?? "",
    account_manager: vendor.account_manager ?? "",
    account_manager_email: vendor.account_manager_email ?? "",
    address: vendor.address ?? "",
    notes: vendor.notes ?? "",
    is_preferred: vendor.is_preferred,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await api.put(`/api/contracts/vendors/${vendor.id}`, {
        ...form,
        category: form.category || null,
        website: form.website || null,
        support_email: form.support_email || null,
        support_phone: form.support_phone || null,
        account_manager: form.account_manager || null,
        account_manager_email: form.account_manager_email || null,
        address: form.address || null,
        notes: form.notes || null,
      });
      mutate(`/api/contracts/vendors/${vendor.id}`);
      mutate(`/api/contracts/vendors/${vendor.id}/analytics`);
      mutate("/api/contracts/vendors");
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));
  const inp = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">Edit Vendor</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1.5">Vendor Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} aria-label="Vendor name" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} aria-label="Category" className={inp}>
                <option value="">Select…</option>
                {CATEGORY_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Website</label>
              <input value={form.website} onChange={e => set("website", e.target.value)} type="url" placeholder="https://…" aria-label="Website" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Support Email</label>
              <input value={form.support_email} onChange={e => set("support_email", e.target.value)} type="email" aria-label="Support email" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Support Phone</label>
              <input value={form.support_phone} onChange={e => set("support_phone", e.target.value)} aria-label="Support phone" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Account Manager</label>
              <input value={form.account_manager} onChange={e => set("account_manager", e.target.value)} aria-label="Account manager" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">AM Email</label>
              <input value={form.account_manager_email} onChange={e => set("account_manager_email", e.target.value)} type="email" aria-label="Account manager email" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1.5">Address</label>
              <input value={form.address} onChange={e => set("address", e.target.value)} aria-label="Address" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} aria-label="Notes"
                className={`${inp} resize-none`} />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_preferred} onChange={e => set("is_preferred", e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-0" />
                <span className="text-sm text-zinc-300">Preferred vendor</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-800">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50">
            <Save size={14} />{saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contract row with expiry indicator ────────────────────────────────────────

function ContractRow({ c }: { c: Contract }) {
  const st = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
  const expirySoon = c.days_until_expiry != null && c.days_until_expiry <= 30 && c.status === "active";
  const expiryWarning = c.days_until_expiry != null && c.days_until_expiry <= 90 && c.status === "active";

  return (
    <Link
      href={`/contracts/${c.id}`}
      className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/50 last:border-b-0 hover:bg-zinc-800/50 transition-colors group"
    >
      <FileText size={14} className={`shrink-0 ${expirySoon ? "text-red-400" : expiryWarning ? "text-amber-400" : "text-emerald-400"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{c.title}</p>
        <p className="text-xs text-zinc-500">
          {c.contract_type ?? "Contract"}
          {c.end_date && ` · expires ${fmtDate(c.end_date)}`}
          {expirySoon && <span className="text-red-400 ml-1">(renew soon)</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {c.total_value != null && (
          <span className="text-xs text-zinc-400">{formatCurrency(c.total_value, c.currency)}</span>
        )}
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${st.color}`}>
          {st.icon}<span className="capitalize">{c.status}</span>
        </span>
        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300 transition-colors" />
      </div>
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function VendorDetailPage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const [editOpen, setEditOpen]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const { data: vendor, error } = useSWR<Vendor>(
    params.id ? `/api/contracts/vendors/${params.id}` : null, fetcher
  );
  const { data: analyticsData } = useSWR<{ analytics: Analytics }>(
    params.id ? `/api/contracts/vendors/${params.id}/analytics` : null, fetcher
  );
  const analytics = analyticsData?.analytics;

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/api/contracts/vendors/${params.id}`);
      router.push("/contracts");
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Delete failed");
      setDeleting(false);
    }
  }

  if (error) return (
    <div className="flex-1 bg-zinc-950 p-6 flex items-center justify-center">
      <p className="text-zinc-400">Vendor not found.</p>
    </div>
  );

  if (!vendor) return (
    <div className="flex-1 bg-zinc-950 p-6 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
    CATEGORY_OPTIONS.map(o => [o.v, o.l])
  );

  const riskLevel = analytics?.risk_level ?? "healthy";
  const rc = RISK_CONFIG[riskLevel];

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-6">
      {editOpen && <EditVendorModal vendor={vendor} onClose={() => setEditOpen(false)} />}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back + header */}
        <div>
          <Link href="/contracts" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-4 transition-colors w-fit">
            <ArrowLeft size={14} /> Back to ContractVault
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Building2 size={22} className="text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-white">{vendor.name}</h1>
                  {vendor.is_preferred && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Star size={10} className="fill-amber-400" /> Preferred
                    </span>
                  )}
                  {analytics && (
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${rc.bg10} ${rc.border} ${rc.color}`}>
                      {rc.icon} {rc.label}
                    </span>
                  )}
                </div>
                {vendor.category && (
                  <p className="text-sm text-zinc-500">{CATEGORY_LABELS[vendor.category] ?? vendor.category}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/contracts/new?vendor_id=${vendor.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/20 border border-emerald-500/20 hover:bg-emerald-900/40 text-sm text-emerald-400 transition-colors">
                <Plus size={13} /> Add Contract
              </Link>
              <button type="button" onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-white transition-colors">
                <Pencil size={13} /> Edit
              </button>
              {!delConfirm ? (
                <button type="button" onClick={() => setDelConfirm(true)} aria-label="Delete vendor"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/40 text-sm text-zinc-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-400">Delete vendor?</span>
                  <button type="button" onClick={handleDelete} disabled={deleting}
                    className="px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white transition-colors disabled:opacity-50">
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
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-emerald-400" />
              <span className="text-xs text-zinc-500">Active Spend</span>
            </div>
            <p className="text-lg font-semibold text-white">
              {analytics ? formatCurrency(analytics.active_value) : "—"}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {analytics ? `${analytics.active_contracts} active contract${analytics.active_contracts !== 1 ? "s" : ""}` : "loading…"}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-zinc-400" />
              <span className="text-xs text-zinc-500">Total Lifetime</span>
            </div>
            <p className="text-lg font-semibold text-white">
              {analytics ? formatCurrency(analytics.total_value) : "—"}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {analytics ? `across ${analytics.total_contracts} contracts` : "loading…"}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={14} className="text-blue-400" />
              <span className="text-xs text-zinc-500">Covered Assets</span>
            </div>
            <p className="text-lg font-semibold text-white">
              {analytics != null ? analytics.covered_assets : "—"}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">assets under contract</p>
          </div>
          <div className={`rounded-xl p-4 border ${riskLevel === "critical" ? "bg-red-950/20 border-red-500/20" : riskLevel === "warning" ? "bg-amber-950/20 border-amber-500/20" : "bg-zinc-900 border-zinc-800"}`}>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} className={rc.color} />
              <span className="text-xs text-zinc-500">Risk Score</span>
            </div>
            <p className={`text-lg font-semibold ${rc.color}`}>
              {analytics != null ? `${analytics.risk_score}/100` : "—"}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">{rc.label}</p>
          </div>
        </div>

        {/* Critical expiring alert */}
        {analytics && analytics.critical_expiring > 0 && (
          <div className="flex items-start gap-3 bg-red-950/20 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">
                {analytics.critical_expiring} contract{analytics.critical_expiring !== 1 ? "s" : ""} expiring within 30 days
              </p>
              {analytics.soonest_expiry && (
                <p className="text-xs text-red-400/70 mt-0.5">
                  Soonest: {fmtDate(analytics.soonest_expiry)}
                  {analytics.days_until_soonest_expiry != null && analytics.days_until_soonest_expiry >= 0
                    ? ` (${analytics.days_until_soonest_expiry}d)`
                    : " (expired)"}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — details + risk */}
          <div className="lg:col-span-1 space-y-4">
            {/* Risk profile */}
            {analytics && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-medium text-zinc-300">Risk Profile</h2>
                <RiskScoreBar score={analytics.risk_score} level={analytics.risk_level} />
                <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-y-2 text-xs">
                  <span className="text-zinc-500">Active</span>
                  <span className="text-zinc-300 text-right">{analytics.active_contracts}</span>
                  <span className="text-zinc-500">Expired</span>
                  <span className={`text-right ${analytics.expired_contracts > 0 ? "text-red-400" : "text-zinc-300"}`}>{analytics.expired_contracts}</span>
                  <span className="text-zinc-500">Closed</span>
                  <span className="text-zinc-300 text-right">{analytics.closed_contracts}</span>
                  {analytics.avg_contract_value > 0 && <>
                    <span className="text-zinc-500">Avg value</span>
                    <span className="text-zinc-300 text-right">{formatCurrency(analytics.avg_contract_value)}</span>
                  </>}
                </div>
                {analytics.latest_expiry && (
                  <p className="text-xs text-zinc-500">
                    Coverage through <span className="text-zinc-300">{fmtDate(analytics.latest_expiry)}</span>
                  </p>
                )}
              </div>
            )}

            {/* Contact Details */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-medium text-zinc-300">Contact Details</h2>
              {vendor.support_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-zinc-500 shrink-0" />
                  <a href={`mailto:${vendor.support_email}`} className="text-emerald-400 hover:text-emerald-300 truncate">{vendor.support_email}</a>
                </div>
              )}
              {vendor.support_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-zinc-500 shrink-0" />
                  <a href={`tel:${vendor.support_phone}`} className="text-zinc-300">{vendor.support_phone}</a>
                </div>
              )}
              {vendor.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={14} className="text-zinc-500 shrink-0" />
                  <a href={vendor.website} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 truncate">
                    {vendor.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {vendor.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin size={14} className="text-zinc-500 shrink-0 mt-0.5" />
                  <span className="text-zinc-400">{vendor.address}</span>
                </div>
              )}
              {!vendor.support_email && !vendor.support_phone && !vendor.website && !vendor.address && (
                <p className="text-sm text-zinc-600">No contact info added.</p>
              )}
            </div>

            {/* Account Manager */}
            {(vendor.account_manager || vendor.account_manager_email) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
                <h2 className="text-sm font-medium text-zinc-300">Account Manager</h2>
                {vendor.account_manager && (
                  <div className="flex items-center gap-2 text-sm">
                    <User size={14} className="text-zinc-500" />
                    <span className="text-zinc-300">{vendor.account_manager}</span>
                  </div>
                )}
                {vendor.account_manager_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail size={14} className="text-zinc-500" />
                    <a href={`mailto:${vendor.account_manager_email}`} className="text-emerald-400 hover:text-emerald-300">{vendor.account_manager_email}</a>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {vendor.notes && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-sm font-medium text-zinc-300 mb-2">Notes</h2>
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">{vendor.notes}</p>
              </div>
            )}
          </div>

          {/* Right column — contracts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-300">
                Contracts ({vendor.total_contracts})
              </h2>
              <Link
                href={`/contracts/new?vendor_id=${vendor.id}`}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus size={12} /> Add contract
              </Link>
            </div>

            {!vendor.contracts || vendor.contracts.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <FileText size={28} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No contracts for this vendor yet.</p>
                <Link href={`/contracts/new?vendor_id=${vendor.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300">
                  <Plus size={13} /> Create first contract
                </Link>
              </div>
            ) : (
              <>
                {/* Summary spend bar */}
                {analytics && analytics.total_contracts > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500">Contract Health</span>
                      <span className="text-xs text-zinc-400">
                        {analytics.active_contracts}/{analytics.total_contracts} active
                      </span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden gap-px">
                      {analytics.active_contracts > 0 && (
                        <div className="bg-emerald-500 rounded-l-full"
                          style={{ flexGrow: analytics.active_contracts }} />
                      )}
                      {analytics.expired_contracts > 0 && (
                        <div className="bg-red-500"
                          style={{ flexGrow: analytics.expired_contracts }} />
                      )}
                      {analytics.closed_contracts > 0 && (
                        <div className="bg-zinc-600 rounded-r-full"
                          style={{ flexGrow: analytics.closed_contracts }} />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Active</span>
                      <span className="flex items-center gap-1 text-zinc-500"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Expired</span>
                      <span className="flex items-center gap-1 text-zinc-500"><span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" /> Closed</span>
                    </div>
                  </div>
                )}

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  {vendor.contracts.map((c) => <ContractRow key={c.id} c={c} />)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
