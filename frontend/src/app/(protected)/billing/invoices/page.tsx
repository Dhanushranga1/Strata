"use client";

import { useState } from "react";
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
import { ArrowLeft, Plus, Search, Receipt, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Invoice {
  id: string; invoice_number: string; client_name: string; client_email: string;
  status: string; total: number; amount_paid: number; currency: string;
  issue_date: string; due_date: string;
}

const STATUSES = ["all","draft","sent","viewed","paid","partial","overdue","void","cancelled"];
const STATUS_STYLE: Record<string, string> = {
  draft:"bg-zinc-800 text-zinc-400", sent:"bg-blue-900/60 text-blue-300",
  viewed:"bg-indigo-900/60 text-indigo-300", paid:"bg-emerald-900/60 text-emerald-300",
  partial:"bg-amber-900/60 text-amber-300", overdue:"bg-red-900/60 text-red-300",
  cancelled:"bg-zinc-800 text-zinc-500", void:"bg-zinc-800 text-zinc-500",
};

function fmtMoney(amount: number, currency = "USD") {
  const sym: Record<string,string> = { USD:"$", EUR:"€", GBP:"£", INR:"₹" };
  return `${sym[currency] ?? currency+" "}${Number(amount).toLocaleString("en-US",{minimumFractionDigits:2})}`;
}
function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}

export default function InvoicesPage() {
  const router = useRouter();
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const key = isReady && orgId ? ["billing-invoices", orgId, status, search] : null;
  const { data: invoices, isLoading, error } = useSWR<Invoice[]>(key, () => {
    const params = new URLSearchParams({ limit: "100" });
    if (status !== "all") params.set("status", status);
    if (search) params.set("q", search);
    return api.get(`/api/billing/invoices?${params}`, orgId);
  });

  const amountDue = (inv: Invoice) => Math.max(0, inv.total - (inv.amount_paid ?? 0));

  return (
    <FeatureGate feature="billing" requiredPlan="starter">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push("/billing")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Billing
              </Button>
              <h1 className="text-xl font-bold">Invoices</h1>
            </div>
            <Button onClick={() => router.push("/billing/invoices/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> New Invoice
            </Button>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search invoice #, client…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button type="button" key={s}
                  onClick={() => setStatus(s)}
                  className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors capitalize",
                    status === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  )}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-destructive gap-2">
              <AlertCircle className="h-5 w-5" /> Failed to load invoices
            </div>
          ) : !invoices?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-4">
              <Receipt className="h-12 w-12 opacity-30" />
              <p className="font-medium">No invoices{status !== "all" ? ` with status "${status}"` : ""}</p>
              <Button variant="outline" onClick={() => router.push("/billing/invoices/new")}>
                <Plus className="h-4 w-4 mr-2" /> Create Invoice
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-right px-4 py-3 font-medium">Due</th>
                    <th className="text-right px-4 py-3 font-medium">Due Date</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/billing/invoices/${inv.id}`)}>
                      <td className="px-4 py-3 font-mono font-medium text-xs">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.client_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_STYLE[inv.status] ?? STATUS_STYLE.draft)}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtMoney(inv.total, inv.currency)}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums font-medium", amountDue(inv) > 0 && inv.status === "overdue" ? "text-red-400" : "")}>
                        {fmtMoney(amountDue(inv), inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{fmtDate(inv.due_date)}</td>
                      <td className="px-4 py-3"><ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </m.div>
      </PageShell>
    </FeatureGate>
  );
}
