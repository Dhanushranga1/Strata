"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { FeatureGate } from "@/components/FeatureGate";
import { PageShell } from "@/ui/motion/PageShell";
import { m } from "framer-motion";
import { v } from "@/ui/motion/variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Download, Send, CheckCircle2, XCircle, Trash2,
  Loader2, AlertCircle, Pencil, Plus, DollarSign, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string,string> = {
  draft:"bg-zinc-800 text-zinc-400", sent:"bg-blue-900/60 text-blue-300",
  viewed:"bg-indigo-900/60 text-indigo-300", paid:"bg-emerald-900/60 text-emerald-300",
  partial:"bg-amber-900/60 text-amber-300", overdue:"bg-red-900/60 text-red-300",
  cancelled:"bg-zinc-800 text-zinc-500", void:"bg-zinc-800 text-zinc-500",
};
const METHODS = ["bank_transfer","card","cash","cheque","stripe","crypto","other"];

function fmtMoney(amount: number | string, currency = "USD") {
  const sym: Record<string,string> = { USD:"$", EUR:"€", GBP:"£", INR:"₹", AUD:"A$", CAD:"C$" };
  return `${sym[currency] ?? currency+" "}${Number(amount).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month:"long", day:"numeric", year:"numeric" });
}
function fmtDateSh(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}

interface Invoice {
  id: string; invoice_number: string; status: string; currency: string;
  issue_date: string; due_date: string; payment_terms: string; po_number: string;
  subtotal: number; tax_total: number; discount_amount: number; total: number; amount_paid: number;
  notes: string; sent_at: string; paid_at: string;
  client_name: string; client_email: string; client_address: string;
  client_city: string; client_state: string; client_zip: string; client_country: string;
  client_phone: string; client_tax_id: string; client_tax_label: string; client_contact_person: string;
  items: Item[]; payments: Payment[];
}
interface Item { id: string; description: string; quantity: number; unit_price: number; tax_rate: number; discount_rate: number; amount: number; }
interface Payment { id: string; payment_date: string; amount: number; method: string; reference: string; notes: string; }

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentOrganization, user } = useOrganization();
  const orgId = currentOrganization?.id;
  const isRep = user?.role === "rep" || user?.role === "admin";

  const { data: invoice, isLoading, error, mutate } = useSWR<Invoice>(
    orgId ? `/api/billing/invoices/${id}?_org=${orgId}` : null,
    () => api.get(`/api/billing/invoices/${id}`, orgId)
  );

  const [sending, setSending] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", method: "bank_transfer", reference: "", payment_date: new Date().toISOString().split("T")[0], notes: "" });
  const [paySaving, setPaySaving] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      const res = await fetch(`${API_BASE}/api/billing/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}`, "X-Organization-ID": orgId! },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${invoice?.invoice_number ?? id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  }

  async function handleSend() {
    if (!confirm("Mark as Sent and email the PDF to the client?")) return;
    setSending(true);
    try {
      await api.post(`/api/billing/invoices/${id}/send`, {}, orgId);
      mutate();
    } finally { setSending(false); }
  }

  async function handleVoid() {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    setVoiding(true);
    try {
      await api.post(`/api/billing/invoices/${id}/void`, {}, orgId);
      mutate();
    } finally { setVoiding(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/api/billing/invoices/${id}`, orgId);
      router.push("/billing/invoices");
    } finally { setDeleting(false); }
  }

  async function handleRecordPayment() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return;
    setPaySaving(true);
    try {
      await api.post(`/api/billing/invoices/${id}/payments`, {
        amount: parseFloat(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || undefined,
        payment_date: payForm.payment_date,
        notes: payForm.notes || undefined,
      }, orgId);
      setShowPayModal(false);
      mutate();
    } finally { setPaySaving(false); }
  }

  if (isLoading) return (
    <PageShell><div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div></PageShell>
  );
  if (error || !invoice) return (
    <PageShell><div className="flex items-center justify-center py-24 text-destructive gap-2"><AlertCircle className="h-5 w-5" /> Invoice not found</div></PageShell>
  );

  const amountDue = Math.max(0, invoice.total - (invoice.amount_paid ?? 0));
  const canEdit = invoice.status === "draft";
  const canSend = ["draft","sent"].includes(invoice.status);
  const canVoid = !["void","cancelled","paid"].includes(invoice.status);
  const canDelete = ["draft","void","cancelled"].includes(invoice.status);
  const canPay = !["paid","void","cancelled"].includes(invoice.status);

  return (
    <FeatureGate feature="billing" requiredPlan="starter">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-5">
          {/* Nav */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => router.push("/billing/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Invoices
            </Button>
            {isRep && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                  Download PDF
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => router.push(`/billing/invoices/${id}/edit`)}>
                    <Pencil className="h-4 w-4 mr-1.5" /> Edit
                  </Button>
                )}
                {canPay && (
                  <Button variant="outline" size="sm" onClick={() => setShowPayModal(true)}>
                    <DollarSign className="h-4 w-4 mr-1.5" /> Record Payment
                  </Button>
                )}
                {canSend && (
                  <Button size="sm" onClick={handleSend} disabled={sending}>
                    {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                    Send to Client
                  </Button>
                )}
                {canVoid && (
                  <Button variant="outline" size="sm" className="text-muted-foreground" onClick={handleVoid} disabled={voiding}>
                    {voiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                    Void
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Header */}
          <div className="rounded-lg border bg-card p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold font-mono">{invoice.invoice_number}</h1>
                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold capitalize", STATUS_STYLE[invoice.status] ?? STATUS_STYLE.draft)}>
                    {invoice.status}
                  </span>
                </div>
                {invoice.sent_at && <p className="text-xs text-muted-foreground">Sent {fmtDate(invoice.sent_at)}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold tabular-nums">{fmtMoney(invoice.total, invoice.currency)}</p>
                {amountDue > 0 && invoice.status !== "paid" && (
                  <p className={cn("text-sm font-medium", invoice.status === "overdue" ? "text-red-400" : "text-muted-foreground")}>
                    {fmtMoney(amountDue, invoice.currency)} due{invoice.status === "overdue" ? " — OVERDUE" : ""}
                  </p>
                )}
                {invoice.status === "paid" && (
                  <p className="text-sm text-emerald-400 font-medium flex items-center justify-end gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Paid in full
                  </p>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t pt-4">
              {[
                ["Issue Date", fmtDateSh(invoice.issue_date)],
                ["Due Date", fmtDateSh(invoice.due_date)],
                ["Currency", invoice.currency],
                ["Terms", invoice.payment_terms || "—"],
                invoice.po_number ? ["PO Number", invoice.po_number] : null,
              ].filter((x): x is [string, string] => x !== null).map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* From / To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Bill To</p>
              <p className="font-semibold">{invoice.client_name || "—"}</p>
              {invoice.client_contact_person && <p className="text-sm text-muted-foreground">{invoice.client_contact_person}</p>}
              {invoice.client_email && <p className="text-sm text-muted-foreground">{invoice.client_email}</p>}
              {invoice.client_phone && <p className="text-sm text-muted-foreground">{invoice.client_phone}</p>}
              {invoice.client_address && <p className="text-sm text-muted-foreground mt-1">{invoice.client_address}</p>}
              {(invoice.client_city || invoice.client_country) && (
                <p className="text-sm text-muted-foreground">
                  {[invoice.client_city, invoice.client_state, invoice.client_zip].filter(Boolean).join(", ")}
                  {invoice.client_country ? ` ${invoice.client_country}` : ""}
                </p>
              )}
              {invoice.client_tax_id && (
                <p className="text-xs text-muted-foreground mt-1">{invoice.client_tax_label ?? "Tax ID"}: {invoice.client_tax_id}</p>
              )}
            </div>
            {invoice.notes && (
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">Line Items</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Description</th>
                  <th className="text-right px-4 py-2.5 font-medium w-16">Qty</th>
                  <th className="text-right px-4 py-2.5 font-medium w-24">Unit Price</th>
                  <th className="text-right px-4 py-2.5 font-medium w-16">Disc</th>
                  <th className="text-right px-4 py-2.5 font-medium w-16">Tax</th>
                  <th className="text-right px-4 py-2.5 font-medium w-24">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{+item.quantity}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{fmtMoney(item.unit_price, invoice.currency)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{+item.discount_rate > 0 ? `${+item.discount_rate}%` : "—"}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{+item.tax_rate > 0 ? `${+item.tax_rate}%` : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtMoney(item.amount, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t px-4 py-4 flex justify-end">
              <div className="space-y-1.5 text-sm min-w-[200px]">
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmtMoney(invoice.subtotal, invoice.currency)}</span>
                </div>
                {+invoice.tax_total > 0 && (
                  <div className="flex justify-between gap-8 text-muted-foreground">
                    <span>Tax</span>
                    <span className="tabular-nums">{fmtMoney(invoice.tax_total, invoice.currency)}</span>
                  </div>
                )}
                {+invoice.discount_amount > 0 && (
                  <div className="flex justify-between gap-8 text-red-400">
                    <span>Discount</span>
                    <span className="tabular-nums">−{fmtMoney(invoice.discount_amount, invoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-8 font-bold text-base border-t pt-1.5">
                  <span>Total</span>
                  <span className="tabular-nums">{fmtMoney(invoice.total, invoice.currency)}</span>
                </div>
                {+invoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between gap-8 text-emerald-400">
                      <span>Paid</span>
                      <span className="tabular-nums">−{fmtMoney(invoice.amount_paid, invoice.currency)}</span>
                    </div>
                    <div className="flex justify-between gap-8 font-bold border-t pt-1.5">
                      <span>Balance Due</span>
                      <span className={cn("tabular-nums", invoice.status === "overdue" ? "text-red-400" : "text-primary")}>{fmtMoney(amountDue, invoice.currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payments */}
          {invoice.payments.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h3 className="font-semibold text-sm">Payment History</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium">Method</th>
                    <th className="text-left px-4 py-2.5 font-medium">Reference</th>
                    <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.payments.map(pay => (
                    <tr key={pay.id}>
                      <td className="px-4 py-3">{fmtDateSh(pay.payment_date)}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{pay.method.replace("_"," ")}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{pay.reference || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-400 tabular-nums">{fmtMoney(pay.amount, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </m.div>

        {/* Record Payment Modal */}
        {showPayModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPayModal(false)}>
            <div className="bg-card rounded-xl border p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg">Record Payment</h3>
              <p className="text-sm text-muted-foreground">Balance due: <strong>{fmtMoney(amountDue, invoice.currency)}</strong></p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount *</Label>
                  <Input type="number" min="0.01" step="0.01"
                    value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder={fmtMoney(amountDue, invoice.currency).replace(/[^0-9.]/g, "")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Date</Label>
                  <Input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm capitalize">
                    {METHODS.map(m => <option key={m} value={m}>{m.replace("_"," ")}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reference / Transaction ID</Label>
                  <Input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="TXN-12345" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPayModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleRecordPayment} disabled={paySaving}>
                  {paySaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Record Payment
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </FeatureGate>
  );
}
