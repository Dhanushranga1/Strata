"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useOrganization } from "@/contexts/OrganizationContext"
import api from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  Key, Plus, Search, AlertTriangle, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, Users, Package,
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const LICENSE_TYPES = [
  { value: "", label: "All Types" },
  { value: "subscription", label: "Subscription" },
  { value: "perpetual",    label: "Perpetual" },
  { value: "oem",          label: "OEM" },
  { value: "free",         label: "Free" },
  { value: "trial",        label: "Trial" },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface License {
  id: string
  product_name: string
  vendor: string | null
  version: string | null
  license_type: string
  seat_count: number | null
  seats_used: number
  seat_utilization: number | null
  expiry_date: string | null
  renewal_date: string | null
  auto_renews: boolean
  cost_per_year: number | null
  currency: string
  is_expired: boolean
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: string | null | undefined) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function fmtMoney(amount: number | null | undefined, currency = "USD") {
  if (!amount) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
}

function SeatBar({ used, total }: { used: number; total: number | null }) {
  if (!total) return <span className="text-xs text-muted-foreground">Unlimited</span>
  const pct = Math.min(100, Math.round((used / total) * 100))
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="space-y-1">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden w-24">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{used}/{total} seats</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LicensesPage() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [search, setSearch]           = useState("")
  const [typeFilter, setTypeFilter]   = useState("")
  const [expiringOnly, setExpiring]   = useState(false)
  const [page, setPage]               = useState(1)

  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("limit", "50")
  if (search)       params.set("search", search)
  if (expiringOnly) params.set("expiring_days", "30")

  const { data, isLoading, mutate } = useSWR<{ licenses: License[]; total: number; pages: number }>(
    orgId ? [`/api/assets/licenses?${params}`, orgId] : null,
    ([url, oid]) => api.get(url, oid as string),
  )

  const licenses = (data?.licenses || []).filter(l => !typeFilter || l.license_type === typeFilter)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/assets"
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Software Licenses</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data?.total ?? "—"} license{data?.total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link href="/assets/licenses/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add License
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search product or vendor..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {LICENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button
          onClick={() => { setExpiring(p => !p); setPage(1) }}
          className={cn(
            "h-9 px-3 rounded-lg border text-sm font-medium transition-colors",
            expiringOnly
              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
          Expiring soon
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Loading licenses...
          </div>
        ) : licenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Key className="w-8 h-8 opacity-30" />
            <p className="text-sm">No licenses found</p>
            <Link href="/assets/licenses/new"
              className="text-xs text-primary hover:underline">Add your first license</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Seats</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Cost/yr</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {licenses.map(lic => {
                const daysLeft = lic.expiry_date
                  ? Math.round((new Date(lic.expiry_date).getTime() - Date.now()) / 86_400_000)
                  : null
                const expStatus = lic.is_expired ? "expired"
                  : daysLeft !== null && daysLeft <= 30 ? "critical"
                  : daysLeft !== null && daysLeft <= 90 ? "warning"
                  : "ok"

                return (
                  <tr key={lic.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/assets/licenses/${lic.id}`} className="hover:text-primary transition-colors">
                        <p className="font-medium text-foreground leading-tight">{lic.product_name}</p>
                        {lic.vendor && <p className="text-xs text-muted-foreground mt-0.5">{lic.vendor}{lic.version ? ` v${lic.version}` : ""}</p>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground capitalize">{lic.license_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <SeatBar used={lic.seats_used} total={lic.seat_count} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className={cn(
                        "text-xs",
                        expStatus === "expired"  ? "text-red-400" :
                        expStatus === "critical" ? "text-amber-400" :
                        expStatus === "warning"  ? "text-yellow-400" :
                        "text-muted-foreground",
                      )}>
                        {lic.expiry_date ? (
                          <>
                            {fmt(lic.expiry_date)}
                            {daysLeft !== null && daysLeft <= 90 && (
                              <p>{lic.is_expired ? "Expired" : `${daysLeft}d left`}</p>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">No expiry</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {fmtMoney(lic.cost_per_year, lic.currency)}
                        {lic.auto_renews && <span className="ml-1 text-emerald-400" title="Auto-renews">↻</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {expStatus === "expired" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-400/10 border border-red-400/20 text-red-400">
                          <AlertTriangle className="w-3 h-3" /> Expired
                        </span>
                      ) : expStatus === "critical" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-400/10 border border-amber-400/20 text-amber-400">
                          <Clock className="w-3 h-3" /> Expiring
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(data?.pages ?? 1) > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {data?.pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(data?.pages ?? 1, p + 1))} disabled={page === (data?.pages ?? 1)}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
