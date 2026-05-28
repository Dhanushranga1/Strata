"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  Key, ChevronLeft, AlertTriangle, CheckCircle2, Clock, Users,
  Monitor, User, ExternalLink, Trash2, Plus, Edit2, Loader2, MoreHorizontal,
  RefreshCw, Calendar, DollarSign,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Assignment {
  id: string
  assigned_at: string
  notes: string | null
  user_email: string | null
  user_name: string | null
  asset_name: string | null
  asset_tag: string | null
}

interface License {
  id: string
  product_name: string
  vendor: string | null
  version: string | null
  license_type: string
  seat_count: number | null
  seats_used: number
  seat_utilization: number | null
  license_key?: string
  purchase_date: string | null
  expiry_date: string | null
  renewal_date: string | null
  auto_renews: boolean
  cost_per_year: number | null
  currency: string
  vendor_contact: string | null
  support_url: string | null
  notes: string | null
  is_expired: boolean
  assignments: Assignment[]
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: string | null | undefined) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function fmtMoney(amount: number | null | undefined, currency = "USD") {
  if (!amount) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={cn("text-sm text-foreground", mono && "font-mono")}>{value || "—"}</p>
    </div>
  )
}

// ── Assign modal ──────────────────────────────────────────────────────────────

function AssignModal({ licenseId, orgId, onDone, onClose }: {
  licenseId: string; orgId: string; onDone: () => void; onClose: () => void
}) {
  const [mode, setMode]       = useState<"user" | "asset">("user")
  const [userId, setUserId]   = useState("")
  const [assetId, setAssetId] = useState("")
  const [email, setEmail]     = useState("")
  const [assetTag, setAssetTag] = useState("")
  const [notes, setNotes]     = useState("")
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState("")

  const lookupUser = async () => {
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

  const lookupAsset = async () => {
    if (!assetTag.trim()) return
    try {
      const res = await api.get<{ assets: Array<{ id: string; asset_tag: string; name: string }> }>(
        `/api/assets?search=${encodeURIComponent(assetTag)}&limit=5`, orgId
      )
      const match = res.assets.find(a => a.asset_tag.toLowerCase() === assetTag.toLowerCase())
      if (match) { setAssetId(match.id); setErr("") }
      else { setErr("Asset tag not found"); setAssetId("") }
    } catch {
      setErr("Failed to look up asset")
    }
  }

  const submit = async () => {
    if (mode === "user" && !userId) { setErr("Look up a user first"); return }
    if (mode === "asset" && !assetId) { setErr("Look up an asset first"); return }
    setSaving(true); setErr("")
    try {
      await api.post(`/api/assets/licenses/${licenseId}/assign`, {
        assigned_to: mode === "user" ? userId : null,
        asset_id:    mode === "asset" ? assetId : null,
        notes:       notes || null,
      }, orgId)
      onDone()
    } catch (e: any) {
      setErr(e?.message || "Failed to assign seat")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <h2 className="text-base font-semibold text-foreground">Assign Seat</h2>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {(["user","asset"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-1.5 rounded-md text-sm font-medium transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted text-muted-foreground"
              )}>
              {m === "user" ? "Assign to User" : "Assign to Asset"}
            </button>
          ))}
        </div>

        {mode === "user" ? (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">User Email</label>
            <div className="flex gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupUser()}
                placeholder="user@company.com"
                className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              <button onClick={lookupUser}
                className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors">
                Lookup
              </button>
            </div>
            {userId && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Found: {email}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Asset Tag</label>
            <div className="flex gap-2">
              <input value={assetTag} onChange={e => setAssetTag(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupAsset()}
                placeholder="ASSET-0001"
                className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono" />
              <button onClick={lookupAsset}
                className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors">
                Lookup
              </button>
            </div>
            {assetId && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Found: {assetTag}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground">Notes (optional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Primary workstation license"
            className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Assign Seat
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm modal ───────────────────────────────────────────────────────

function DeleteModal({ productName, onConfirm, onClose, loading }: {
  productName: string; onConfirm: () => void; onClose: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/15">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Delete License</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This will permanently delete <strong className="text-foreground">{productName}</strong> and
          revoke all active seat assignments. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: licenseId } = use(params)
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [showAssign, setShowAssign]   = useState(false)
  const [showDelete, setShowDelete]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [revoking, setRevoking]       = useState<string | null>(null)

  const { data: lic, isLoading, mutate } = useSWR<License>(
    orgId ? [`/api/assets/licenses/${licenseId}`, orgId] : null,
    ([url, oid]) => api.get(url, oid as string),
  )

  const handleDelete = async () => {
    if (!orgId || !lic) return
    setDeleting(true)
    try {
      await api.delete(`/api/assets/licenses/${licenseId}`, orgId)
      router.push("/assets/licenses")
    } catch {
      setDeleting(false)
    }
  }

  const handleRevoke = async (assignmentId: string) => {
    if (!orgId) return
    setRevoking(assignmentId)
    try {
      await api.delete(`/api/assets/licenses/${licenseId}/assignments/${assignmentId}`, orgId)
      mutate()
    } finally {
      setRevoking(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!lic) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Key className="w-8 h-8 opacity-30" />
        <p>License not found</p>
        <Link href="/assets/licenses" className="text-sm text-primary hover:underline">Back to licenses</Link>
      </div>
    )
  }

  const daysLeft = lic.expiry_date
    ? Math.round((new Date(lic.expiry_date).getTime() - Date.now()) / 86_400_000)
    : null

  const expStatus = lic.is_expired ? "expired"
    : daysLeft !== null && daysLeft <= 30 ? "critical"
    : daysLeft !== null && daysLeft <= 90 ? "warning"
    : "ok"

  const seatPct = lic.seat_count ? Math.min(100, Math.round((lic.seats_used / lic.seat_count) * 100)) : null
  const seatColor = seatPct === null ? "" : seatPct >= 100 ? "bg-red-500" : seatPct >= 80 ? "bg-amber-500" : "bg-emerald-500"

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {showAssign && orgId && (
        <AssignModal
          licenseId={licenseId} orgId={orgId}
          onDone={() => { setShowAssign(false); mutate() }}
          onClose={() => setShowAssign(false)}
        />
      )}
      {showDelete && (
        <DeleteModal
          productName={lic.product_name}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
          loading={deleting}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/assets/licenses"
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground leading-tight">{lic.product_name}</h1>
              <p className="text-sm text-muted-foreground">
                {lic.vendor}{lic.version ? ` · v${lic.version}` : ""} · <span className="capitalize">{lic.license_type}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowAssign(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
            <Plus className="w-3.5 h-3.5" /> Assign Seat
          </button>
          <button onClick={() => setShowDelete(true)}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/30 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expiry alert */}
      {expStatus !== "ok" && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-3 rounded-xl border text-sm",
          expStatus === "expired"  ? "bg-red-400/10 border-red-400/20 text-red-400" :
          expStatus === "critical" ? "bg-amber-400/10 border-amber-400/20 text-amber-400" :
          "bg-yellow-400/10 border-yellow-400/20 text-yellow-400",
        )}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {lic.is_expired
            ? `This license expired on ${fmt(lic.expiry_date)}.`
            : `This license expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} (${fmt(lic.expiry_date)}).`}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Left: details */}
        <div className="col-span-2 space-y-4">

          {/* Seat utilization */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Seat Usage</h2>
              <span className="text-xs text-muted-foreground">
                {lic.seats_used} / {lic.seat_count ?? "∞"} used
              </span>
            </div>
            {lic.seat_count ? (
              <>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                  <div className={cn("h-full rounded-full transition-all", seatColor)}
                    style={{ width: `${seatPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{seatPct}% seats in use</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Unlimited seats · {lic.seats_used} currently assigned</p>
            )}
          </div>

          {/* License details */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">License Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="License Type" value={<span className="capitalize">{lic.license_type}</span>} />
              <Field label="Auto-renews" value={lic.auto_renews ? "Yes" : "No"} />
              <Field label="Purchase Date" value={fmt(lic.purchase_date)} />
              <Field label="Expiry Date" value={
                <span className={cn(
                  expStatus === "expired" ? "text-red-400" :
                  expStatus === "critical" ? "text-amber-400" : undefined
                )}>{fmt(lic.expiry_date)}</span>
              } />
              <Field label="Renewal Date" value={fmt(lic.renewal_date)} />
              <Field label="Annual Cost" value={fmtMoney(lic.cost_per_year, lic.currency)} />
              {lic.vendor_contact && <Field label="Vendor Contact" value={lic.vendor_contact} />}
              {lic.support_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Support URL</p>
                  <a href={lic.support_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {lic.license_key && (
                <div className="col-span-2">
                  <Field label="License Key" value={lic.license_key} mono />
                </div>
              )}
            </div>
            {lic.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{lic.notes}</p>
              </div>
            )}
          </div>

          {/* Assignments */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                Active Assignments
                <span className="ml-2 text-xs font-normal text-muted-foreground">({lic.assignments.length})</span>
              </h2>
              <button onClick={() => setShowAssign(true)}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Plus className="w-3 h-3" /> Assign
              </button>
            </div>

            {lic.assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                <Users className="w-6 h-6 opacity-30" />
                <p className="text-sm">No active assignments</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {lic.assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        a.user_email ? "bg-violet-500/15" : "bg-blue-500/15",
                      )}>
                        {a.user_email
                          ? <User className="w-4 h-4 text-violet-400" />
                          : <Monitor className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div>
                        <p className="text-sm text-foreground leading-tight">
                          {a.user_email || a.asset_name || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.user_name || a.asset_tag || ""}
                          {a.notes && ` · ${a.notes}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        Since {fmt(a.assigned_at)}
                      </span>
                      <button
                        onClick={() => handleRevoke(a.id)}
                        disabled={revoking === a.id}
                        className="p-1.5 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
                        title="Revoke seat"
                      >
                        {revoking === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: sidebar stats */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Info</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Seats used</span>
                <span className="text-xs font-medium text-foreground">{lic.seats_used} / {lic.seat_count ?? "∞"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Utilization</span>
                <span className="text-xs font-medium text-foreground">
                  {seatPct !== null ? `${seatPct}%` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Annual cost</span>
                <span className="text-xs font-medium text-foreground">
                  {fmtMoney(lic.cost_per_year, lic.currency)}
                </span>
              </div>
              {lic.cost_per_year && lic.seat_count && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Cost/seat</span>
                  <span className="text-xs font-medium text-foreground">
                    {fmtMoney(lic.cost_per_year / lic.seat_count, lic.currency)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</h3>
            {expStatus === "expired" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-red-400/10 border border-red-400/20 text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" /> Expired
              </span>
            ) : expStatus === "critical" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-400/10 border border-amber-400/20 text-amber-400">
                <Clock className="w-3.5 h-3.5" /> Expiring soon
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            )}
            <p className="text-xs text-muted-foreground">Added {fmt(lic.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
