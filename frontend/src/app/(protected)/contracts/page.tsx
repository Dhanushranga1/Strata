"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import {
  FileText, Building2, Plus, Search, ExternalLink,
  AlertTriangle, CheckCircle2, Clock, XCircle, Star,
  ChevronRight, Phone, Mail, Globe, Calendar, TrendingUp,
  DollarSign, BarChart3, RefreshCw, Filter, ChevronDown,
  CheckSquare, Square, X, MoreHorizontal, Shield, Zap,
  AlertCircle, ArrowUpRight, Eye, Layers,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Vendor {
  id: string; name: string; category: string | null;
  website: string | null; support_email: string | null;
  support_phone: string | null; account_manager: string | null;
  is_preferred: boolean; active_contracts: number; total_contracts: number;
}

interface Contract {
  id: string; title: string; vendor_id: string | null;
  vendor_name?: string | null; status: string;
  contract_type: string | null; start_date: string | null;
  end_date: string | null; renewal_date: string | null;
  total_value: number | null; currency: string;
  auto_renews: boolean; renewal_notice_days: number;
  days_until_expiry: number | null; is_expired: boolean;
  expiry_status: "ok" | "warning" | "critical" | "expired";
}

interface Dashboard {
  stats: {
    total_contracts: number; active_contracts: number;
    expiring_30d: number; total_vendors: number;
    total_value: number; currency: string;
    draft_count: number; expired_count: number;
  };
  expiring_soon: Contract[];
}

interface CalendarData {
  calendar: Record<string, CalendarContract[]>;
}

interface CalendarContract {
  id: string; title: string; end_date: string; status: string;
  vendor_name: string | null; days_until_end: number;
  expiry_status: string; total_value: number | null; currency: string;
  auto_renews: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fetcher = (url: string) => api.get(url).then(r => r.data);

const CATEGORY_LABELS: Record<string, string> = {
  hardware: "Hardware", software: "Software", saas: "SaaS",
  services: "Services", telecom: "Telecom", cloud: "Cloud",
  maintenance: "Maintenance", other: "Other",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  service: "Service", hardware: "Hardware", software_license: "SW License",
  maintenance: "Maintenance", support: "Support", lease: "Lease",
  nda: "NDA", sla: "SLA", cloud: "Cloud", other: "Other",
};

const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  active:     { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-400",  label: "Active" },
  draft:      { color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/25",          dot: "bg-zinc-400",    label: "Draft" },
  expired:    { color: "text-red-400 bg-red-500/10 border-red-500/25",             dot: "bg-red-400",     label: "Expired" },
  terminated: { color: "text-orange-400 bg-orange-500/10 border-orange-500/25",    dot: "bg-orange-400",  label: "Terminated" },
  renewed:    { color: "text-blue-400 bg-blue-500/10 border-blue-500/25",          dot: "bg-blue-400",    label: "Renewed" },
};

const EXPIRY_COLOR: Record<string, string> = {
  expired:  "text-red-400 bg-red-500/10 border-red-500/25",
  critical: "text-orange-400 bg-orange-500/10 border-orange-500/25",
  warning:  "text-amber-400 bg-amber-500/10 border-amber-500/25",
  ok:       "text-zinc-500",
};

function fmtCurrency(v: number | null, cur = "USD") {
  if (v == null || v === 0) return "—";
  if (v >= 1_000_000) return `${cur} ${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${cur} ${(v/1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = "text-white", alert,
}: {
  label: string; value: React.ReactNode; sub?: string;
  accent?: string; alert?: boolean;
}) {
  return (
    <div className={`bg-zinc-900 border rounded-xl p-4 ${alert ? "border-amber-500/30 bg-amber-950/10" : "border-zinc-800"}`}>
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${alert ? "text-amber-400" : "text-zinc-500"}`}>{sub}</p>}
    </div>
  );
}

// ── Status Badge (inline clickable dropdown) ───────────────────────────────────

