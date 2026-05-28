'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  TrendingDown, AlertCircle, Package, Clock, DollarSign,
  RefreshCw, ChevronRight, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import api from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CostSummary {
  totals: {
    software_spend_annual: number
    contract_value_active: number
    asset_book_value: number
    potential_savings: number
  }
  unused_licenses: {
    id: string; product: string; vendor: string; seat_count: number
    seats_used: number; utilisation: number; wasted_seats: number
    cost_per_year: number; potential_saving: number | null; expiry_date: string | null
  }[]
  idle_assets: {
    id: string; name: string; asset_tag: string; category: string
    purchase_price: number | null; department: string | null; assigned_to: string | null
  }[]
  upcoming_renewals: {
    id: string; title: string; vendor: string | null; end_date: string
    days_until_expiry: number; value: number | null; auto_renews: boolean
    notice_period_days: number
  }[]
  department_spend: { department: string; asset_count: number; total_spend: number }[]
  vendor_spend: { vendor: string; license_count: number; annual_spend: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`

function UtilBar({ pct }: { pct: number }) {
  const color = pct < 40 ? 'bg-red-500' : pct < 70 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-9 text-right shrink-0">{pct}%</span>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-bold tracking-tight', accent)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, count, children }: {
  title: string; icon: React.ElementType; count?: number; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">{title}</h2>
        </div>
        {count != null && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CostLensPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const { can } = useEntitlements()
  const [data, setData] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const orgId = currentOrganization?.id

  useEffect(() => {
    if (!can('cost_lens')) { router.replace('/platform'); return }
    if (!orgId) return
    setLoading(true)
    api.get<CostSummary>('/api/costlens/summary', orgId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId, can, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { totals, unused_licenses, idle_assets, upcoming_renewals, department_spend, vendor_spend } = data

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center">
            <TrendingDown className="w-4.5 h-4.5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">CostLens</h1>
            <p className="text-xs text-muted-foreground">IT spend visibility & savings</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!orgId) return
            setLoading(true)
            api.get<CostSummary>('/api/costlens/summary', orgId)
              .then(setData).catch(() => {}).finally(() => setLoading(false))
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Totals row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          label="Annual SW Spend"
          value={fmt(totals.software_spend_annual)}
          accent="text-foreground"
        />
        <StatCard
          label="Active Contract Value"
          value={fmt(totals.contract_value_active)}
          accent="text-foreground"
        />
        <StatCard
          label="Asset Book Value"
          value={fmt(totals.asset_book_value)}
          accent="text-foreground"
        />
        <StatCard
          label="Potential Savings"
          value={fmt(totals.potential_savings)}
          sub="from unused licenses"
          accent="text-emerald-400"
        />
      </motion.div>

      {/* Unused licenses */}
      {unused_licenses.length > 0 && (
        <Section title="Unused Software Licenses" icon={AlertCircle} count={unused_licenses.length}>
          {unused_licenses.map(lic => (
            <div key={lic.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{lic.product}</span>
                  {lic.vendor && (
                    <span className="text-xs text-muted-foreground shrink-0">{lic.vendor}</span>
                  )}
                </div>
                <div className="mt-1.5">
                  <UtilBar pct={lic.utilisation} />
                </div>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {lic.seats_used}/{lic.seat_count} seats
                </p>
                {lic.cost_per_year > 0 && (
                  <p className="text-xs font-semibold text-emerald-400">
                    Save ~{fmt(lic.potential_saving ?? 0)}/yr
                  </p>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Idle assets */}
      {idle_assets.length > 0 && (
        <Section title="Idle Assets (90+ days no activity)" icon={Package} count={idle_assets.length}>
          {idle_assets.map(a => (
            <div key={a.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.asset_tag} · {a.category}{a.department ? ` · ${a.department}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                {a.purchase_price != null && (
                  <p className="text-xs text-muted-foreground">{fmt(a.purchase_price)}</p>
                )}
                {a.assigned_to && (
                  <p className="text-xs text-muted-foreground truncate max-w-[120px]">{a.assigned_to}</p>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Upcoming renewals */}
      {upcoming_renewals.length > 0 && (
        <Section title="Renewals in Next 90 Days" icon={Clock} count={upcoming_renewals.length}>
          {upcoming_renewals.map(r => (
            <div key={r.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.vendor ?? 'No vendor'} · expires {r.end_date}
                  {r.auto_renews ? ' · auto-renews' : ''}
                </p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  r.days_until_expiry <= 30
                    ? 'bg-red-500/10 text-red-400'
                    : r.days_until_expiry <= 60
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-muted text-muted-foreground',
                )}>
                  {r.days_until_expiry}d
                </span>
                {r.value != null && (
                  <p className="text-xs text-muted-foreground">{fmt(r.value)}</p>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Bottom row: dept spend + vendor spend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {department_spend.length > 0 && (
          <Section title="Asset Spend by Department" icon={BarChart2}>
            {department_spend.slice(0, 6).map(d => (
              <div key={d.department} className="px-5 py-3 flex items-center gap-3">
                <span className="flex-1 text-sm truncate">{d.department}</span>
                <span className="text-xs text-muted-foreground shrink-0">{d.asset_count} assets</span>
                <span className="text-sm font-semibold w-16 text-right shrink-0">{fmt(d.total_spend)}</span>
              </div>
            ))}
          </Section>
        )}
        {vendor_spend.length > 0 && (
          <Section title="Software Spend by Vendor" icon={DollarSign}>
            {vendor_spend.slice(0, 6).map(v => (
              <div key={v.vendor} className="px-5 py-3 flex items-center gap-3">
                <span className="flex-1 text-sm truncate">{v.vendor}</span>
                <span className="text-xs text-muted-foreground shrink-0">{v.license_count} licenses</span>
                <span className="text-sm font-semibold w-16 text-right shrink-0">{fmt(v.annual_spend)}/yr</span>
              </div>
            ))}
          </Section>
        )}
      </div>

      {unused_licenses.length === 0 && idle_assets.length === 0 && upcoming_renewals.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No cost insights yet</p>
          <p className="text-sm mt-1">Add assets, licenses and contracts to start seeing savings opportunities.</p>
        </div>
      )}
    </div>
  )
}
