"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const CURRENCIES = ["USD","EUR","GBP","INR","AUD","CAD","SGD","JPY","AED","MYR"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

export default function NewClientPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [form, setForm] = useState({
    name: "", email: "", phone: "", contact_person: "",
    address: "", city: "", state: "", zip: "", country: "",
    tax_id: "", tax_label: "Tax ID", currency: "USD",
    payment_terms_days: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("Client name is required"); return; }
    setError(null);
    setSaving(true);
    try {
      const body = {
        ...form,
        payment_terms_days: form.payment_terms_days ? parseInt(form.payment_terms_days) : undefined,
      };
      await api.post("/api/billing/clients", body, orgId);
      router.push("/billing/clients");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
      setSaving(false);
    }
  }

  return (
    <FeatureGate feature="billing" requiredPlan="starter">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.push("/billing/clients")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Clients
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Client
            </Button>
          </div>

          <h1 className="text-2xl font-bold">New Client</h1>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}

          <Section title="Contact Details">
            <Field label="Company / Client Name *">
              <Input value={form.name} onChange={e => upd("name", e.target.value)} placeholder="Acme Technologies" />
            </Field>
            <Row>
              <Field label="Contact Person">
                <Input value={form.contact_person} onChange={e => upd("contact_person", e.target.value)} placeholder="John Doe" />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="accounts@acme.com" />
              </Field>
            </Row>
            <Field label="Phone">
              <Input value={form.phone} onChange={e => upd("phone", e.target.value)} placeholder="+1 555 000 0000" />
            </Field>
          </Section>

          <Section title="Billing Address">
            <Field label="Street Address">
              <Input value={form.address} onChange={e => upd("address", e.target.value)} placeholder="456 Oak Avenue" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City"><Input value={form.city} onChange={e => upd("city", e.target.value)} /></Field>
              <Field label="State"><Input value={form.state} onChange={e => upd("state", e.target.value)} /></Field>
              <Field label="ZIP / Postal"><Input value={form.zip} onChange={e => upd("zip", e.target.value)} /></Field>
            </div>
            <Field label="Country">
              <Input value={form.country} onChange={e => upd("country", e.target.value)} placeholder="US" />
            </Field>
          </Section>

          <Section title="Tax & Billing">
            <Row>
              <Field label="Tax ID Label">
                <Input value={form.tax_label} onChange={e => upd("tax_label", e.target.value)} placeholder="GST No / VAT No" />
              </Field>
              <Field label="Tax ID Number">
                <Input value={form.tax_id} onChange={e => upd("tax_id", e.target.value)} placeholder="GB123456789" />
              </Field>
            </Row>
            <Row>
              <Field label="Default Currency">
                <select value={form.currency} onChange={e => upd("currency", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Payment Terms (days, blank = use org default)">
                <Input type="number" min={0} value={form.payment_terms_days} onChange={e => upd("payment_terms_days", e.target.value)} placeholder="30" />
              </Field>
            </Row>
          </Section>

          <Section title="Notes">
            <Field label="Internal Notes">
              <Textarea rows={3} value={form.notes} onChange={e => upd("notes", e.target.value)} placeholder="Any notes about this client (not shown on invoices)" />
            </Field>
          </Section>
        </m.div>
      </PageShell>
    </FeatureGate>
  );
}
