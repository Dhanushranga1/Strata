"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  Package, ChevronLeft, Edit2, QrCode, AlertTriangle, CheckCircle2,
  Clock, User, MapPin, Tag, Wrench, Ticket, Download, ExternalLink,
  History, Shield, DollarSign, Calendar, MoreHorizontal, Trash2,
  UserPlus, UserMinus, ArrowRight, FileText, Plus,
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active:     "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  deployed:   "text-blue-400 bg-blue-400/10 border-blue-400/20",
  in_repair:  "text-amber-400 bg-amber-400/10 border-amber-400/20",
  in_storage: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  pending:    "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  lost:       "text-red-400 bg-red-400/10 border-red-400/20",
  retired:    "text-muted-foreground bg-muted/50 border-border",
  disposed:   "text-muted-foreground/50 bg-muted/30 border-border/50",
}

const COND_COLOR: Record<string, string> = {
  excellent: "text-emerald-400",
  good:      "text-blue-400",
  fair:      "text-amber-400",
  poor:      "text-orange-400",
  damaged:   "text-red-400",
}

function fmt(v: string | null | undefined) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function fmtMoney(amount: number | null | undefined, currency = "USD") {
  if (!amount) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  )
}

// ── Assign modal ──────────────────────────────────────────────────────────────

function AssignModal({ assetId, orgId, onDone, onClose }: {
  assetId: string; orgId: string; onDone: () => void; onClose: () => void
}) {
  const [userId, setUserId] = useState("")
  const [email, setEmail]   = useState("")
  const [dept, setDept]     = useState("")
  const [loc, setLoc]       = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState("")

  // Lookup user by email
  const lookup = async () => {
    if (!email.trim()) return
    try {
      const res = await api.get<{ user_id: string; email: string }>(
        `/api/organizations/lookup-user?email=${encodeURIComponent(email)}`, orgId
      )
      setUserId(res.user_id)
      setErr("")
    } catch {
      setErr("User not found in this organisation")
      setUserId("")
    }
  }

  const submit = async () => {
    if (!userId) { setErr("Enter a valid email first"); return }
    setSaving(true)
    try {
      await api.post(`/api/assets/${assetId}/assign`,
        { user_id: userId, department: dept || undefined, location: loc || undefined }, orgId)
      onDone()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold">Assign Asset</h3>
        {err && <p className="text-xs text-red-400 p-2 bg-red-500/10 rounded-lg">{err}</p>}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">User Email</label>
          <div className="flex gap-2">
            <input value={email} onChange={e => setEmail(e.target.value)}
              onBlur={lookup}
              className="flex-1 px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
              placeholder="user@company.com" />
          </div>
          {userId && <p className="text-xs text-emerald-400 mt-1">✓ User found</p>}
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Department</label>
          <input value={dept} onChange={e => setDept(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
            placeholder="e.g. Engineering" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Location</label>
          <input value={loc} onChange={e => setLoc(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
            placeholder="e.g. HQ, Desk 14" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving || !userId}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? "Assigning…" : "Assign"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Repair modal ──────────────────────────────────────────────────────────────

function RepairModal({ assetId, orgId, onDone, onClose }: {
  assetId: string; orgId: string; onDone: () => void; onClose: () => void
}) {
  const [form, setForm] = useState({ sent_date: new Date().toISOString().split("T")[0], vendor_name: "", description: "", repair_cost: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState("")
  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.sent_date) { setErr("Sent date required"); return }
    setSaving(true)
    try {
      await api.post(`/api/assets/${assetId}/repairs`, {
        ...form,
        repair_cost: form.repair_cost ? parseFloat(form.repair_cost) : undefined,
      }, orgId)
      onDone()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold">Log Repair</h3>
        {err && <p className="text-xs text-red-400 p-2 bg-red-500/10 rounded-lg">{err}</p>}
        {[
          { k:"sent_date",    l:"Sent Date",    t:"date",   p:"" },
          { k:"vendor_name",  l:"Repair Vendor",t:"text",   p:"e.g. Dell Service" },
          { k:"description",  l:"Issue / Work", t:"text",   p:"What is being repaired?" },
          { k:"repair_cost",  l:"Estimated Cost",t:"number",p:"0.00" },
          { k:"notes",        l:"Notes",        t:"text",   p:"" },
        ].map(({ k, l, t, p }) => (
          <div key={k}>
            <label className="block text-xs text-muted-foreground mb-1">{l}</label>
            <input type={t} value={(form as any)[k]} onChange={e => upd(k, e.target.value)}
              className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
              placeholder={p} />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? "Logging…" : "Log Repair"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Status change modal ───────────────────────────────────────────────────────

const VALID_NEXT: Record<string, string[]> = {
  pending:    ["active","disposed"],
  active:     ["deployed","in_repair","in_storage","lost","retired","disposed"],
  deployed:   ["active","in_repair","in_storage","lost","retired","disposed"],
  in_repair:  ["active","deployed","disposed"],
  in_storage: ["active","deployed","retired","disposed"],
  lost:       ["active","disposed"],
  retired:    ["disposed"],
  disposed:   [],
}
const DISPOSAL_METHODS = ["resale","donation","recycling","destroyed","returned_vendor"]

function StatusModal({ assetId, orgId, current, onDone, onClose }: {
  assetId: string; orgId: string; current: string; onDone: () => void; onClose: () => void
}) {
  const options = VALID_NEXT[current] || []
  const [status, setStatus]   = useState(options[0] || "")
  const [reason, setReason]   = useState("")
  const [method, setMethod]   = useState("")
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState("")

  const submit = async () => {
    if (!status) return
    setSaving(true)
    try {
      await api.post(`/api/assets/${assetId}/status`, {
        status, reason: reason || undefined,
        disposal_method: method || undefined,
      }, orgId)
      onDone()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  if (!options.length) return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">No valid transitions from <strong>{current}</strong></p>
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">Close</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold">Change Status</h3>
        {err && <p className="text-xs text-red-400 p-2 bg-red-500/10 rounded-lg">{err}</p>}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">New Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground">
            {options.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
          </select>
        </div>
        {status === "disposed" && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Disposal Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground">
              <option value="">Select…</option>
              {DISPOSAL_METHODS.map(m => <option key={m} value={m}>{m.replace("_"," ")}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Reason (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50"
            placeholder="Why is this status changing?" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving || !status}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? "Updating…" : "Update Status"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const { data: asset, mutate, isLoading } = useSWR(
    orgId ? [`/api/assets/${id}`, orgId] : null,
    ([url, oid]) => api.get<any>(url, oid),
  )

  const [showAssign,  setShowAssign]  = useState(false)
  const [showRepair,  setShowRepair]  = useState(false)
  const [showStatus,  setShowStatus]  = useState(false)
  const [unassigning, setUnassigning] = useState(false)

  const handleUnassign = async () => {
    if (!orgId || !confirm("Unassign this asset? It will move to In Storage.")) return
    setUnassigning(true)
    try {
      await api.post(`/api/assets/${id}/unassign`, {}, orgId)
      mutate()
    } finally { setUnassigning(false) }
  }

  const downloadQR = () => {
    if (!orgId) return
    const a = document.createElement("a")
    a.href = `/api/assets/${id}/qr.png`
    a.download = `asset-${asset?.asset_tag || id}.png`
    document.head.appendChild(a); a.click(); document.head.removeChild(a)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!asset) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground text-sm">Asset not found</p>
    </div>
  )

  const dep = asset.depreciation
  const warrantyDays = asset.warranty_expiry
    ? Math.floor((new Date(asset.warranty_expiry).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="min-h-screen bg-background">
      {/* Modals */}
      {showAssign && orgId && (
        <AssignModal assetId={id} orgId={orgId}
          onDone={() => { setShowAssign(false); mutate() }}
          onClose={() => setShowAssign(false)} />
      )}
      {showRepair && orgId && (
        <RepairModal assetId={id} orgId={orgId}
          onDone={() => { setShowRepair(false); mutate() }}
          onClose={() => setShowRepair(false)} />
      )}
      {showStatus && orgId && (
        <StatusModal assetId={id} orgId={orgId} current={asset.status}
          onDone={() => { setShowStatus(false); mutate() }}
          onClose={() => setShowStatus(false)} />
      )}

      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/assets" className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold leading-none">{asset.name}</h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{asset.asset_tag}</p>
            </div>
            <span className={cn(
              "text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize",
              STATUS_COLOR[asset.status] ?? "text-muted-foreground bg-muted/50 border-border"
            )}>
              {asset.status.replace("_"," ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadQR}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/50 text-muted-foreground transition-colors">
              <QrCode className="w-3.5 h-3.5" /> QR Code
            </button>
            <button onClick={() => setShowStatus(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/50 text-muted-foreground transition-colors">
              Change Status
            </button>
            <Link href={`/assets/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: main details */}
          <div className="lg:col-span-2 space-y-5">

            {/* Overview */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Overview</h2>
                {asset.condition_rating && (
                  <span className={cn("text-xs font-medium capitalize", COND_COLOR[asset.condition_rating])}>
                    {asset.condition_rating}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Category" value={<span className="capitalize">{asset.category}</span>} />
                <Field label="Department" value={asset.department} />
                <Field label="Location"   value={asset.location} />
                <Field label="Assigned To" value={asset.assigned_name || asset.assigned_email} />
                <Field label="Created By" value={asset.creator_email} />
                <Field label="Added"      value={fmt(asset.created_at)} />
              </div>
            </div>

            {/* Specs */}
            {asset.specs && Object.keys(asset.specs).length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold mb-4">Hardware Specs</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Object.entries(asset.specs as Record<string, string>)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <Field key={k}
                        label={k.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase())}
                        value={v} />
                    ))}
                </div>
              </div>
            )}

            {/* Purchase & Depreciation */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-4">Purchase & Value</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Purchase Date"  value={fmt(asset.purchase_date)} />
                <Field label="Purchase Price" value={fmtMoney(asset.purchase_price, asset.currency)} />
                <Field label="Vendor"         value={asset.vendor_name} />
                <Field label="PO Number"      value={asset.po_number} />
                <Field label="Invoice"        value={asset.invoice_number} />
                <Field label="Currency"       value={asset.currency} />
              </div>
              {dep && dep.current_value !== null && (
                <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border flex items-center gap-4">
                  <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Current Book Value</p>
                    <p className="text-sm font-semibold">{fmtMoney(dep.current_value, asset.currency)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-muted-foreground">Depreciated</p>
                    <p className={cn("text-sm font-semibold",
                      dep.fully_depreciated ? "text-muted-foreground" : "text-amber-400")}>
                      {dep.depreciation_pct}%
                    </p>
                  </div>
                  {dep.fully_depreciated && (
                    <span className="text-xs px-2 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-400 ml-2">
                      Fully depreciated
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Warranty */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-4">Warranty</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Expiry" value={fmt(asset.warranty_expiry)} />
                <Field label="Type"   value={<span className="capitalize">{asset.warranty_type?.replace("_"," ")}</span>} />
                <Field label="Notes"  value={asset.warranty_notes} />
              </div>
              {warrantyDays !== null && (
                <div className={cn("mt-4 flex items-center gap-2 p-3 rounded-lg border text-sm",
                  warrantyDays < 0  ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  warrantyDays <= 30 ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  warrantyDays <= 90 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                  "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                )}>
                  {warrantyDays < 0
                    ? <><AlertTriangle className="w-4 h-4" /> Warranty expired {Math.abs(warrantyDays)} days ago</>
                    : warrantyDays <= 90
                    ? <><Clock className="w-4 h-4" /> Warranty expires in {warrantyDays} days</>
                    : <><CheckCircle2 className="w-4 h-4" /> Warranty valid</>
                  }
                </div>
              )}
            </div>

            {/* Repairs */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Repairs ({asset.repairs?.length ?? 0})</h2>
                {!["retired","disposed"].includes(asset.status) && (
                  <button onClick={() => setShowRepair(true)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Wrench className="w-3.5 h-3.5" /> Log Repair
                  </button>
                )}
              </div>
              {asset.repairs?.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">No repair records</p>
              ) : (
                <div className="space-y-3">
                  {asset.repairs?.map((r: any) => (
                    <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                      <Wrench className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{r.description || "Repair"}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(r.sent_date)}
                          {r.returned_date && ` → ${fmt(r.returned_date)}`}
                          {r.vendor_name && ` · ${r.vendor_name}`}
                          {r.repair_cost && ` · ${fmtMoney(r.repair_cost)}`}
                        </p>
                      </div>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize",
                        r.status === "returned" ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" :
                        r.status === "sent" ? "text-amber-400 border-amber-400/20 bg-amber-400/10" :
                        "text-muted-foreground border-border bg-muted/50"
                      )}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked tickets */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-4">Linked Tickets ({asset.tickets?.length ?? 0})</h2>
              {asset.tickets?.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">No tickets linked</p>
              ) : (
                <div className="space-y-2">
                  {asset.tickets?.map((t: any) => (
                    <Link key={t.id} href={`/tickets/${t.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors group">
                      <Ticket className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{fmt(t.created_at)}</p>
                      </div>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize",
                        t.status === "resolved" ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" :
                        t.status === "open" ? "text-blue-400 border-blue-400/20 bg-blue-400/10" :
                        "text-muted-foreground border-border bg-muted/50"
                      )}>{t.priority_level || t.status}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Licenses */}
            {asset.licenses?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold mb-4">Software Licenses ({asset.licenses.length})</h2>
                <div className="space-y-2">
                  {asset.licenses.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                      <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">{l.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.license_type}
                          {l.expiry_date && ` · expires ${fmt(l.expiry_date)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: actions + history */}
          <div className="space-y-5">

            {/* Quick actions */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-3">Actions</h2>
              <div className="space-y-2">
                {asset.assigned_to ? (
                  <button onClick={handleUnassign} disabled={unassigning}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <UserMinus className="w-3.5 h-3.5" />
                    {unassigning ? "Unassigning…" : "Unassign (→ Storage)"}
                  </button>
                ) : (
                  <button onClick={() => setShowAssign(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <UserPlus className="w-3.5 h-3.5" /> Assign to User
                  </button>
                )}
                <button onClick={() => setShowRepair(true)}
                  disabled={["retired","disposed"].includes(asset.status)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                  <Wrench className="w-3.5 h-3.5" /> Log Repair
                </button>
                <button onClick={() => setShowStatus(true)}
                  disabled={asset.status === "disposed"}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                  <ArrowRight className="w-3.5 h-3.5" /> Change Status
                </button>
                <button onClick={downloadQR}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <QrCode className="w-3.5 h-3.5" /> Download QR Code
                </button>
              </div>
            </div>

            {/* Tags */}
            {asset.tags?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold mb-3">Tags</h2>
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.map((t: string) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {asset.notes && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold mb-2">Notes</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">{asset.notes}</p>
              </div>
            )}

            {/* Contract coverage */}
            {orgId && <ContractCoverageCard assetId={id} orgId={orgId} />}

            {/* History */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">History</h2>
                <Link href={`/assets/${id}/history`} className="text-xs text-primary hover:underline">
                  See all →
                </Link>
              </div>
              <HistoryFeed assetId={id} orgId={orgId!} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContractCoverageCard({ assetId, orgId }: { assetId: string; orgId: string }) {
  const { data } = useSWR(
    [`/api/contracts?asset_id=${assetId}&limit=10`, orgId],
    ([url, oid]) => api.get<{ contracts: any[]; total: number }>(url, oid),
  )

  const contracts = data?.contracts ?? []

  const CONTRACT_STATUS_COLOR: Record<string, string> = {
    active:     "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    draft:      "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    expired:    "text-red-400 bg-red-400/10 border-red-400/20",
    terminated: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    renewed:    "text-blue-400 bg-blue-400/10 border-blue-400/20",
  }

  if (!data) return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-emerald-400" /> Contracts
      </h2>
      <p className="text-xs text-muted-foreground/60">Loading…</p>
    </div>
  )

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-emerald-400" /> Contracts
          {data.total > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({data.total})</span>
          )}
        </h2>
        <Link href="/contracts" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
          View all →
        </Link>
      </div>
      {contracts.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground/60 mb-2">No contracts linked to this asset</p>
          <Link href="/contracts" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
            <Plus className="w-3 h-3" /> Link a contract
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c: any) => {
            const expiringSoon = c.days_until_expiry != null && c.days_until_expiry <= 30 && c.status === "active"
            return (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {c.title}
                  </p>
                  {c.vendor_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{c.vendor_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {expiringSoon && (
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                  )}
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize",
                    CONTRACT_STATUS_COLOR[c.status] ?? "text-muted-foreground bg-muted/50 border-border"
                  )}>
                    {c.status}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HistoryFeed({ assetId, orgId }: { assetId: string; orgId: string }) {
  const { data } = useSWR(
    [`/api/assets/${assetId}/history?limit=8`, orgId],
    ([url, oid]) => api.get<{ history: any[] }>(url, oid),
  )

  if (!data?.history?.length) return (
    <p className="text-xs text-muted-foreground/60">No history yet</p>
  )

  return (
    <div className="space-y-3">
      {data.history.map((h: any) => (
        <div key={h.id} className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-foreground leading-snug">
              {h.note || `${h.event_type.replace(/_/g," ")}${h.field_changed ? ` — ${h.field_changed}` : ""}`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {h.actor_email || "System"} · {new Date(h.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
