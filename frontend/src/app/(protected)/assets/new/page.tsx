"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/lib/api-client"
import { Package, ChevronLeft, Plus, Minus } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  "laptop","desktop","server","phone","tablet","monitor",
  "network","printer","peripheral","software","cloud","vehicle","furniture","other",
]
const WARRANTY_TYPES = ["manufacturer","extended","third_party","none"]
const CONDITIONS = ["excellent","good","fair","poor","damaged"]
const CURRENCIES = ["USD","EUR","GBP","INR","AUD","CAD","SGD","AED"]

export default function NewAssetPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [tags, setTags]     = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")

  const [form, setForm] = useState({
    asset_tag:          "",
    name:               "",
    category:           "laptop",
    status:             "active",
    condition_rating:   "good",
    department:         "",
    location:           "",
    // Specs
    serial_number:      "",
    model:              "",
    manufacturer:       "",
    cpu:                "",
    ram_gb:             "",
    storage_gb:         "",
    os:                 "",
    os_version:         "",
    // Purchase
    purchase_date:      "",
    purchase_price:     "",
    currency:           "USD",
    vendor_name:        "",
    po_number:          "",
    invoice_number:     "",
    // Warranty
    warranty_expiry:    "",
    warranty_type:      "manufacturer",
    warranty_notes:     "",
    // Misc
    depreciation_years: "3",
    notes:              "",
  })

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    if (!form.name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const specs: Record<string, string> = {}
      for (const k of ["serial_number","model","manufacturer","cpu","ram_gb","storage_gb","os","os_version"]) {
        if ((form as any)[k]) specs[k] = (form as any)[k]
      }
      const body = {
        asset_tag:          form.asset_tag || undefined,
        name:               form.name,
        category:           form.category,
        status:             form.status,
        condition_rating:   form.condition_rating,
        department:         form.department || undefined,
        location:           form.location || undefined,
        specs,
        purchase_date:      form.purchase_date || undefined,
        purchase_price:     form.purchase_price ? parseFloat(form.purchase_price) : undefined,
        currency:           form.currency,
        vendor_name:        form.vendor_name || undefined,
        po_number:          form.po_number || undefined,
        invoice_number:     form.invoice_number || undefined,
        warranty_expiry:    form.warranty_expiry || undefined,
        warranty_type:      form.warranty_type,
        warranty_notes:     form.warranty_notes || undefined,
        depreciation_years: parseInt(form.depreciation_years) || 3,
        notes:              form.notes || undefined,
        tags,
      }
      const asset = await api.post<{ id: string }>("/api/assets", body, orgId)
      router.push(`/assets/${asset.id}`)
    } catch (err: any) {
      setError(err.message || "Failed to create asset")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/assets" className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-400" />
            <h1 className="text-base font-bold">Add Asset</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-sm text-red-400">{error}</div>
        )}

        {/* Identity */}
        <section>
          <h2 className="text-sm font-semibold mb-4">Identity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Name <span className="text-red-400">*</span></label>
              <input required value={form.name} onChange={e => upd("name", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
                placeholder="e.g. MacBook Pro 16-inch" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Asset Tag <span className="text-muted-foreground/50">(auto if blank)</span></label>
              <input value={form.asset_tag} onChange={e => upd("asset_tag", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50 font-mono"
                placeholder="ASSET-0001" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Category</label>
              <select value={form.category} onChange={e => upd("category", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground capitalize">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Condition</label>
              <select value={form.condition_rating} onChange={e => upd("condition_rating", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground capitalize">
                {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Department</label>
              <input value={form.department} onChange={e => upd("department", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
                placeholder="e.g. Engineering" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Location</label>
              <input value={form.location} onChange={e => upd("location", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
                placeholder="e.g. HQ Floor 2, Desk 14" />
            </div>
          </div>
        </section>

        {/* Hardware specs */}
        <section>
          <h2 className="text-sm font-semibold mb-4">Hardware Specs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "serial_number", label: "Serial Number", placeholder: "SN/IMEI" },
              { key: "model",         label: "Model",          placeholder: "e.g. MBP16,2" },
              { key: "manufacturer",  label: "Manufacturer",   placeholder: "e.g. Apple" },
              { key: "cpu",           label: "CPU",            placeholder: "e.g. M3 Pro" },
              { key: "ram_gb",        label: "RAM (GB)",       placeholder: "e.g. 16" },
              { key: "storage_gb",    label: "Storage (GB)",   placeholder: "e.g. 512" },
              { key: "os",            label: "OS",             placeholder: "e.g. macOS" },
              { key: "os_version",    label: "OS Version",     placeholder: "e.g. 15.4" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-muted-foreground mb-1.5">{label}</label>
                <input value={(form as any)[key]} onChange={e => upd(key, e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
                  placeholder={placeholder} />
              </div>
            ))}
          </div>
        </section>

        {/* Purchase */}
        <section>
          <h2 className="text-sm font-semibold mb-4">Purchase Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={e => upd("purchase_date", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase Price</label>
                <input type="number" min="0" step="0.01" value={form.purchase_price}
                  onChange={e => upd("purchase_price", e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
                  placeholder="0.00" />
              </div>
              <div className="w-24">
                <label className="block text-xs text-muted-foreground mb-1.5">Currency</label>
                <select value={form.currency} onChange={e => upd("currency", e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Vendor / Supplier</label>
              <input value={form.vendor_name} onChange={e => upd("vendor_name", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
                placeholder="e.g. Dell Direct" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">PO Number</label>
              <input value={form.po_number} onChange={e => upd("po_number", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50 font-mono"
                placeholder="PO-2025-0042" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Invoice Number</label>
              <input value={form.invoice_number} onChange={e => upd("invoice_number", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50 font-mono" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Depreciation Years</label>
              <input type="number" min="1" max="20" value={form.depreciation_years}
                onChange={e => upd("depreciation_years", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50" />
            </div>
          </div>
        </section>

        {/* Warranty */}
        <section>
          <h2 className="text-sm font-semibold mb-4">Warranty</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Warranty Expiry</label>
              <input type="date" value={form.warranty_expiry} onChange={e => upd("warranty_expiry", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Warranty Type</label>
              <select value={form.warranty_type} onChange={e => upd("warranty_type", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground capitalize">
                {WARRANTY_TYPES.map(t => <option key={t} value={t}>{t.replace("_"," ")}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1.5">Warranty Notes</label>
              <input value={form.warranty_notes} onChange={e => upd("warranty_notes", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
                placeholder="e.g. On-site support, case ref DL-12345" />
            </div>
          </div>
        </section>

        {/* Tags & Notes */}
        <section>
          <h2 className="text-sm font-semibold mb-4">Tags & Notes</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {t}
                    <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))}
                      className="hover:text-red-400 transition-colors">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag() }}}
                  className="flex-1 px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
                  placeholder="Add tag and press Enter" />
                <button type="button" onClick={addTag}
                  className="px-3 py-2 rounded-lg border border-border hover:bg-muted/50 text-muted-foreground transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => upd("notes", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50 resize-none"
                placeholder="Any additional notes…" />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? "Creating…" : "Create Asset"}
          </button>
          <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
