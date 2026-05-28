"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save, Loader2, GripVertical } from "lucide-react";

interface Client { id: string; name: string; email: string; currency: string; payment_terms_days: number | null; }
interface BillingProfile { currency_default: string; payment_terms_days: number; }
interface LineItem {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  discount_rate: string;
}

const CURRENCIES = ["USD","EUR","GBP","INR","AUD","CAD","SGD","JPY","AED","MYR"];

function calcAmount(item: LineItem) {
  const qty = parseFloat(item.quantity) || 0;
  const up = parseFloat(item.unit_price) || 0;
  const disc = parseFloat(item.discount_rate) || 0;
  return qty * up * (1 - disc / 100);
}

function fmtMoney(amount: number, currency = "USD") {
  const sym: Record<string,string> = { USD:"$", EUR:"€", GBP:"£", INR:"₹", AUD:"A$", CAD:"C$", SGD:"S$" };
  return `${sym[currency] ?? currency+" "}${Number(amount).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

let _key = 0;
function mkKey() { return `item-${++_key}`; }
function emptyItem(): LineItem {
  return { key: mkKey(), description: "", quantity: "1", unit_price: "", tax_rate: "0", discount_rate: "0" };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: clients } = useSWR<Client[]>(
    orgId ? `/api/billing/clients-list?_org=${orgId}` : null,
    () => api.get("/api/billing/clients?limit=500", orgId)
  );
  const { data: profile } = useSWR<BillingProfile>(
    orgId ? `/api/billing/profile?_org=${orgId}` : null,
    () => api.get("/api/billing/profile", orgId)
  );

  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill currency + due date when client selected
  useEffect(() => {
    if (!clientId || !clients) return;
    const c = clients.find(x => x.id === clientId);
    if (!c) return;
    if (c.currency) setCurrency(c.currency);
    const terms = c.payment_terms_days ?? profile?.payment_terms_days ?? 30;
    const d = new Date(issueDate);
    d.setDate(d.getDate() + terms);
    setDueDate(d.toISOString().split("T")[0]);
  }, [clientId, clients, profile]);

  useEffect(() => {
    if (profile && !currency) setCurrency(profile.currency_default);
  }, [profile]);

  function updItem(key: string, field: keyof LineItem, val: string) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, [field]: val } : it));
  }
  function addItem() { setItems(prev => [...prev, emptyItem()]); }
  function removeItem(key: string) { setItems(prev => prev.filter(it => it.key !== key)); }

  const subtotal = items.reduce((s, it) => s + calcAmount(it), 0);
  const taxTotal  = items.reduce((s, it) => {
    const amt = calcAmount(it);
    return s + amt * (parseFloat(it.tax_rate) || 0) / 100;
  }, 0);
  const total = subtotal + taxTotal;

  async function handleSave() {
    if (!clientId) { setError("Please select a client"); return; }
    const filledItems = items.filter(it => it.description.trim() && it.unit_price);
    if (!filledItems.length) { setError("Add at least one line item"); return; }
    setError(null);
    setSaving(true);
    try {
      const body = {
        client_id: clientId,
        currency,
        issue_date: issueDate,
        due_date: dueDate || undefined,
        payment_terms: paymentTerms || undefined,
        po_number: poNumber || undefined,
        notes: notes || undefined,
        items: filledItems.map((it, i) => ({
          sort_order: i,
          description: it.description.trim(),
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          tax_rate: parseFloat(it.tax_rate) || 0,
          discount_rate: parseFloat(it.discount_rate) || 0,
        })),
      };
      const inv = await api.post("/api/billing/invoices", body, orgId);
      router.push(`/billing/invoices/${inv.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create invoice");
      setSaving(false);
    }
  }

  return (
    <FeatureGate feature="billing" requiredPlan="starter">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.push("/billing/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Invoices
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
          </div>

          <h1 className="text-2xl font-bold">New Invoice</h1>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}

          {/* Client + metadata */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Bill To</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Client *</Label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">— Select client —</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!clients?.length && (
                  <p className="text-xs text-muted-foreground">
                    No clients yet.{" "}
                    <button type="button" className="underline text-primary" onClick={() => router.push("/billing/clients/new")}>Add one →</button>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Invoice Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Issue Date</Label>
                  <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Terms</Label>
                  <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="Net 30" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO / Reference Number</Label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-2025-001 (shown on invoice)" />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">Line Items</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="w-6 px-3 py-2.5" />
                    <th className="text-left px-3 py-2.5 font-medium min-w-[200px]">Description *</th>
                    <th className="text-right px-3 py-2.5 font-medium w-20">Qty</th>
                    <th className="text-right px-3 py-2.5 font-medium w-28">Unit Price *</th>
                    <th className="text-right px-3 py-2.5 font-medium w-20">Disc %</th>
                    <th className="text-right px-3 py-2.5 font-medium w-20">Tax %</th>
                    <th className="text-right px-3 py-2.5 font-medium w-28">Amount</th>
                    <th className="w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => {
                    const amt = calcAmount(item);
                    const taxAmt = amt * (parseFloat(item.tax_rate) || 0) / 100;
                    return (
                      <tr key={item.key} className="group">
                        <td className="px-3 py-2 text-muted-foreground/40">
                          <GripVertical className="h-4 w-4" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            value={item.description}
                            onChange={e => updItem(item.key, "description", e.target.value)}
                            placeholder={`Item ${idx + 1} — e.g. Design Services`}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" min="0" step="any"
                            value={item.quantity}
                            onChange={e => updItem(item.key, "quantity", e.target.value)}
                            className="h-8 text-xs text-right w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" min="0" step="0.01"
                            value={item.unit_price}
                            onChange={e => updItem(item.key, "unit_price", e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs text-right w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" min="0" max="100" step="0.1"
                            value={item.discount_rate}
                            onChange={e => updItem(item.key, "discount_rate", e.target.value)}
                            className="h-8 text-xs text-right w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" min="0" max="100" step="0.1"
                            value={item.tax_rate}
                            onChange={e => updItem(item.key, "tax_rate", e.target.value)}
                            className="h-8 text-xs text-right w-full"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-medium tabular-nums">
                          {fmtMoney(amt, currency)}
                          {parseFloat(item.tax_rate) > 0 && (
                            <div className="text-[10px] text-muted-foreground">+{fmtMoney(taxAmt, currency)} tax</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {items.length > 1 && (
                            <button type="button" onClick={() => removeItem(item.key)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t flex items-center justify-between gap-4">
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Line Item
              </Button>

              <div className="text-sm space-y-1 text-right min-w-[200px]">
                <div className="flex justify-between gap-8 text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-medium">{fmtMoney(subtotal, currency)}</span>
                </div>
                {taxTotal > 0 && (
                  <div className="flex justify-between gap-8 text-muted-foreground">
                    <span>Tax</span>
                    <span className="tabular-nums">{fmtMoney(taxTotal, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-8 font-bold text-base pt-1 border-t">
                  <span>Total</span>
                  <span className="tabular-nums text-primary">{fmtMoney(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-lg border bg-card p-5 space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Notes (shown on invoice)</Label>
            <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Payment instructions, bank details override, special terms…" />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => router.push("/billing/invoices")}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
          </div>
        </m.div>
      </PageShell>
    </FeatureGate>
  );
}
