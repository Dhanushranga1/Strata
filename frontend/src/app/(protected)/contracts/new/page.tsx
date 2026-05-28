"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import api from "@/lib/api-client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { FileText, ArrowLeft, Save } from "lucide-react";

// ── Options ───────────────────────────────────────────────────────────────────

const CONTRACT_TYPES = [
  { v: "service", l: "Service Agreement" },
  { v: "hardware", l: "Hardware" },
  { v: "software_license", l: "Software License" },
  { v: "maintenance", l: "Maintenance" },
  { v: "support", l: "Support" },
  { v: "lease", l: "Lease" },
  { v: "nda", l: "NDA" },
  { v: "sla", l: "SLA" },
  { v: "cloud", l: "Cloud Services" },
  { v: "other", l: "Other" },
];

const PAYMENT_SCHEDULES = [
  { v: "one_time", l: "One-time" },
  { v: "monthly", l: "Monthly" },
  { v: "quarterly", l: "Quarterly" },
  { v: "annual", l: "Annual" },
  { v: "custom", l: "Custom" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "SGD", "AED"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fetcher = (url: string) => api.get(url).then(r => r.data);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-sm font-medium text-zinc-300 mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs text-zinc-400 mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function NewContractPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { currentOrganization } = useOrganization();

  const { data: vendorsData } = useSWR(
    currentOrganization?.id ? "/api/contracts/vendors?limit=200" : null, fetcher
  );
  const vendors: { id: string; name: string }[] = vendorsData?.vendors ?? [];

  const [form, setForm] = useState({
    title: "",
    vendor_id: searchParams.get("vendor_id") ?? "",
    contract_number: "",
    status: "active",
    contract_type: "",
    description: "",
    start_date: "",
    end_date: "",
    renewal_date: "",
    auto_renews: false,
    renewal_notice_days: "30",
    total_value: "",
    currency: "USD",
    payment_schedule: "",
    payment_amount: "",
    document_url: "",
    // Key terms (structured)
    sla_response_hours: "",
    uptime_guarantee: "",
    support_hours: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Contract title is required"); return; }
    setSaving(true); setError("");

    const key_terms: Record<string, string | number> = {};
    if (form.sla_response_hours) key_terms.sla_response_hours = Number(form.sla_response_hours);
    if (form.uptime_guarantee)   key_terms.uptime_guarantee   = form.uptime_guarantee;
    if (form.support_hours)      key_terms.support_hours      = form.support_hours;

    const payload: Record<string, any> = {
      title:               form.title,
      vendor_id:           form.vendor_id || null,
      contract_number:     form.contract_number || null,
      status:              form.status,
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
      key_terms,
    };

    try {
      const res = await api.post("/api/contracts", payload);
      router.push(`/contracts/${res.data.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create contract");
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/contracts" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-4 transition-colors w-fit">
            <ArrowLeft size={14} /> Back to ContractVault
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <FileText size={18} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">New Contract</h1>
              <p className="text-sm text-zinc-400">Add a contract or agreement to your vault</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identity */}
          <Section title="Contract Identity">
            <div className="col-span-full">
              <Label required>Title</Label>
              <input value={form.title} onChange={e => set("title", e.target.value)} required
                placeholder="e.g. Microsoft 365 Business Subscription"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <Label>Vendor</Label>
              <select value={form.vendor_id} onChange={e => set("vendor_id", e.target.value)} aria-label="Vendor"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                <option value="">No vendor / internal</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Contract Number</Label>
              <input value={form.contract_number} onChange={e => set("contract_number", e.target.value)}
                placeholder="e.g. MSA-2024-001"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <Label>Type</Label>
              <select value={form.contract_type} onChange={e => set("contract_type", e.target.value)} aria-label="Contract type"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                <option value="">Select type…</option>
                {CONTRACT_TYPES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select value={form.status} onChange={e => set("status", e.target.value)} aria-label="Status"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="terminated">Terminated</option>
                <option value="renewed">Renewed</option>
              </select>
            </div>
            <div className="col-span-full">
              <Label>Description</Label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                rows={3} placeholder="Brief description of what this contract covers…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none" />
            </div>
          </Section>

          {/* Dates */}
          <Section title="Dates & Renewal">
            <div>
              <Label>Start Date</Label>
              <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)}
                aria-label="Start date"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <Label>End Date</Label>
              <input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)}
                aria-label="End date"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <Label>Renewal Date</Label>
              <input type="date" value={form.renewal_date} onChange={e => set("renewal_date", e.target.value)}
                aria-label="Renewal date"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <Label>Notice Period (days)</Label>
              <input type="number" min="0" value={form.renewal_notice_days} onChange={e => set("renewal_notice_days", e.target.value)}
                aria-label="Notice period in days"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="col-span-full">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_renews} onChange={e => set("auto_renews", e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-0" />
                <span className="text-sm text-zinc-300">Auto-renews unless cancelled</span>
              </label>
              {form.auto_renews && (
                <p className="mt-1.5 text-xs text-amber-400">
                  CASPER will alert you {form.renewal_notice_days || 30} days before the renewal date.
                </p>
              )}
            </div>
          </Section>

          {/* Financials */}
          <Section title="Financials">
            <div>
              <Label>Total Value</Label>
              <input type="number" min="0" step="0.01" value={form.total_value} onChange={e => set("total_value", e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <Label>Currency</Label>
              <select value={form.currency} onChange={e => set("currency", e.target.value)} aria-label="Currency"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Payment Schedule</Label>
              <select value={form.payment_schedule} onChange={e => set("payment_schedule", e.target.value)} aria-label="Payment schedule"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                <option value="">Select…</option>
                {PAYMENT_SCHEDULES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <Label>Payment Amount (per cycle)</Label>
              <input type="number" min="0" step="0.01" value={form.payment_amount} onChange={e => set("payment_amount", e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
          </Section>

          {/* Key Terms */}
          <Section title="Key Terms (optional)">
            <div>
              <Label>SLA Response Hours</Label>
              <input type="number" min="0" value={form.sla_response_hours} onChange={e => set("sla_response_hours", e.target.value)}
                placeholder="e.g. 4"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <Label>Support Hours</Label>
              <input value={form.support_hours} onChange={e => set("support_hours", e.target.value)}
                placeholder="e.g. 24x7 or 9-5 M-F"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="col-span-full">
              <Label>Uptime Guarantee</Label>
              <input value={form.uptime_guarantee} onChange={e => set("uptime_guarantee", e.target.value)}
                placeholder="e.g. 99.9%"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
          </Section>

          {/* Document */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-sm font-medium text-zinc-300 mb-4">Document</h2>
            <Label>Document URL</Label>
            <input type="url" value={form.document_url} onChange={e => set("document_url", e.target.value)}
              placeholder="https://drive.google.com/… or Supabase Storage URL"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            <p className="text-xs text-zinc-600 mt-1.5">Paste a link to the signed contract PDF.</p>
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/contracts"
              className="px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={saving || !form.title.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
              <Save size={14} />{saving ? "Creating…" : "Create Contract"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