function StatusBadge({ contractId, status, onChanged }: {
  contractId: string; status: string; onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  const STATUSES = ["draft", "active", "expired", "terminated", "renewed"];

  async function change(s: string) {
    if (s === status) { setOpen(false); return; }
    setSaving(true);
    try {
      await api.post(`/api/contracts/${contractId}/status?status=${s}`, {});
      globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/contracts"), undefined, { revalidate: true });
      onChanged?.();
    } catch (e) { /* noop */ }
    finally { setSaving(false); setOpen(false); }
  }

  return (
    <div className="relative" onClick={e => e.preventDefault()}>
      <button
        type="button"
        onClick={() => !saving && setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${cfg.color} hover:opacity-80 transition-opacity cursor-pointer`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${saving ? "animate-pulse" : ""}`} />
        {cfg.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 bg-zinc-800 border border-zinc-700 rounded-lg py-1 min-w-[130px] shadow-xl">
          {STATUSES.map(s => {
            const sc = STATUS_CONFIG[s];
            return (
              <button key={s} type="button" onClick={() => change(s)}
                className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-700 transition-colors ${s === status ? "opacity-50" : ""}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc?.dot}`} />
                {sc?.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Expiry bar ─────────────────────────────────────────────────────────────────

function ExpiryBar({ days, total = 365 }: { days: number | null; total?: number }) {
  if (days == null) return <span className="text-xs text-zinc-600">No end date</span>;
  if (days < 0) return <span className="text-xs text-red-400 font-medium">Expired</span>;
  const pct = Math.max(0, Math.min(100, ((total - days) / total) * 100));
  const color = days <= 30 ? "bg-red-500" : days <= 90 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs shrink-0 ${days <= 30 ? "text-red-400 font-medium" : days <= 90 ? "text-amber-400" : "text-zinc-500"}`}>
        {days}d
      </span>
    </div>
  );
}

// ── Vendor Card ────────────────────────────────────────────────────────────────

function VendorCard({ vendor }: { vendor: Vendor }) {
  return (
    <Link href={`/contracts/vendors/${vendor.id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-emerald-500/40 transition-all group hover:shadow-lg hover:shadow-emerald-900/10">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-white truncate">{vendor.name}</p>
              {vendor.is_preferred && <Star size={11} className="text-amber-400 shrink-0 fill-amber-400" />}
            </div>
            <p className="text-xs text-zinc-500">{vendor.category ? (CATEGORY_LABELS[vendor.category] ?? vendor.category) : "Vendor"}</p>
          </div>
        </div>
        <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 shrink-0 transition-colors mt-0.5" />
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
        {vendor.support_email && <span className="flex items-center gap-1 truncate"><Mail size={10} />{vendor.support_email}</span>}
        {vendor.support_phone && <span className="flex items-center gap-1"><Phone size={10} />{vendor.support_phone}</span>}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          <span className="text-emerald-400 font-medium">{vendor.active_contracts}</span> active · {vendor.total_contracts} total
        </span>
        {vendor.account_manager && (
          <span className="text-xs text-zinc-600 truncate max-w-[120px]">{vendor.account_manager}</span>
        )}
      </div>
    </Link>
  );
}

// ── Contract row with bulk select ──────────────────────────────────────────────

function ContractRow({
  contract, selected, onSelect,
}: {
  contract: Contract; selected: boolean; onSelect: (id: string) => void;
}) {
  const es = contract.expiry_status;
  return (
    <div className={`flex items-center gap-0 group transition-colors ${selected ? "bg-emerald-950/20" : "hover:bg-zinc-800/40"}`}>
      {/* Checkbox */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onSelect(contract.id); }}
        className="p-3 pl-4 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
      >
        {selected
          ? <CheckSquare size={15} className="text-emerald-400" />
          : <Square size={15} />
        }
      </button>

      {/* Main content — navigates to detail */}
      <Link href={`/contracts/${contract.id}`} className="flex flex-1 items-center gap-3 py-3 pr-4 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <FileText size={13} className="text-emerald-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{contract.title}</p>
          <p className="text-xs text-zinc-500 truncate">
            {contract.vendor_name ?? "—"}
            {contract.contract_type && ` · ${CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type}`}
          </p>
        </div>

        {/* Expiry bar */}
        <div className="w-28 hidden md:block">
          <ExpiryBar days={contract.days_until_expiry} />
        </div>

        {/* Value */}
        <span className="text-sm text-zinc-400 w-20 text-right hidden lg:block">
          {fmtCurrency(contract.total_value, contract.currency)}
        </span>

        {/* Auto-renews */}
        {contract.auto_renews && (
          <span title="Auto-renews">
            <RefreshCw size={12} className="text-blue-400 hidden sm:block" />
          </span>
        )}

        {/* Status badge */}
        <div onClick={e => e.preventDefault()}>
          <StatusBadge contractId={contract.id} status={contract.status} />
        </div>

        <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
      </Link>
    </div>
  );
}

// ── Bulk action bar ────────────────────────────────────────────────────────────

function BulkBar({
  count, onStatusChange, onClear,
}: {
  count: number; onStatusChange: (s: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const STATUSES = ["active", "draft", "terminated", "renewed", "expired"];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2">
        <CheckSquare size={15} className="text-emerald-400" />
        <span className="text-sm font-medium text-white">{count} selected</span>
      </div>
      <div className="w-px h-5 bg-zinc-700" />

      <div className="relative">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
          Change Status <ChevronDown size={13} />
        </button>
        {open && (
          <div className="absolute bottom-full mb-1 left-0 bg-zinc-800 border border-zinc-700 rounded-lg py-1 min-w-[140px] shadow-xl">
            {STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              return (
                <button key={s} type="button"
                  onClick={() => { onStatusChange(s); setOpen(false); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-700 transition-colors">
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                  {cfg?.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button type="button" onClick={onClear} aria-label="Clear selection"
        className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
        <X size={15} />
      </button>
    </div>
  );
}

// ── Calendar column ────────────────────────────────────────────────────────────

function CalendarPanel({ orgId }: { orgId: string }) {
  const { data } = useSWR<CalendarData>(
    orgId ? "/api/contracts/calendar?months=4" : null, fetcher
  );

  if (!data || Object.keys(data.calendar).length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={15} className="text-emerald-400" />
          <h3 className="text-sm font-medium text-white">Renewal Calendar</h3>
        </div>
        <p className="text-xs text-zinc-600 text-center py-4">No upcoming renewals</p>
      </div>
    );
  }

  const EXPIRY_DOT: Record<string, string> = {
    expired: "bg-red-400", critical: "bg-orange-400",
    warning: "bg-amber-400", ok: "bg-emerald-400",
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={15} className="text-emerald-400" />
        <h3 className="text-sm font-medium text-white">Renewal Calendar</h3>
      </div>
      <div className="space-y-5">
        {Object.entries(data.calendar).map(([ym, contracts]) => (
          <div key={ym}>
            <p className="text-xs font-medium text-zinc-400 mb-2">{fmtMonth(ym)}</p>
            <div className="space-y-1.5">
              {contracts.map(c => (
                <Link key={c.id} href={`/contracts/${c.id}`}
                  className="flex items-center gap-2 group">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${EXPIRY_DOT[c.expiry_status] ?? "bg-zinc-500"}`} />
                  <span className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate flex-1">{c.title}</span>
                  <span className="text-xs text-zinc-600 shrink-0">{c.days_until_end}d</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Spend summary ──────────────────────────────────────────────────────────────

function SpendSummary({ dashboard }: { dashboard: Dashboard | undefined }) {
  if (!dashboard?.stats) return null;
  const s = dashboard.stats;
  if (!s.total_value) return null;

  const breakdown = [
    { label: "Active contracts",  value: s.active_contracts,  color: "bg-emerald-400" },
    { label: "Drafts",            value: s.draft_count ?? 0,  color: "bg-zinc-500" },
    { label: "Expired",           value: s.expired_count ?? 0, color: "bg-red-400" },
  ].filter(x => x.value > 0);

  const total = breakdown.reduce((a, b) => a + b.value, 0) || 1;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={15} className="text-emerald-400" />
        <h3 className="text-sm font-medium text-white">Portfolio</h3>
      </div>

      <div className="mb-4">
        <p className="text-2xl font-bold text-white">{fmtCurrency(s.total_value)}</p>
        <p className="text-xs text-zinc-500 mt-0.5">Total contract value</p>
      </div>

      {/* Stacked bar — flex-grow avoids inline width style */}
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-3">
        {breakdown.map(b => (
          <div key={b.label} className={`${b.color} rounded-full min-w-0`}
            style={{ flexGrow: b.value }} />
        ))}
      </div>

      <div className="space-y-1.5">
        {breakdown.map(b => (
          <div key={b.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${b.color}`} />
              <span className="text-zinc-400">{b.label}</span>
            </div>
            <span className="text-zinc-300 font-medium">{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [tab, setTab]             = useState<"contracts" | "vendors">("contracts");
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [page, setPage]           = useState(1);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState<number | "">("");

  const { data: dash } = useSWR<Dashboard>(
    orgId ? "/api/contracts/dashboard" : null, fetcher
  );

  const contractParams = useMemo(() => {
    const p = new URLSearchParams();
    if (search)       p.set("search", search);
    if (statusFilter) p.set("status", statusFilter);
    if (expiryFilter) p.set("expiring", String(expiryFilter));
    p.set("page", String(page));
    p.set("limit", "50");
    return p.toString();
  }, [search, statusFilter, expiryFilter, page]);

  const contractsKey = orgId && tab === "contracts" ? `/api/contracts?${contractParams}` : null;
  const { data: contractsData, mutate: refreshContracts } = useSWR<{
    contracts: Contract[]; total: number; pages: number;
  }>(contractsKey, fetcher);

  const vendorParams = new URLSearchParams();
  if (search) vendorParams.set("search", search);
  const { data: vendorsData } = useSWR<{ vendors: Vendor[]; total: number }>(
    orgId && tab === "vendors" ? `/api/contracts/vendors?${vendorParams}&limit=100` : null,
    fetcher
  );

  const contracts = contractsData?.contracts ?? [];
  const vendors   = vendorsData?.vendors ?? [];

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(prev =>
      prev.size === contracts.length
        ? new Set()
        : new Set(contracts.map(c => c.id))
    );
  }, [contracts]);

  // ── Bulk status change ────────────────────────────────────────────────────

  async function bulkStatusChange(status: string) {
    if (selected.size === 0 || bulkSaving) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        [...selected].map(id =>
          api.post(`/api/contracts/${id}/status?status=${status}`, {})
        )
      );
      setSelected(new Set());
      refreshContracts();
    } catch (e) {
      alert("Some status changes failed.");
    } finally {
      setBulkSaving(false);
    }
  }

  const stats = dash?.stats;

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950">
      <div className="flex h-full">
        {/* Main content */}
        <div className="flex-1 min-w-0 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <FileText size={15} className="text-emerald-400" />
                  </div>
                  ContractVault
                </h1>
                <p className="text-sm text-zinc-400 mt-0.5">Vendor directory · contract lifecycle · renewal tracking</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/contracts/vendors/new"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 transition-colors border border-zinc-700">
                  <Building2 size={13} /> New Vendor
                </Link>
                <Link href="/contracts/new"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-medium transition-colors">
                  <Plus size={13} /> New Contract
                </Link>
              </div>
            </div>

            {/* ── Stats row ────────────────────────────────────────────── */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Active"      value={stats.active_contracts}  accent="text-emerald-400" />
                <StatCard label="Vendors"     value={stats.total_vendors} />
                <StatCard
                  label="Renewing (30d)"
                  value={stats.expiring_30d}
                  accent={stats.expiring_30d > 0 ? "text-amber-400" : "text-white"}
                  alert={stats.expiring_30d > 0}
                  sub={stats.expiring_30d > 0 ? "Action required" : "All clear"}
                />
                <StatCard label="Portfolio" value={fmtCurrency(stats.total_value)} accent="text-blue-300" />
              </div>
            )}

            {/* ── Expiring banner ───────────────────────────────────────── */}
            {dash?.expiring_soon && dash.expiring_soon.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-500/25 rounded-xl">
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-500/15">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <p className="text-sm font-medium text-amber-300">
                    {dash.expiring_soon.length} contract{dash.expiring_soon.length !== 1 ? "s" : ""} expiring in the next 30 days
                  </p>
                </div>
                <div className="px-4 py-2 flex flex-wrap gap-x-6 gap-y-1.5">
                  {dash.expiring_soon.map(c => (
                    <Link key={c.id} href={`/contracts/${c.id}`}
                      className="flex items-center gap-2 text-sm group">
                      <span className="text-zinc-300 group-hover:text-white transition-colors truncate max-w-[200px]">{c.title}</span>
                      <span className="text-amber-400 font-medium text-xs shrink-0">{c.days_until_expiry}d →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tabs ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
                {(["contracts", "vendors"] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => { setTab(t); setSearch(""); setPage(1); setSelected(new Set()); }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                      tab === t ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
                    }`}>
                    {t}
                    {t === "contracts" && contractsData && (
                      <span className="ml-1.5 text-xs opacity-60">{contractsData.total}</span>
                    )}
                    {t === "vendors" && vendorsData && (
                      <span className="ml-1.5 text-xs opacity-60">{vendorsData.total}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Filters row ─────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input type="text" value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }}
                  placeholder={tab === "vendors" ? "Search vendors…" : "Search contracts, vendors…"}
                  className="w-full pl-8 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
              </div>

              {tab === "contracts" && (
                <>
                  <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
                    aria-label="Filter by status"
                    className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="">All status</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="expired">Expired</option>
                    <option value="terminated">Terminated</option>
                    <option value="renewed">Renewed</option>
                  </select>

                  <select value={expiryFilter} onChange={e => { setExpiryFilter(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
                    aria-label="Filter by expiry"
                    className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="">Any expiry</option>
                    <option value="30">Expiring ≤ 30d</option>
                    <option value="60">Expiring ≤ 60d</option>
                    <option value="90">Expiring ≤ 90d</option>
                  </select>

                  {contracts.length > 0 && (
                    <button type="button" onClick={toggleAll}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-700 rounded-lg hover:border-emerald-500/50 transition-colors">
                      {selected.size === contracts.length
                        ? <><CheckSquare size={13} className="text-emerald-400" /> Deselect all</>
                        : <><Square size={13} /> Select all</>
                      }
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ── Vendors grid ─────────────────────────────────────────── */}
            {tab === "vendors" && (
              !vendorsData ? (
                <div className="text-center py-16 text-zinc-500">Loading vendors…</div>
              ) : vendors.length === 0 ? (
                <div className="text-center py-16">
                  <Building2 size={36} className="text-zinc-800 mx-auto mb-3" />
                  <p className="text-zinc-400 mb-3">No vendors yet</p>
                  <Link href="/contracts/vendors/new"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-lg px-4 py-2 transition-colors">
                    <Plus size={14} /> Add your first vendor
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {vendors.map(v => <VendorCard key={v.id} vendor={v} />)}
                </div>
              )
            )}

            {/* ── Contracts list ───────────────────────────────────────── */}
            {tab === "contracts" && (
              !contractsData ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : contracts.length === 0 ? (
                <div className="text-center py-16">
                  <FileText size={36} className="text-zinc-800 mx-auto mb-3" />
                  <p className="text-zinc-400 mb-3">No contracts found</p>
                  <Link href="/contracts/new"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-lg px-4 py-2 transition-colors">
                    <Plus size={14} /> Add your first contract
                  </Link>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
                      <button type="button" onClick={toggleAll} className="pl-0.5 text-zinc-600 hover:text-zinc-300">
                        {selected.size > 0 && selected.size === contracts.length
                          ? <CheckSquare size={14} className="text-emerald-400" />
                          : <Square size={14} />
                        }
                      </button>
                      <span className="text-xs text-zinc-500 font-medium flex-1">CONTRACT</span>
                      <span className="text-xs text-zinc-500 font-medium w-28 hidden md:block">EXPIRY</span>
                      <span className="text-xs text-zinc-500 font-medium w-20 text-right hidden lg:block">VALUE</span>
                      <span className="text-xs text-zinc-500 font-medium w-6 hidden sm:block" />
                      <span className="text-xs text-zinc-500 font-medium w-24">STATUS</span>
                      <span className="w-5" />
                    </div>
                    {contracts.map(c => (
                      <div key={c.id} className="border-b border-zinc-800/50 last:border-b-0">
                        <ContractRow
                          contract={c}
                          selected={selected.has(c.id)}
                          onSelect={toggleSelect}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {contractsData.pages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <button type="button" disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-40 hover:bg-zinc-700 transition-colors">
                        Previous
                      </button>
                      <span className="text-sm text-zinc-500">Page {page} of {contractsData.pages}</span>
                      <button type="button" disabled={page >= contractsData.pages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-40 hover:bg-zinc-700 transition-colors">
                        Next
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 border-l border-zinc-800 p-4 space-y-4 overflow-y-auto hidden xl:block">
          <SpendSummary dashboard={dash} />
          <CalendarPanel orgId={orgId ?? ""} />
        </div>
      </div>

      {/* ── Bulk bar ──────────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onStatusChange={bulkStatusChange}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
