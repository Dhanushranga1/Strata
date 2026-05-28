"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import {
  Monitor, Plus, Search, Download, Upload,
  AlertTriangle, CheckCircle2, Clock, Package,
  Laptop, Server, Smartphone, Printer, Wifi, HardDrive,
  ChevronLeft, ChevronRight, RefreshCw,
  Brain, Zap, ChevronDown, ChevronUp, X, Eye,
  DollarSign, Wrench, Battery, Shield, Trash2,
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "laptop",     label: "Laptops" },
  { value: "desktop",    label: "Desktops" },
  { value: "server",     label: "Servers" },
  { value: "phone",      label: "Phones" },
  { value: "tablet",     label: "Tablets" },
  { value: "monitor",    label: "Monitors" },
  { value: "network",    label: "Network" },
  { value: "printer",    label: "Printers" },
  { value: "peripheral", label: "Peripherals" },
  { value: "software",   label: "Software" },
  { value: "cloud",      label: "Cloud" },
  { value: "other",      label: "Other" },
]

const STATUSES = [
  { value: "",           label: "All Statuses" },
  { value: "active",     label: "Active",       color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  { value: "deployed",   label: "Deployed",     color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  { value: "in_repair",  label: "In Repair",    color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  { value: "in_storage", label: "In Storage",   color: "text-slate-400 bg-slate-400/10 border-slate-400/20" },
  { value: "lost",       label: "Lost",         color: "text-red-400 bg-red-400/10 border-red-400/20" },
  { value: "retired",    label: "Retired",      color: "text-muted-foreground bg-muted/50 border-border" },
  { value: "disposed",   label: "Disposed",     color: "text-muted-foreground/50 bg-muted/30 border-border/50" },
]

const STATUS_COLOR: Record<string, string> = Object.fromEntries(
  STATUSES.filter(s => s.value).map(s => [s.value, s.color] as [string, string])
)

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  laptop:    <Laptop className="w-4 h-4" />,
  desktop:   <Monitor className="w-4 h-4" />,
  server:    <Server className="w-4 h-4" />,
  phone:     <Smartphone className="w-4 h-4" />,
  tablet:    <Smartphone className="w-4 h-4" />,
  monitor:   <Monitor className="w-4 h-4" />,
  network:   <Wifi className="w-4 h-4" />,
  printer:   <Printer className="w-4 h-4" />,
  peripheral:<HardDrive className="w-4 h-4" />,
  software:  <Package className="w-4 h-4" />,
  cloud:     <Package className="w-4 h-4" />,
  other:     <Package className="w-4 h-4" />,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function warrantyBadge(expiry: string | null) {
  if (!expiry) return null
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
  if (days < 0)  return <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-500/10 border-red-500/20 text-red-400">Warranty expired</span>
  if (days <= 30) return <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-500/10 border-red-500/20 text-red-400">{days}d warranty</span>
  if (days <= 90) return <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/10 border-amber-500/20 text-amber-400">{days}d warranty</span>
  return null
}

// ── Inline Status Dropdown ────────────────────────────────────────────────────

const ACTIONABLE_STATUSES = STATUSES.filter(s => s.value)

function InlineStatusDropdown({
  assetId, currentStatus, orgId, onChanged,
}: {
  assetId: string; currentStatus: string; orgId: string; onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  async function pick(newStatus: string) {
    if (newStatus === currentStatus) { setOpen(false); return }
    setBusy(true)
    try {
      await api.post("/api/assets/bulk", { asset_ids: [assetId], action: "status_change", status: newStatus }, orgId)
      onChanged()
    } finally {
      setBusy(false); setOpen(false)
    }
  }

  const color = STATUS_COLOR[currentStatus] ?? "text-muted-foreground bg-muted/50 border-border"

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        aria-label="Change status"
        className={cn(
          "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize transition-colors hover:opacity-80",
          color, busy && "opacity-50 cursor-wait"
        )}
      >
        {busy ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : currentStatus.replace("_", " ")}
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl min-w-[130px] py-1 overflow-hidden">
          {ACTIONABLE_STATUSES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => pick(s.value)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs capitalize transition-colors",
                s.value === currentStatus
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-zinc-300 hover:bg-zinc-800"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bulk Action Bar ────────────────────────────────────────────────────────────

function BulkBar({
  selected, orgId, onClear, onDone,
}: {
  selected: string[]; orgId: string; onClear: () => void; onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [newStatus, setNewStatus] = useState("")

  async function applyStatus() {
    if (!newStatus || !selected.length) return
    setBusy(true)
    try {
      await api.post("/api/assets/bulk", { asset_ids: selected, action: "status_change", status: newStatus }, orgId)
      onDone()
    } finally {
      setBusy(false); setNewStatus("")
    }
  }

  async function bulkDelete() {
    if (!selected.length) return
    if (!confirm(`Delete ${selected.length} asset${selected.length !== 1 ? "s" : ""}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api.post("/api/assets/bulk", { asset_ids: selected, action: "delete" }, orgId)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/50">
      <span className="text-sm text-white font-medium">
        {selected.length} selected
      </span>
      <div className="w-px h-5 bg-zinc-700" />
      <div className="flex items-center gap-2">
        <select
          value={newStatus}
          onChange={e => setNewStatus(e.target.value)}
          aria-label="Bulk status"
          className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 focus:outline-none focus:border-violet-500/50"
        >
          <option value="">Set status…</option>
          {ACTIONABLE_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyStatus}
          disabled={!newStatus || busy}
          className="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {busy ? "Applying…" : "Apply"}
        </button>
      </div>
      <div className="w-px h-5 bg-zinc-700" />
      <button
        type="button"
        onClick={bulkDelete}
        disabled={busy}
        aria-label="Delete selected assets"
        className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── CASPER Insights Panel ─────────────────────────────────────────────────────

type Insight = {
  id: string
  insight_type: string
  severity: string
  title: string
  body: string
  action_type: string | null
  action_payload: Record<string, unknown>
  ref_type: string | null
  ref_id: string | null
  ref_label: string | null
  refreshed_at: string
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/5 text-red-400",
  warning:  "border-amber-500/30 bg-amber-500/5 text-amber-400",
  notice:   "border-blue-500/30 bg-blue-500/5 text-blue-400",
  info:     "border-muted bg-muted/20 text-muted-foreground",
}

const INSIGHT_ICON: Record<string, React.ReactNode> = {
  warranty_expiry:   <Shield className="w-4 h-4" />,
  license_waste:     <DollarSign className="w-4 h-4" />,
  fully_depreciated: <Battery className="w-4 h-4" />,
  repair_roi:        <Wrench className="w-4 h-4" />,
  idle_asset:        <Clock className="w-4 h-4" />,
  license_expiry:    <AlertTriangle className="w-4 h-4" />,
  contract_renewal:  <RefreshCw className="w-4 h-4" />,
}

function InsightsPanel({ orgId }: { orgId: string }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [acting, setActing]       = useState<string | null>(null)

  const { data, mutate, isLoading } = useSWR(
    [`/api/assets/insights`, orgId],
    ([url, oid]) => api.get<{
      insights: Insight[]
      total: number
      counts: Record<string, number>
      last_run: { last_run_at: string } | null
    }>(url, oid),
    { refreshInterval: 300_000 },   // re-fetch every 5 min
  )

  const insights = data?.insights ?? []
  const counts   = data?.counts ?? {}
  const critical = counts.critical ?? 0
  const warning  = counts.warning ?? 0

  const handleRefresh = async () => {
    await api.post("/api/assets/insights/refresh", {}, orgId)
    setTimeout(() => mutate(), 3000)
  }

  const handleDismiss = async (id: string) => {
    await api.post(`/api/assets/insights/${id}/dismiss`, {}, orgId)
    mutate()
  }

  const handleAct = async (insight: Insight) => {
    setActing(insight.id)
    try {
      const res = await api.post<{ redirect?: string; asset_id?: string; license_id?: string; contract_id?: string }>(
        `/api/assets/insights/${insight.id}/act`, {}, orgId
      )
      mutate()
      if (res.redirect)    router.push(res.redirect)
      else if (res.asset_id)   router.push(`/assets/${res.asset_id}`)
      else if (res.license_id)   router.push(`/assets/licenses/${res.license_id}`)
      else if (res.contract_id)  router.push(`/contracts/${res.contract_id}`)
    } finally {
      setActing(null)
    }
  }

  if (!isLoading && insights.length === 0) return null

  const lastRun = data?.last_run?.last_run_at
    ? new Date(data.last_run.last_run_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      critical > 0 ? "border-red-500/30" : warning > 0 ? "border-amber-500/30" : "border-blue-500/30",
    )}>
      {/* Panel header — collapse toggle and refresh are siblings, never nested */}
      <div className="flex items-center bg-muted/30 hover:bg-muted/50 transition-colors px-4 py-3">
        {/* Left: clickable label area triggers collapse */}
        <div
          className="flex flex-1 items-center gap-2.5 cursor-pointer min-w-0"
          onClick={() => setCollapsed(c => !c)}
        >
          <Brain className={cn(
            "w-4 h-4 shrink-0",
            critical > 0 ? "text-red-400" : warning > 0 ? "text-amber-400" : "text-blue-400",
          )} />
          <span className="text-sm font-semibold text-foreground">CASPER Intelligence</span>
          {critical > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 border border-red-500/25 text-red-400 font-medium">
              {critical} critical
            </span>
          )}
          {warning > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 border border-amber-500/25 text-amber-400 font-medium">
              {warning} warnings
            </span>
          )}
          {isLoading && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        {/* Right: refresh + chevron — siblings of the label div, not children */}
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {lastRun && <span className="text-xs text-muted-foreground hidden sm:block">Last scan {lastRun}</span>}
          <button
            type="button"
            onClick={() => handleRefresh()}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <div className="cursor-pointer" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Insight cards */}
      {!collapsed && (
        <div className="divide-y divide-border/50">
          {insights.slice(0, 8).map(ins => (
            <div key={ins.id} className={cn(
              "flex gap-3 p-4 border-l-2",
              ins.severity === "critical" ? "border-l-red-500 bg-red-500/3" :
              ins.severity === "warning"  ? "border-l-amber-500 bg-amber-500/3" :
              ins.severity === "notice"   ? "border-l-blue-500 bg-blue-500/3" :
              "border-l-muted bg-muted/10",
            )}>
              <div className={cn(
                "mt-0.5 shrink-0",
                ins.severity === "critical" ? "text-red-400" :
                ins.severity === "warning"  ? "text-amber-400" :
                ins.severity === "notice"   ? "text-blue-400" :
                "text-muted-foreground",
              )}>
                {INSIGHT_ICON[ins.insight_type] ?? <Brain className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground leading-snug">{ins.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{ins.body}</p>
                {ins.ref_label && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-md bg-muted/60 border border-border text-muted-foreground">
                    {ins.ref_label}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2 shrink-0">
                {ins.action_type && (
                  <button
                    type="button"
                    onClick={() => handleAct(ins)}
                    disabled={acting === ins.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                      ins.severity === "critical"
                        ? "bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25"
                        : ins.severity === "warning"
                        ? "bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25"
                        : "bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25",
                    )}
                  >
                    {acting === ins.id
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : ins.action_type === "create_ticket"
                      ? <><Zap className="w-3 h-3" /> Create ticket</>
                      : <><Eye className="w-3 h-3" /> View</>
                    }
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDismiss(ins.id)}
                  className="p-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Dismiss insight"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {insights.length > 8 && (
            <div className="px-4 py-2 text-center text-xs text-muted-foreground">
              +{insights.length - 8} more insights — check back after next scan
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [search, setSearch]     = useState("")
  const [category, setCategory] = useState("")
  const [status, setStatus]     = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [page, setPage]         = useState(1)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const params = new URLSearchParams()
  if (search)     params.set("search", search)
  if (category)   params.set("category", category)
  if (status)     params.set("status", status)
  if (assignedTo) params.set("assigned_to", assignedTo)
  params.set("page", String(page))
  params.set("limit", "50")

  const { data, isLoading, mutate } = useSWR(
    orgId ? [`/api/assets?${params}`, orgId] : null,
    ([url, oid]) => api.get<{ assets: any[]; total: number; pages: number }>(url, oid),
  )

  const { data: dashboard } = useSWR(
    orgId ? ["/api/assets/dashboard", orgId] : null,
    ([url, oid]) => api.get<any>(url, oid),
  )

  const handleExport = useCallback(async () => {
    if (!orgId) return
    const res = await fetch("/api/assets/export", {
      headers: { "X-Organization-ID": orgId },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "assets.csv"; a.click()
    URL.revokeObjectURL(url)
  }, [orgId])

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !orgId) return
    setImporting(true)
    try {
      const form = new FormData(); form.append("file", file)
      const res = await fetch("/api/assets/import", {
        method: "POST",
        headers: { "X-Organization-ID": orgId },
        body: form,
      })
      const result = await res.json()
      alert(`Imported ${result.created} assets. ${result.errors?.length ?? 0} errors.`)
      mutate()
    } finally {
      setImporting(false)
      e.target.value = ""
    }
  }, [orgId, mutate])

  const assets = data?.assets ?? []
  const total  = data?.total ?? 0
  const pages  = data?.pages ?? 1

  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = () => setSelected(
    selected.size === assets.length && assets.length > 0
      ? new Set()
      : new Set(assets.map((a: any) => a.id))
  )
  const clearSelected = () => setSelected(new Set())
  const afterBulk = () => { clearSelected(); mutate() }

  const statSummary = dashboard ? [
    { label: "Active",    value: dashboard.by_status?.active ?? 0,     color: "text-emerald-400" },
    { label: "Deployed",  value: dashboard.by_status?.deployed ?? 0,   color: "text-blue-400" },
    { label: "In Repair", value: dashboard.by_status?.in_repair ?? 0,  color: "text-amber-400" },
    { label: "Total",     value: dashboard.totals?.total_assets ?? 0,  color: "text-foreground" },
  ] : []

  return (
    <div className="min-h-screen bg-background">
      {/* Bulk action bar */}
      {selected.size > 0 && orgId && (
        <BulkBar
          selected={Array.from(selected)}
          orgId={orgId}
          onClear={clearSelected}
          onDone={afterBulk}
        />
      )}
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Package className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">AssetLog</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{total} assets tracked</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <label className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border cursor-pointer transition-colors",
              importing ? "opacity-50" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            )}>
              <Upload className="w-3.5 h-3.5" />
              {importing ? "Importing…" : "Import CSV"}
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
            <Link href="/assets/licenses"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
              <Package className="w-3.5 h-3.5" /> Licenses
            </Link>
            <Link href="/assets/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Asset
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Summary stats */}
        {statSummary.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statSummary.map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* CASPER Proactive Intelligence */}
        {orgId && <InsightsPanel orgId={orgId} />}

        {/* Warranty alerts banner */}
        {dashboard?.warranty_alerts?.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400">
              <strong>{dashboard.warranty_alerts.length}</strong> asset{dashboard.warranty_alerts.length > 1 ? "s" : ""} with warranty expiring within 90 days.{" "}
              <button onClick={() => setStatus("")}
                className="underline underline-offset-2">View all</button>
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
              placeholder="Search name, tag, serial…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground"
            value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            className="px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground"
            value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            className="px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none text-foreground"
            value={assignedTo} onChange={e => { setAssignedTo(e.target.value); setPage(1) }}>
            <option value="">All Users</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <button onClick={() => mutate()}
            className="p-2 rounded-lg border border-border hover:bg-muted/50 text-muted-foreground transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading assets…</div>
          ) : assets.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No assets found</p>
              <Link href="/assets/new" className="text-xs text-primary mt-2 inline-block hover:underline">
                Add your first asset →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all assets"
                      checked={assets.length > 0 && selected.size === assets.length}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Asset</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Assigned To</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden xl:table-cell">Warranty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, i) => (
                  <tr key={asset.id}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/20 transition-colors",
                      i === assets.length - 1 && "border-b-0",
                      selected.has(asset.id) && "bg-violet-500/5"
                    )}>
                    <td className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${asset.name}`}
                        checked={selected.has(asset.id)}
                        onChange={() => toggleOne(asset.id)}
                        className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/assets/${asset.id}`} className="group">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {asset.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{asset.asset_tag}</p>
                        {asset.specs?.serial_number && (
                          <p className="text-xs text-muted-foreground/60">SN: {asset.specs.serial_number}</p>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {CATEGORY_ICON[asset.category] ?? <Package className="w-4 h-4" />}
                        <span className="text-xs capitalize">{asset.category}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {orgId ? (
                        <InlineStatusDropdown
                          assetId={asset.id}
                          currentStatus={asset.status}
                          orgId={orgId}
                          onChanged={mutate}
                        />
                      ) : (
                        <span className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize",
                          STATUS_COLOR[asset.status] ?? "text-muted-foreground bg-muted/50 border-border"
                        )}>
                          {asset.status.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {asset.assigned_email ? (
                        <div>
                          <p className="text-xs">{asset.assigned_name || asset.assigned_email}</p>
                          <p className="text-xs text-muted-foreground">{asset.department || ""}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {warrantyBadge(asset.warranty_expiry) ?? (
                        asset.warranty_expiry
                          ? <span className="text-xs text-muted-foreground">
                              {new Date(asset.warranty_expiry).toLocaleDateString()}
                            </span>
                          : <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/assets/${asset.id}`}
                        className="text-xs text-primary hover:underline">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-border hover:bg-muted/50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-1.5 rounded border border-border hover:bg-muted/50 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
