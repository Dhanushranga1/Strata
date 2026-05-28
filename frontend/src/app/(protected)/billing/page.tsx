"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { FeatureGate } from "@/components/FeatureGate";
import { PageShell } from "@/ui/motion/PageShell";
import { m } from "framer-motion";
import { v } from "@/ui/motion/variants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Receipt, Plus, AlertTriangle, Clock, CheckCircle2,
  Users, Settings, FileText, ArrowRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardData {
  drafts: number;
  outstanding: number;
  paid_count: number;
  overdue_count: number;
  outstanding_amount: number;
  paid_this_month: number;
  overdue_amount: number;
  recent_invoices: Invoice[];
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  status: string;
  total: number;
  currency: string;
  due_date: string;
  issue_date: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-zinc-800 text-zinc-400",
  sent:      "bg-blue-900/60 text-blue-300",
  viewed:    "bg-indigo-900/60 text-indigo-300",
  paid:      "bg-emerald-900/60 text-emerald-300",
  partial:   "bg-amber-900/60 text-amber-300",
  overdue:   "bg-red-900/60 text-red-300",
  cancelled: "bg-zinc-800 text-zinc-500",
  void:      "bg-zinc-800 text-zinc-500",
};

function fmtMoney(amount: number, currency = "USD") {
  const sym: Record<string,string> = { USD:"$", EUR:"€", GBP:"£", INR:"₹", AUD:"A$", CAD:"C$" };
  return `${sym[currency] ?? currency+" "}${Number(amount).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}

export default function BillingPage() {
  const router = useRouter();
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;

  const key = isReady && orgId ? `/api/billing/dashboard?_org=${orgId}` : null;
  const { data, isLoading } = useSWR<DashboardData>(key, () =>
    api.get("/api/billing/dashboard", orgId)
  );

  return (
    <FeatureGate feature="billing" requiredPlan="starter" description="Create professional invoices, track payments, and manage client billing.">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Receipt className="h-7 w-7 text-emerald-400" />
              <div>
                <h1 className="text-2xl font-bold">BillingVault</h1>
                <p className="text-sm text-muted-foreground">Invoices, clients, payments</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/billing/clients")}>
                <Users className="h-4 w-4 mr-1.5" /> Clients
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push("/billing/profile")}>
                <Settings className="h-4 w-4 mr-1.5" /> Profile
              </Button>
              <Button onClick={() => router.push("/billing/invoices/new")}>
                <Plus className="h-4 w-4 mr-1.5" /> New Invoice
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className={data?.overdue_count ? "border-red-500/30" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={cn("h-4 w-4", data?.overdue_count ? "text-red-400" : "text-muted-foreground")} />
                      <span className="text-xs text-muted-foreground">Overdue</span>
                    </div>
                    <p className={cn("text-xl font-bold", data?.overdue_count ? "text-red-400" : "")}>
                      {fmtMoney(data?.overdue_amount ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{data?.overdue_count ?? 0} invoices</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Outstanding</span>
                    </div>
                    <p className="text-xl font-bold">{fmtMoney(data?.outstanding_amount ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{data?.outstanding ?? 0} invoices</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs text-muted-foreground">Paid this month</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-400">{fmtMoney(data?.paid_this_month ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{data?.paid_count ?? 0} total paid</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Drafts</span>
                    </div>
                    <p className="text-xl font-bold">{data?.drafts ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">unpublished</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent invoices */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-sm">Recent Invoices</h2>
                  <Button variant="ghost" size="sm" onClick={() => router.push("/billing/invoices")}>
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {!data?.recent_invoices?.length ? (
                  <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No invoices yet</p>
                    <p className="text-sm mt-1">Create your first invoice to get started.</p>
                    <Button className="mt-4" onClick={() => router.push("/billing/invoices/new")}>
                      <Plus className="h-4 w-4 mr-2" /> New Invoice
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Invoice</th>
                          <th className="text-left px-4 py-3 font-medium">Client</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-right px-4 py-3 font-medium">Amount</th>
                          <th className="text-right px-4 py-3 font-medium">Due</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.recent_invoices.map((inv) => (
                          <tr
                            key={inv.id}
                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => router.push(`/billing/invoices/${inv.id}`)}
                          >
                            <td className="px-4 py-3 font-mono font-medium text-xs">{inv.invoice_number}</td>
                            <td className="px-4 py-3 text-muted-foreground">{inv.client_name ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLE[inv.status] ?? STATUS_STYLE.draft)}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtMoney(inv.total, inv.currency)}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground text-xs">{fmtDate(inv.due_date)}</td>
                            <td className="px-4 py-3 text-right">
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </m.div>
      </PageShell>
    </FeatureGate>
  );
}
