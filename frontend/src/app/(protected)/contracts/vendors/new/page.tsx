"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api-client";
import { Building2, ArrowLeft, Save } from "lucide-react";

const CATEGORY_OPTIONS = [
  { v: "hardware", l: "Hardware" }, { v: "software", l: "Software" },
  { v: "saas", l: "SaaS" }, { v: "services", l: "Services" },
  { v: "telecom", l: "Telecom" }, { v: "cloud", l: "Cloud" },
  { v: "maintenance", l: "Maintenance" }, { v: "other", l: "Other" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-sm font-medium text-zinc-300 mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-zinc-400 mb-1.5">{children}</label>;
}

function Input({ value, onChange, placeholder, type = "text", full = false }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; full?: boolean;
}) {
  return (
    <div className={full ? "col-span-full" : undefined}>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
      />
    </div>
  );
}

export default function NewVendorPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", category: "", website: "", support_email: "",
    support_phone: "", account_manager: "", account_manager_email: "",
    address: "", notes: "", is_preferred: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Vendor name is required"); return; }
    setSaving(true); setError("");
    try {
      const res = await api.post("/api/contracts/vendors", {
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
      router.push(`/contracts/vendors/${res.data.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create vendor");
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
              <Building2 size={18} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">New Vendor</h1>
              <p className="text-sm text-zinc-400">Add a vendor to your directory</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Section title="Vendor Identity">
            <div className="col-span-full">
              <Label>Vendor Name *</Label>
              <input
                value={form.name} onChange={e => set("name", e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <Label>Category</Label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                <option value="">Select category…</option>
                {CATEGORY_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={v => set("website", v)} placeholder="https://…" type="url" />
            </div>
            <div className="col-span-full">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_preferred} onChange={e => set("is_preferred", e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-0" />
                <span className="text-sm text-zinc-300">Mark as preferred vendor</span>
              </label>
            </div>
          </Section>

          <Section title="Support Contact">
            <div>
              <Label>Support Email</Label>
              <Input value={form.support_email} onChange={v => set("support_email", v)} type="email" placeholder="support@vendor.com" />
            </div>
            <div>
              <Label>Support Phone</Label>
              <Input value={form.support_phone} onChange={v => set("support_phone", v)} placeholder="+1 800 …" />
            </div>
          </Section>

          <Section title="Account Manager">
            <div>
              <Label>Name</Label>
              <Input value={form.account_manager} onChange={v => set("account_manager", v)} placeholder="Jane Smith" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.account_manager_email} onChange={v => set("account_manager_email", v)} type="email" />
            </div>
          </Section>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">Additional</h2>
            <div>
              <Label>Address</Label>
              <input value={form.address} onChange={e => set("address", e.target.value)}
                placeholder="123 Main St, City, Country"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <Label>Notes</Label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                rows={3} placeholder="Any notes about this vendor…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/contracts"
              className="px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
              <Save size={14} />{saving ? "Creating…" : "Create Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
