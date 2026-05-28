"use client"

import { useState, use, useEffect } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/lib/api-client"
import { ChevronLeft, Save, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "laptop","desktop","server","phone","tablet","monitor",
  "network","printer","peripheral","software","cloud","vehicle","furniture","other",
]
const STATUSES = ["pending","active","deployed","in_repair","in_storage","lost","retired","disposed"]
const CONDITIONS = ["excellent","good","fair","poor","damaged"]
const WARRANTY_TYPES = ["manufacturer","extended","third_party","none"]
const CURRENCIES = ["USD","EUR","GBP","INR","AUD","CAD","SGD","AED"]

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetDetail {
  id: string
  asset_tag: string
  name: string
  category: string
  status: string
  condition_rating: string
  department: string | null
  location: string | null
  assigned_to: string | null
  specs: Record<string, string>
  purchase_date: string | null
  purchase_price: number | null
  currency: string
  vendor_name: string | null
  po_number: string | null
  invoice_number: string | null
  warranty_expiry: string | null
  warranty_type: string
  warranty_notes: string | null
  depreciation_years: number
  notes: string | null
  tags: string[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = use(params)
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const { data: asset, isLoading } = useSWR<AssetDetail>(
    orgId ? [`/api/assets/${assetId}`, orgId] : null,
    ([url, oid]) => api.get(url, oid as string),
  )

  const [form, setForm] = useState({
    name: "", category: "laptop", status: "active", condition_rating: "good",
    department: "", location: "",
    serial_number: "", model: "", manufacturer: "", cpu: "", ram_gb: "",
    storage_gb: "", os: "", os_version: "",
    purchase_date: "", purchase_price: "", currency: "USD",
    vendor_name: "", po_number: "", invoice_number: "",
    warranty_expiry: "", warranty_type: "manufacturer", warranty_notes: "",
    depreciation_years: "3", notes: "",
  })
  const [tags, setTags]         = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")

  // Populate form when asset loads
  useEffect(() => {
    if (!asset) return
    const sp = asset.specs || {}
    setForm({
      name:               asset.name || "",
      category:           asset.category || "laptop",
      status:             asset.status || "active",
      condition_rating:   asset.condition_rating || "good",
      department:         asset.department || "",
      location:           asset.location || "",
      serial_number:      sp.serial_number || "",
      model:              sp.model || "",
      manufacturer:       sp.manufacturer || "",
      cpu:                sp.cpu || "",
      ram_gb:             sp.ram_gb || "",
      storage_gb:         sp.storage_gb || "",
      os:                 sp.os || "",
      os_version:         sp.os_version || "",
      purchase_date:      asset.purchase_date?.split("T")[0] || "",
      purchase_price:     asset.purchase_price != null ? String(asset.purchase_price) : "",
      currency:           asset.currency || "USD",
      vendor_name:        asset.vendor_name || "",
      po_number:          asset.po_number || "",
      invoice_number:     asset.invoice_number || "",
      warranty_expiry:    asset.warranty_expiry?.split("T")[0] || "",
      warranty_type:      asset.warranty_type || "manufacturer",
      warranty_notes:     asset.warranty_notes || "",
      depreciation_years: String(asset.depreciation_years || 3),
      notes:              asset.notes || "",
    })
    setTags(asset.tags || [])
  }, [asset])

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
      const body: Record<string, unknown> = {
        name:               form.name,
        category:           form.category,
        condition_rating:   form.condition_rating,
        department:         form.department || null,
        location:           form.location || null,
        specs,
        purchase_date:      form.purchase_date || null,
        purchase_price:     form.purchase_price ? parseFloat(form.purchase_price) : null,
        currency:           form.currency,
        vendor_name:        form.vendor_name || null,
        po_number:          form.po_number || null,
        invoice_number:     form.invoice_number || null,
        warranty_expiry:    form.warranty_expiry || null,
        warranty_type:      form.warranty_type,
        warranty_notes:     form.warranty_notes || null,
        depreciation_years: parseInt(form.depreciation_years) || 3,
        notes:              form.notes || null,
        tags,
      }
      await api.put(`/api/assets/${assetId}`, body, orgId)
      router.push(`/assets/${assetId}`)
    } catch (err: any) {
      setError(err?.message || "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/assets/${assetId}`}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Edit Asset</h1>
          <p className="text-xs text-muted-foreground">{asset?.asset_tag} · {asset?.name}</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Identity */}
        <Section title="Identity">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Asset Name *</Label>
              <Input value={form.name} onChange={v => upd("name", v)} placeholder="e.g. MacBook Pro 14 (2023)" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onChange={v => upd("category", v)} options={CATEGORIES} />
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={form.condition_rating} onChange={v => upd("condition_rating", v)} options={CONDITIONS} />
            </div>
            <div>
              <Label>Department</Label>
              <Input value={form.department} onChange={v => upd("department", v)} placeholder="e.g. Engineering" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={v => upd("location", v)} placeholder="e.g. HQ Floor 2" />
            </div>
          </div>
        </Section>

        {/* Hardware Specs */}
        <Section title="Hardware Specs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Serial Number</Label>
              <Input value={form.serial_number} onChange={v => upd("serial_number", v)} placeholder="SN-XXXX" />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={form.model} onChange={v => upd("model", v)} placeholder="MacBook Pro 14" />
            </div>
            <div>
              <Label>Manufacturer</Label>
              <Input value={form.manufacturer} onChange={v => upd("manufacturer", v)} placeholder="Apple" />
            </div>
            <div>
              <Label>CPU</Label>
              <Input value={form.cpu} onChange={v => upd("cpu", v)} placeholder="Apple M3 Pro" />
            </div>
            <div>
              <Label>RAM (GB)</Label>
              <Input value={form.ram_gb} onChange={v => upd("ram_gb", v)} placeholder="16" type="number" />
            </div>
            <div>
              <Label>Storage (GB)</Label>
              <Input value={form.storage_gb} onChange={v => upd("storage_gb", v)} placeholder="512" type="number" />
            </div>
            <div>
              <Label>OS</Label>
              <Input value={form.os} onChange={v => upd("os", v)} placeholder="macOS" />
            </div>
            <div>
              <Label>OS Version</Label>
              <Input value={form.os_version} onChange={v => upd("os_version", v)} placeholder="14.4" />
            </div>
          </div>
        </Section>

        {/* Purchase */}
        <Section title="Purchase Details">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Purchase Date</Label>
              <Input value={form.purchase_date} onChange={v => upd("purchase_date", v)} type="date" />
            </div>
            <div>
              <Label>Purchase Price</Label>
              <div className="flex gap-2">
                <select
                  value={form.currency}
                  onChange={e => upd("currency", e.target.value)}
                  className="h-9 px-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring w-20"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Input value={form.purchase_price} onChange={v => upd("purchase_price", v)} placeholder="0.00" type="number" step="0.01" />
              </div>
            </div>
            <div>
              <Label>Vendor / Supplier</Label>
              <Input value={form.vendor_name} onChange={v => upd("vendor_name", v)} placeholder="Apple Store" />
            </div>
            <div>
              <Label>PO Number</Label>
              <Input value={form.po_number} onChange={v => upd("po_number", v)} placeholder="PO-2024-001" />
            </div>
            <div>
              <Label>Invoice Number</Label>
              <Input value={form.invoice_number} onChange={v => upd("invoice_number", v)} placeholder="INV-2024-001" />
            </div>
            <div>
              <Label>Depreciation (years)</Label>
              <Input value={form.depreciation_years} onChange={v => upd("depreciation_years", v)} type="number" min="1" max="20" />
            </div>
          </div>
        </Section>

        {/* Warranty */}
        <Section title="Warranty">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Warranty Expiry</Label>
              <Input value={form.warranty_expiry} onChange={v => upd("warranty_expiry", v)} type="date" />
            </div>
            <div>
              <Label>Warranty Type</Label>
              <Select value={form.warranty_type} onChange={v => upd("warranty_type", v)} options={WARRANTY_TYPES} />
            </div>
            <div className="col-span-2">
              <Label>Warranty Notes</Label>
              <Input value={form.warranty_notes} onChange={v => upd("warranty_notes", v)} placeholder="e.g. Includes accidental damage cover" />
            </div>
          </div>
        </Section>

        {/* Tags & Notes */}
        <Section title="Tags & Notes">
          <div className="space-y-4">
            <div>
              <Label>Tags</Label>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag() }}}
                  placeholder="Add tag and press Enter"
                  className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button type="button" onClick={addTag}
                  className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors">
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted border border-border text-muted-foreground">
                      {t}
                      <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))}
                        className="hover:text-foreground">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                value={form.notes}
                onChange={e => upd("notes", e.target.value)}
                rows={3}
                placeholder="Any additional notes about this asset..."
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link href={`/assets/${assetId}`}
            className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

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
      {options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, " ")}</option>)}
    </select>
  )
}
