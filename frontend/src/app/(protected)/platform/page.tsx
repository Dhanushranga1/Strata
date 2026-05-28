"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { Lock, ArrowRight, Layers, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { CommandBar } from "@/components/CommandBar"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useEntitlements } from "@/hooks/useEntitlements"
import api from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  PLATFORM_MODULES,
  PLAN_LABELS,
  PLAN_COLORS,
  type PlatformModule,
  type ModuleStats,
} from "@/lib/platform-modules"
import { FEATURE_MIN_PLAN } from "@/lib/plans"
import type { PlanId } from "@/lib/plans"

// ── Health indicator ──────────────────────────────────────────────────────────

function HealthDot({ health }: { health: ModuleStats["health"] }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full shrink-0",
      health === "healthy"  && "bg-emerald-400",
      health === "warning"  && "bg-amber-400 animate-pulse",
      health === "critical" && "bg-red-500 animate-pulse",
    )} />
  )
}

// ── Stat chips ────────────────────────────────────────────────────────────────

function StatChips({ stats, health }: { stats: string[]; health: ModuleStats["health"] }) {
  const icon =
    health === "critical" ? <AlertCircle className="w-3 h-3 text-red-400 shrink-0" /> :
    health === "warning"  ? <Clock className="w-3 h-3 text-amber-400 shrink-0" /> :
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
  return (
    <div className="flex flex-wrap gap-1.5 mt-auto pt-3">
      {stats.map((s, i) => (
        <span key={i} className={cn(
          "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border",
          i === 0
            ? "bg-muted/60 border-border text-foreground"
            : health === "critical"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
        )}>
          {i > 0 && icon}
          {s}
        </span>
      ))}
    </div>
  )
}

// ── Module card ───────────────────────────────────────────────────────────────

function ModuleCard({
  mod,
  isActive,
  stats,
  statsLoading,
  onUpgrade,
  index,
}: {
  mod: PlatformModule
  isActive: boolean
  stats: ModuleStats | null
  statsLoading: boolean
  onUpgrade: (plan: PlanId) => void
  index: number
}) {
  const { Icon, accent, textAccent, borderAccent } = mod
  const requiredPlan = FEATURE_MIN_PLAN[mod.feature] as PlanId | undefined

  const isComingSoon = mod.comingSoon && !isActive
  const isLocked = !isActive && !mod.comingSoon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        "relative group flex flex-col rounded-xl border bg-card overflow-hidden",
        "transition-all duration-200",
        isActive
          ? `border-border hover:border-${borderAccent.split("-")[1]}-500/40 hover:shadow-lg hover:shadow-black/20`
          : "border-border/50 opacity-75 hover:opacity-90",
      )}
    >
      {/* Colored top bar for active modules */}
      {isActive && (
        <div className={cn("h-0.5 w-full", `bg-gradient-to-r from-transparent via-${textAccent.split("-")[1]}-400/60 to-transparent`)} />
      )}

      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", accent)}>
            <Icon className={cn("w-4.5 h-4.5", textAccent)} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isActive && stats && <HealthDot health={stats.health} />}
            {isComingSoon && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
                Soon
              </span>
            )}
            {isLocked && requiredPlan && (
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5",
                PLAN_COLORS[requiredPlan]
              )}>
                {PLAN_LABELS[requiredPlan]}
              </span>
            )}
          </div>
        </div>

        {/* Name + description */}
        <div>
          <h3 className={cn(
            "font-semibold text-sm leading-snug",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}>
            {mod.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
            {mod.description}
          </p>
        </div>

        {/* Stats / locked message */}
        {isActive ? (
          statsLoading ? (
            <div className="flex gap-1.5 mt-auto pt-3">
              {[60, 44, 36].map(w => (
                <div key={w} className="h-5 rounded-full bg-muted/60 animate-pulse" style={{ width: w }} />
              ))}
            </div>
          ) : stats ? (
            <StatChips stats={stats.stats} health={stats.health} />
          ) : null
        ) : isComingSoon ? (
          <p className="text-[11px] text-muted-foreground/60 mt-auto pt-3 italic">
            Coming in a future update
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-auto pt-3">
            Unlock with <span className="font-semibold text-foreground/80">{requiredPlan && PLAN_LABELS[requiredPlan]}</span> plan
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="px-5 pb-5">
        {isActive ? (
          <Link
            href={mod.href}
            className={cn(
              "flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-colors",
              "bg-primary/10 hover:bg-primary/20 text-primary"
            )}
          >
            Open <ArrowRight className="w-3 h-3" />
          </Link>
        ) : isComingSoon ? (
          <div className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium text-muted-foreground/40 bg-muted/30 cursor-not-allowed select-none">
            Coming Soon
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onUpgrade(requiredPlan ?? "starter")}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-colors bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Lock className="w-3 h-3" /> Upgrade
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Plan badge ────────────────────────────────────────────────────────────────

function PlanBadge({ planId }: { planId: PlanId }) {
  return (
    <span className={cn(
      "text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md",
      PLAN_COLORS[planId]
    )}>
      {planId}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlatformPage() {
  const router = useRouter()
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const { planId, can } = useEntitlements()

  const [statsMap, setStatsMap] = useState<Record<string, ModuleStats>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  const fetchStats = useCallback(async () => {
    const active = PLATFORM_MODULES.filter(m => can(m.feature) && m.statsEndpoint)
    if (!active.length) return

    setLoadingIds(new Set(active.map(m => m.id)))

    await Promise.allSettled(
      active.map(async (mod) => {
        try {
          const data = await api.get<ModuleStats>(mod.statsEndpoint!)
          setStatsMap(prev => ({ ...prev, [mod.id]: data }))
        } finally {
          setLoadingIds(prev => { const n = new Set(prev); n.delete(mod.id); return n })
        }
      })
    )
  }, [can])

  useEffect(() => {
    if (!orgLoading) fetchStats()
  }, [orgLoading, fetchStats])

  const handleUpgrade = (plan: PlanId) => {
    router.push(`/settings?upgrade=${plan}`)
  }

  const activeCount  = PLATFORM_MODULES.filter(m => can(m.feature)).length
  const totalModules = PLATFORM_MODULES.length

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Layers className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">Mission Control</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Every IT operation, one place.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CommandBar />
            <span className="text-xs text-muted-foreground hidden sm:block">
              {currentOrganization?.name}
            </span>
            <PlanBadge planId={planId as PlanId} />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Subtitle row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">{activeCount}</span> of{" "}
              <span className="text-foreground font-semibold">{totalModules}</span> modules active
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={fetchStats}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Refresh stats
          </motion.button>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {PLATFORM_MODULES.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              index={i}
              isActive={can(mod.feature)}
              stats={statsMap[mod.id] ?? null}
              statsLoading={loadingIds.has(mod.id)}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>

        {/* Upgrade prompt for community plan */}
        {planId === "community" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-10 rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold text-sm">Unlock the full Strata platform</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade to Starter to unlock BillingVault, AssetLog, ContractVault, ProcureFlow, ServiceHub, and KnowBase.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleUpgrade("starter")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap shrink-0"
            >
              Upgrade to Starter <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
