"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { FeatureGate } from "@/components/FeatureGate";
import { PageShell } from "@/ui/motion/PageShell";
import { m } from "framer-motion";
import { v } from "@/ui/motion/variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Search, Users, Loader2, ArrowRight, AlertCircle } from "lucide-react";

interface Client {
  id: string; name: string; email: string; phone: string;
  city: string; country: string; currency: string; tax_id: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;
  const [search, setSearch] = useState("");

  const key = isReady && orgId ? ["billing-clients", orgId, search] : null;
  const { data: clients, isLoading, error } = useSWR<Client[]>(key, () => {
    const params = new URLSearchParams({ limit: "200" });
    if (search) params.set("q", search);
    return api.get(`/api/billing/clients?${params}`, orgId);
  });

  return (
    <FeatureGate feature="billing" requiredPlan="starter">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push("/billing")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Billing
              </Button>
              <h1 className="text-xl font-bold">Clients</h1>
            </div>
            <Button onClick={() => router.push("/billing/clients/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> New Client
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-destructive gap-2">
              <AlertCircle className="h-5 w-5" /> Failed to load clients
            </div>
          ) : !clients?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-4">
              <Users className="h-12 w-12 opacity-30" />
              <p className="font-medium">No clients yet</p>
              <Button variant="outline" onClick={() => router.push("/billing/clients/new")}>
                <Plus className="h-4 w-4 mr-2" /> Add First Client
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Location</th>
                    <th className="text-left px-4 py-3 font-medium">Currency</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map(client => (
                    <tr key={client.id} className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/billing/clients/${client.id}`)}>
                      <td className="px-4 py-3 font-medium">{client.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{client.email ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {[client.city, client.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{client.currency}</td>
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
