'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ShoppingCart, Plus, CheckCircle2, XCircle, PackageCheck,
  Truck, X, ChevronDown, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import api from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PurchaseRequest {
  id: string
  title: string
  description: string | null
  status: string
  quantity: number
  unit_price: number | null
  total_price: number | null
  department: string | null
  justification: string | null
  vendor_name: string | null
  vendor_id: string | null
  requester_email: string | null
  approver_email: string | null
  po_number: string | null
  ordered_at: string | null
  delivered_at: string | null
  notes: string | null
  created_at: string
}

interface Vendor { id: string; name: string }

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  approved:  { label: 'Approved',  color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  rejected:  { label: 'Rejected',  color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ordered:   { label: 'Ordered',   color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  delivered: { label: 'Delivered', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  cancelled: { label: 'Cancelled', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
}

const fmt = (n: number | null) =>
  n != null ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

// ── New Request Modal ─────────────────────────────────────────────────────────

function NewRequestModal({ orgId, vendors, onClose, onCreated }: {
  orgId: string; vendors: Vendor[]; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({
    title: '', description: '', quantity: '1', unit_price: '',
    vendor_id: '', department: '', justification: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    try {
      await api.post('/api/procurement', {
        title: form.title.trim(),
        description: form.description || null,
        quantity: parseInt(form.quantity) || 1,
        unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
        vendor_id: form.vendor_id || null,
        department: form.department || null,
        justification: form.justification || null,
      }, orgId)
      toast.success('Purchase request submitted')
      onCreated()
    } catch {
      toast.error('Failed to submit request')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', required = false) => (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        aria-label={label}
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
        required={required}
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">New Purchase Request</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {field('Title', 'title', 'text', true)}
          <div className="grid grid-cols-2 gap-3">
            {field('Quantity', 'quantity', 'number')}
            {field('Unit Price ($)', 'unit_price', 'number')}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Vendor</label>
            <select
              aria-label="Vendor"
              value={form.vendor_id}
              onChange={e => setForm(p => ({ ...p, vendor_id: e.target.value }))}
              className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
            >
              <option value="">No vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {field('Department', 'department')}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Justification</label>
            <textarea
              aria-label="Justification"
              value={form.justification}
              onChange={e => setForm(p => ({ ...p, justification: e.target.value }))}
              rows={2}
              className="w-full bg-[rgb(var(--surface2))] border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))] resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Request row ───────────────────────────────────────────────────────────────

function RequestRow({ req, orgId, onRefresh, isAdmin }: {
  req: PurchaseRequest; orgId: string; onRefresh: () => void; isAdmin: boolean
}) {
  const [busy, setBusy] = useState(false)
  const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      await api.post(`/api/procurement/${req.id}/${action}`, extra, orgId)
      onRefresh()
    } catch {
      toast.error(`Action failed`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-5 py-4 border-b border-border last:border-0 flex items-start gap-4 hover:bg-muted/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{req.title}</span>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', cfg.color)}>
            {cfg.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
          <span>Qty: {req.quantity}</span>
          {req.unit_price != null && <span>{fmt(req.unit_price)}/unit</span>}
          {req.vendor_name && <span>{req.vendor_name}</span>}
          {req.department && <span>{req.department}</span>}
          <span>{req.requester_email}</span>
        </div>
        {req.justification && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{req.justification}</p>
        )}
        {req.po_number && (
          <p className="text-xs text-muted-foreground mt-0.5">PO: {req.po_number}</p>
        )}
      </div>
      <div className="text-right shrink-0 space-y-1">
        <p className="text-sm font-semibold">{fmt(req.unit_price ? req.quantity * req.unit_price : null)}</p>
        {/* Action buttons */}
        {!busy && (
          <div className="flex gap-1.5 justify-end">
            {isAdmin && req.status === 'pending' && (
              <>
                <button
                  type="button" title="Approve"
                  onClick={() => act('approve')}
                  className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button
                  type="button" title="Reject"
                  onClick={() => act('reject')}
                  className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </>
            )}
            {req.status === 'approved' && (
              <button
                type="button" title="Mark Ordered"
                onClick={() => act('order', {})}
                className="p-1 rounded hover:bg-blue-500/10 text-blue-400 transition-colors"
              >
                <PackageCheck className="h-4 w-4" />
              </button>
            )}
            {req.status === 'ordered' && (
              <button
                type="button" title="Mark Delivered"
                onClick={() => act('deliver', { create_asset: false })}
                className="p-1 rounded hover:bg-violet-500/10 text-violet-400 transition-colors"
              >
                <Truck className="h-4 w-4" />
              </button>
            )}
            {['pending', 'approved'].includes(req.status) && (
              <button
                type="button" title="Cancel"
                onClick={() => act('cancel')}
                className="p-1 rounded hover:bg-zinc-500/10 text-zinc-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {busy && <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'ordered', label: 'Ordered' },
  { key: 'delivered', label: 'Delivered' },
]

export default function ProcureFlowPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const { can, role } = useEntitlements()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
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
    api.get<{ requests: PurchaseRequest[]; total: number }>(`/api/procurement${qs}`, orgId)
      .then(d => { setRequests(d.requests); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!can('procurement')) { router.replace('/platform'); return }
    if (!orgId) return
    load()
    api.get<{ vendors: Vendor[] }>('/api/contracts/vendors?limit=200', orgId)
      .then(d => setVendors(d.vendors || []))
      .catch(() => {})
  }, [orgId, statusTab])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <ShoppingCart className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ProcureFlow</h1>
            <p className="text-xs text-muted-foreground">Purchase requests & approvals</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Request
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit">
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

      {/* Requests list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/40 animate-pulse border-b border-border last:border-0" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No purchase requests</p>
            <p className="text-sm mt-1">Submit a request to get started.</p>
          </div>
        ) : (
          requests.map(req => (
            <RequestRow
              key={req.id}
              req={req}
              orgId={orgId!}
              onRefresh={load}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>

      {/* Total count */}
      {total > 0 && (
        <p className="text-xs text-muted-foreground text-center">{total} request{total !== 1 ? 's' : ''} total</p>
      )}

      {/* New request modal */}
      <AnimatePresence>
        {showNew && orgId && (
          <NewRequestModal
            orgId={orgId}
            vendors={vendors}
            onClose={() => setShowNew(false)}
            onCreated={() => { setShowNew(false); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
