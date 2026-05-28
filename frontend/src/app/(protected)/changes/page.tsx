'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  GitPullRequest, Plus, CheckCircle2, XCircle, PlayCircle,
  CalendarClock, AlertTriangle, Flag, X, Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import api from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChangeRecord {
  id: string
  title: string
  description: string | null
  risk_level: string
  status: string
  requester_email: string | null
  approver_email: string | null
  scheduled_at: string | null
  completed_at: string | null
  rollback_plan: string | null
  blackout_check: boolean
  notes: string | null
  created_at: string
}

interface Blackout {
  id: string
  name: string
  start_at: string
  end_at: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:       { label: 'Low',       color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  standard:  { label: 'Standard',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  high:      { label: 'High',      color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  emergency: { label: 'Emergency', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
}

const STATUS_STEPS = ['draft','pending_approval','approved','scheduled','in_progress','completed']

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:            { label: 'Draft',            color: 'text-zinc-400' },
  pending_approval: { label: 'Awaiting Approval', color: 'text-amber-400' },
  approved:         { label: 'Approved',          color: 'text-emerald-400' },
  scheduled:        { label: 'Scheduled',         color: 'text-blue-400' },
  in_progress:      { label: 'In Progress',       color: 'text-violet-400' },
  completed:        { label: 'Completed',         color: 'text-emerald-500' },
  failed:           { label: 'Failed',            color: 'text-red-400' },
  cancelled:        { label: 'Cancelled',         color: 'text-zinc-500' },
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// ── New Change Modal ──────────────────────────────────────────────────────────

function NewChangeModal({ orgId, onClose, onCreated }: {
  orgId: string; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({
    title: '', description: '', risk_level: 'standard',
    rollback_plan: '', scheduled_at: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    try {
      await api.post('/api/changes', {
        title: form.title.trim(),
        description: form.description || null,
        risk_level: form.risk_level,
        rollback_plan: form.rollback_plan || null,
        scheduled_at: form.scheduled_at || null,
        notes: form.notes || null,
      }, orgId)
      toast.success('Change request created')
      onCreated()
    } catch {
      toast.error('Failed to create change request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">New Change Request</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Title *</label>
            <input
              aria-label="Title"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Upgrade PostgreSQL to 16.2"
              className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Description</label>
            <textarea
              aria-label="Description"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Risk Level</label>
              <select
                aria-label="Risk level"
                value={form.risk_level}
                onChange={e => setForm(p => ({ ...p, risk_level: e.target.value }))}
                className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
              >
                {Object.entries(RISK_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Scheduled Date</label>
              <input
                type="datetime-local"
                aria-label="Scheduled date"
                value={form.scheduled_at}
                onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Rollback Plan</label>
            <textarea
              aria-label="Rollback plan"
              value={form.rollback_plan}
              onChange={e => setForm(p => ({ ...p, rollback_plan: e.target.value }))}
              rows={2}
              placeholder="How to revert if something goes wrong…"
              className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))] resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Creating…' : 'Create RFC'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Change row ─────────────────────────────────────────────────────────────────

function ChangeRow({ change, orgId, isAdmin, onRefresh }: {
  change: ChangeRecord; orgId: string; isAdmin: boolean; onRefresh: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const risk = RISK_CONFIG[change.risk_level] || RISK_CONFIG.standard
  const status = STATUS_CONFIG[change.status] || STATUS_CONFIG.draft

  async function act(path: string, body: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      await api.post(`/api/changes/${change.id}/${path}`, body, orgId)
      onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      toast.error(msg.includes('blackout') ? 'Blocked: active blackout window' : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-5 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{change.title}</span>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', risk.bg, risk.color)}>
              {risk.label}
            </span>
            {change.blackout_check && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-red-500/10 border-red-500/20 text-red-400 flex items-center gap-1">
                <Ban className="h-2.5 w-2.5" /> Blackout
              </span>
            )}
          </div>
          {change.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{change.description}</p>
          )}
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {change.requester_email && <span>{change.requester_email}</span>}
            {change.scheduled_at && <span>Scheduled: {fmtDate(change.scheduled_at)}</span>}
            {change.completed_at && <span>Completed: {fmtDate(change.completed_at)}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right space-y-1.5">
          <p className={cn('text-xs font-medium', status.color)}>{status.label}</p>
          {!busy && (
            <div className="flex gap-1 justify-end">
              {change.status === 'draft' && (
                <button type="button" title="Submit for approval" onClick={() => act('submit')}
                  className="p-1 rounded hover:bg-amber-500/10 text-amber-400 transition-colors">
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
              {isAdmin && change.status === 'pending_approval' && (
                <>
                  <button type="button" title="Approve" onClick={() => act('approve')}
                    className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Reject" onClick={() => act('reject')}
                    className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {change.status === 'approved' && (
                <button type="button" title="Start" onClick={() => act('start')}
                  className="p-1 rounded hover:bg-violet-500/10 text-violet-400 transition-colors">
                  <PlayCircle className="h-3.5 w-3.5" />
                </button>
              )}
              {change.status === 'in_progress' && (
                <>
                  <button type="button" title="Mark Completed" onClick={() => act('complete', { outcome: 'completed' })}
                    className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Mark Failed" onClick={() => act('complete', { outcome: 'failed' })}
                    className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
          {busy && <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin ml-auto" />}
        </div>
      </div>
    </motion.div>
  )
}

// ── Blackout Banner ────────────────────────────────────────────────────────────

function BlackoutBanner({ blackouts }: { blackouts: Blackout[] }) {
  const active = blackouts.filter(b => {
    const now = Date.now()
    return new Date(b.start_at).getTime() <= now && new Date(b.end_at).getTime() >= now
  })
  if (!active.length) return null
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-500/30 bg-orange-500/5 text-orange-400">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="text-sm font-medium">
        Blackout window active: {active.map(b => b.name).join(', ')} — high-risk changes are blocked.
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

export default function ChangeBoardPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const { can, role } = useEntitlements()
  const [changes, setChanges] = useState<ChangeRecord[]>([])
  const [blackouts, setBlackouts] = useState<Blackout[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('')
  const [showNew, setShowNew] = useState(false)
  const orgId = currentOrganization?.id
  const isAdmin = role === 'admin' || role === 'owner'

  function load() {
    if (!orgId) return
    setLoading(true)
    const qs = statusTab ? `?status=${statusTab}` : ''
    Promise.all([
      api.get<{ changes: ChangeRecord[]; total: number }>(`/api/changes${qs}`, orgId),
      api.get<{ blackouts: Blackout[] }>('/api/changes/blackouts', orgId),
    ])
      .then(([d, b]) => { setChanges(d.changes); setTotal(d.total); setBlackouts(b.blackouts) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!can('change_board')) { router.replace('/platform'); return }
    if (!orgId) return
    load()
  }, [orgId, statusTab])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <GitPullRequest className="w-4.5 h-4.5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ChangeBoard</h1>
            <p className="text-xs text-muted-foreground">RFC workflow & change approvals</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New RFC
        </button>
      </div>

      {/* Blackout banner */}
      <BlackoutBanner blackouts={blackouts} />

      {/* Risk legend */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(RISK_CONFIG).map(([k, v]) => (
          <span key={k} className={cn('text-[10px] font-semibold px-2 py-1 rounded border', v.bg, v.color)}>
            {v.label}
          </span>
        ))}
        <span className="text-[10px] text-muted-foreground self-center ml-1">risk levels</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit flex-wrap">
        {FILTER_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusTab(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              statusTab === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Changes list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/40 animate-pulse border-b border-border last:border-0" />)}
          </div>
        ) : changes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <GitPullRequest className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No change requests</p>
            <p className="text-sm mt-1">Log an RFC to get a change approved before it goes live.</p>
          </div>
        ) : (
          changes.map(c => (
            <ChangeRow key={c.id} change={c} orgId={orgId!} isAdmin={isAdmin} onRefresh={load} />
          ))
        )}
      </div>

      {total > 0 && (
        <p className="text-xs text-muted-foreground text-center">{total} change{total !== 1 ? 's' : ''}</p>
      )}

      <AnimatePresence>
        {showNew && orgId && (
          <NewChangeModal
            orgId={orgId}
            onClose={() => setShowNew(false)}
            onCreated={() => { setShowNew(false); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
