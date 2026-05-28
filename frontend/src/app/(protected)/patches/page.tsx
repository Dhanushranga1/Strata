'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ShieldCheck, Plus, CheckCircle2, Clock, AlertCircle,
  ShieldAlert, X, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import api from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatchRecord {
  id: string
  asset_id: string | null
  asset_name: string | null
  asset_tag: string | null
  patch_name: string
  cve_id: string | null
  patch_severity: string
  status: string
  scheduled_at: string | null
  applied_at: string | null
  notes: string | null
  created_at: string
}

interface Dashboard {
  severity_summary: { severity: string; needed: number; applied: number; total: number; pct_patched: number }[]
  overdue_critical: number
  scheduled_week: number
}

// ── Config ────────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  high:     { label: 'High',     color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  medium:   { label: 'Medium',   color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  low:      { label: 'Low',      color: 'text-zinc-400',   bg: 'bg-zinc-500/10 border-zinc-500/20' },
}

const STATUS_CONFIG: Record<string, string> = {
  needed:          'text-red-400',
  scheduled:       'text-blue-400',
  applied:         'text-emerald-400',
  deferred:        'text-zinc-500',
  not_applicable:  'text-zinc-600',
}

// ── New Patch Modal ───────────────────────────────────────────────────────────

function NewPatchModal({ orgId, onClose, onCreated }: {
  orgId: string; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({
    patch_name: '', cve_id: '', patch_severity: 'medium', asset_id: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.patch_name.trim()) { toast.error('Patch name required'); return }
    setSaving(true)
    try {
      await api.post('/api/patches', {
        patch_name: form.patch_name.trim(),
        cve_id: form.cve_id || null,
        patch_severity: form.patch_severity,
        asset_id: form.asset_id || null,
        notes: form.notes || null,
      }, orgId)
      toast.success('Patch record added')
      onCreated()
    } catch {
      toast.error('Failed to add patch record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Log Patch</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Patch / Update Name *</label>
            <input
              aria-label="Patch name"
              value={form.patch_name}
              onChange={e => setForm(p => ({ ...p, patch_name: e.target.value }))}
              placeholder="e.g. Windows 11 22H2 Security Update"
              className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">CVE ID</label>
              <input
                aria-label="CVE ID"
                value={form.cve_id}
                onChange={e => setForm(p => ({ ...p, cve_id: e.target.value }))}
                placeholder="CVE-2024-1234"
                className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Severity</label>
              <select
                aria-label="Severity"
                value={form.patch_severity}
                onChange={e => setForm(p => ({ ...p, patch_severity: e.target.value }))}
                className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
              >
                {Object.entries(SEV_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Asset ID (optional)</label>
            <input
              aria-label="Asset ID"
              value={form.asset_id}
              onChange={e => setForm(p => ({ ...p, asset_id: e.target.value }))}
              placeholder="Asset UUID"
              className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Add Patch'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Patch row ─────────────────────────────────────────────────────────────────

function PatchRow({ patch, orgId, onRefresh }: { patch: PatchRecord; orgId: string; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false)
  const sev = SEV_CONFIG[patch.patch_severity] || SEV_CONFIG.medium

  async function markApplied() {
    setBusy(true)
    try {
      await api.put(`/api/patches/${patch.id}/status`, { status: 'applied' }, orgId)
      onRefresh()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-5 py-3.5 flex items-start gap-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{patch.patch_name}</span>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', sev.bg, sev.color)}>
            {sev.label}
          </span>
          {patch.cve_id && (
            <span className="text-[10px] font-mono text-muted-foreground">{patch.cve_id}</span>
          )}
        </div>
        {patch.asset_name && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {patch.asset_name} ({patch.asset_tag})
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-xs font-medium capitalize', STATUS_CONFIG[patch.status] || 'text-muted-foreground')}>
          {patch.status.replace('_', ' ')}
        </span>
        {patch.status === 'needed' && !busy && (
          <button
            type="button" title="Mark Applied"
            onClick={markApplied}
            className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        {busy && <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin" />}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PatchWatchPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const { can } = useEntitlements()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [patches, setPatches] = useState<PatchRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sevFilter, setSevFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('needed')
  const [showNew, setShowNew] = useState(false)
  const orgId = currentOrganization?.id

  function load() {
    if (!orgId) return
    setLoading(true)
    const qs = new URLSearchParams()
    if (sevFilter) qs.set('severity', sevFilter)
    if (statusFilter) qs.set('status', statusFilter)
    Promise.all([
      api.get<Dashboard>('/api/patches/dashboard', orgId),
      api.get<{ patches: PatchRecord[]; total: number }>(`/api/patches?${qs}`, orgId),
    ])
      .then(([dash, list]) => {
        setDashboard(dash)
        setPatches(list.patches)
        setTotal(list.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!can('patches')) { router.replace('/platform'); return }
    if (!orgId) return
    load()
  }, [orgId, sevFilter, statusFilter])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">PatchWatch</h1>
            <p className="text-xs text-muted-foreground">Device patch status & tracking</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Log Patch
        </button>
      </div>

      {/* Dashboard summary */}
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {dashboard.severity_summary.map(s => {
            const sev = SEV_CONFIG[s.severity] || SEV_CONFIG.medium
            return (
              <button
                key={s.severity}
                type="button"
                onClick={() => setSevFilter(prev => prev === s.severity ? '' : s.severity)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all hover:shadow-sm',
                  sevFilter === s.severity ? 'border-primary bg-primary/5' : 'border-border bg-card',
                )}
              >
                <p className={cn('text-xs font-semibold mb-1', sev.color)}>{sev.label}</p>
                <p className="text-2xl font-bold leading-none">{s.needed}</p>
                <p className="text-xs text-muted-foreground mt-1">needed</p>
                <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', s.pct_patched > 80 ? 'bg-emerald-400' : s.pct_patched > 40 ? 'bg-amber-400' : 'bg-red-500')}
                    style={{ width: `${s.pct_patched}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.pct_patched}% patched</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Alerts */}
      {dashboard && dashboard.overdue_critical > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">
            {dashboard.overdue_critical} critical patch{dashboard.overdue_critical !== 1 ? 'es' : ''} overdue — immediate action required.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['needed', 'scheduled', 'applied', 'deferred', ''].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              statusFilter === s
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Patch list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-muted/40 animate-pulse border-b border-border last:border-0" />)}
          </div>
        ) : patches.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No patches found</p>
            <p className="text-sm mt-1">Log patch records to track your fleet's security posture.</p>
          </div>
        ) : (
          patches.map(p => (
            <PatchRow key={p.id} patch={p} orgId={orgId!} onRefresh={load} />
          ))
        )}
      </div>

      {total > 0 && (
        <p className="text-xs text-muted-foreground text-center">{total} record{total !== 1 ? 's' : ''}</p>
      )}

      <AnimatePresence>
        {showNew && orgId && (
          <NewPatchModal
            orgId={orgId}
            onClose={() => setShowNew(false)}
            onCreated={() => { setShowNew(false); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
