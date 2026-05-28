"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/lib/api-client"
import { ChevronLeft, Key, Loader2 } from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const LICENSE_TYPES = ["subscription","perpetual","oem","free","trial","volume","academic"]
const CURRENCIES = ["USD","EUR","GBP","INR","AUD","CAD","SGD","AED"]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewLicensePage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const [form, setForm] = useState({
    product_name:   "",
    vendor:         "",
    version:        "",
    license_type:   "subscription",
    seat_count:     "",      // empty = unlimited
    license_key:    "",
    purchase_date:  "",
    expiry_date:    "",
    renewal_date:   "",
    auto_renews:    false,
    cost_per_year:  "",
    currency:       "USD",
    vendor_contact: "",
    support_url:    "",
    notes:          "",
  })

  const upd = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    if (!form.product_name.trim()) { setError("Product name is required"); return }
    setSaving(true); setError("")
    try {
      const body: Record<string, unknown> = {
        product_name:   form.product_name,
        vendor:         form.vendor || null,
        version:        form.version || null,
        license_type:   form.license_type,
        seat_count:     form.seat_count ? parseInt(form.seat_count) : null,
        license_key:    form.license_key || null,
        purchase_date:  form.purchase_date || null,
        expiry_date:    form.expiry_date || null,
        renewal_date:   form.renewal_date || null,
        auto_renews:    form.auto_renews,
        cost_per_year:  form.cost_per_year ? parseFloat(form.cost_per_year) : null,
        currency:       form.currency,
        vendor_contact: form.vendor_contact || null,
        support_url:    form.support_url || null,
        notes:          form.notes || null,
      }
      const lic = await api.post<{ id: string }>("/api/assets/licenses", body, orgId)
      router.push(`/assets/licenses/${lic.id}`)
    } catch (err: any) {
      setError(err?.message || "Failed to create license")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/assets/licenses"
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-400" />
          <h1 className="text-lg font-semibold text-foreground">Add Software License</h1>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Product Info */}
        <Section title="Product">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Product Name *</Label>
              <Input value={form.product_name} onChange={v => upd("product_name", v)} placeholder="e.g. Microsoft 365 Business Premium" />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={form.vendor} onChange={v => upd("vendor", v)} placeholder="Microsoft" />
            </div>
            <div>
              <Label>Version</Label>
              <Input value={form.version} onChange={v => upd("version", v)} placeholder="2024" />
            </div>
            <div>
              <Label>License Type</Label>
              <Select value={form.license_type} onChange={v => upd("license_type", v)} options={LICENSE_TYPES} />
            </div>
            <div>
              <Label>Seat Count</Label>
              <Input value={form.seat_count} onChange={v => upd("seat_count", v)} type="number" min="1" placeholder="Leave blank for unlimited" />
            </div>
          </div>
        </Section>

        {/* Dates & Cost */}
        <Section title="Dates & Cost">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Purchase Date</Label>
              <Input value={form.purchase_date} onChange={v => upd("purchase_date", v)} type="date" />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input value={form.expiry_date} onChange={v => upd("expiry_date", v)} type="date" />
            </div>
            <div>
              <Label>Renewal Date</Label>
              <Input value={form.renewal_date} onChange={v => upd("renewal_date", v)} type="date" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.auto_renews}
                  onChange={e => upd("auto_renews", e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground">Auto-renews</span>
              </label>
            </div>
            <div>
              <Label>Annual Cost</Label>
              <div className="flex gap-2">
                <select
                  value={form.currency}
                  onChange={e => upd("currency", e.target.value)}
                  className="h-9 px-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring w-20"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Input value={form.cost_per_year} onChange={v => upd("cost_per_year", v)} type="number" step="0.01" placeholder="0.00" />
              </div>
            </div>
          </div>
        </Section>

        {/* Vendor & Support */}
        <Section title="Vendor & Support">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>License Key</Label>
              <input
                type="password"
                value={form.license_key}
                onChange={e => upd("license_key", e.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                autoComplete="off"
                className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Stored encrypted. Only visible to admins.</p>
            </div>
            <div>
              <Label>Vendor Contact</Label>
              <Input value={form.vendor_contact} onChange={v => upd("vendor_contact", v)} placeholder="support@vendor.com" />
            </div>
            <div>
              <Label>Support URL</Label>
              <Input value={form.support_url} onChange={v => upd("support_url", v)} placeholder="https://support.vendor.com" />
            </div>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <textarea
            value={form.notes}
            onChange={e => upd("notes", e.target.value)}
            rows={3}
            placeholder="Any additional notes about this license..."
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/assets/licenses"
            className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Add License
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mb-1.5">{children}</p>
}

function Input({ value, onChange, placeholder, type = "text", step, min, max }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; step?: string; min?: string; max?: string
}) {
  return (
    <input
      type={type} value={value} step={step} min={min} max={max}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    />
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
    </select>
  )
}
