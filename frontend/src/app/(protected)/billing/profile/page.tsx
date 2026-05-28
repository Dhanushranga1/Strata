"use client";

import { useState, useEffect, useRef } from "react";
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
import { ArrowLeft, Save, Upload, Loader2, CheckCircle2, Image as ImgIcon } from "lucide-react";

interface BillingProfile {
  company_name: string; company_email: string; company_phone: string;
  company_address: string; company_city: string; company_state: string;
  company_zip: string; company_country: string; tax_id: string; tax_label: string;
  currency_default: string; payment_terms_days: number;
  bank_name: string; bank_account: string; bank_routing: string;
  bank_swift: string; bank_iban: string; bank_beneficiary: string;
  footer_text: string; invoice_prefix: string;
  signature_name: string; signature_title: string;
  has_logo: boolean;
}

const CURRENCIES = ["USD","EUR","GBP","INR","AUD","CAD","SGD","JPY","AED","MYR"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

export default function BillingProfilePage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Partial<BillingProfile>>({
    company_country: "US", currency_default: "USD",
    payment_terms_days: 30, invoice_prefix: "INV",
    tax_label: "Tax ID", footer_text: "Thank you for your business.",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const key = orgId ? `/api/billing/profile?_org=${orgId}` : null;
  const { data: profile, mutate } = useSWR<BillingProfile>(key, () =>
    api.get("/api/billing/profile", orgId)
  );

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  function upd(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoUploading(true);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`${API_BASE}/api/billing/profile/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Organization-ID": orgId! },
        body: fd,
      });
      mutate();
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/api/billing/profile", form, orgId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      mutate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <FeatureGate feature="billing" requiredPlan="starter">
      <PageShell>
        <m.div variants={v.fadeUp} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.push("/billing")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> BillingVault
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> :
               saved  ? <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" /> :
                        <Save className="h-4 w-4 mr-2" />}
              {saved ? "Saved" : "Save Profile"}
            </Button>
          </div>

          <h1 className="text-2xl font-bold">Billing Profile</h1>
          <p className="text-sm text-muted-foreground -mt-3">
            Your company details printed on every invoice (letterhead).
          </p>

          {/* Logo */}
          <Section title="Letterhead Logo">
            <div className="flex items-center gap-4">
              <div className="w-24 h-12 rounded border bg-muted flex items-center justify-center overflow-hidden">
                {logoFile ? (
                  <img src={URL.createObjectURL(logoFile)} alt="logo" className="max-h-full max-w-full object-contain" />
                ) : profile?.has_logo ? (
                  <span className="text-xs text-muted-foreground">Logo set</span>
                ) : (
                  <ImgIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={logoUploading}>
                  {logoUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {profile?.has_logo ? "Replace Logo" : "Upload Logo"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG — max 2 MB. Appears top-left of every invoice.</p>
              </div>
            </div>
          </Section>

          {/* Company info */}
          <Section title="Company Information">
            <Field label="Company Name *">
              <Input value={form.company_name ?? ""} onChange={e => upd("company_name", e.target.value)} placeholder="Acme Corp Ltd." />
            </Field>
            <Row>
              <Field label="Email">
                <Input type="email" value={form.company_email ?? ""} onChange={e => upd("company_email", e.target.value)} placeholder="billing@acme.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.company_phone ?? ""} onChange={e => upd("company_phone", e.target.value)} placeholder="+1 555 000 0000" />
              </Field>
            </Row>
            <Field label="Address">
              <Input value={form.company_address ?? ""} onChange={e => upd("company_address", e.target.value)} placeholder="123 Main Street, Suite 400" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City">
                <Input value={form.company_city ?? ""} onChange={e => upd("company_city", e.target.value)} />
              </Field>
              <Field label="State / Region">
                <Input value={form.company_state ?? ""} onChange={e => upd("company_state", e.target.value)} />
              </Field>
              <Field label="ZIP / Postal">
                <Input value={form.company_zip ?? ""} onChange={e => upd("company_zip", e.target.value)} />
              </Field>
            </div>
            <Row>
              <Field label="Country">
                <Input value={form.company_country ?? "US"} onChange={e => upd("company_country", e.target.value)} placeholder="US" />
              </Field>
              <Field label="Tax ID Label">
                <Input value={form.tax_label ?? "Tax ID"} onChange={e => upd("tax_label", e.target.value)} placeholder="GST No / VAT No / EIN" />
              </Field>
            </Row>
            <Field label="Tax ID / VAT / GST Number">
              <Input value={form.tax_id ?? ""} onChange={e => upd("tax_id", e.target.value)} placeholder="GB123456789" />
            </Field>
          </Section>

          {/* Invoice settings */}
          <Section title="Invoice Settings">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Invoice Prefix">
                <Input value={form.invoice_prefix ?? "INV"} onChange={e => upd("invoice_prefix", e.target.value)} placeholder="INV" maxLength={8} />
              </Field>
              <Field label="Default Currency">
                <select
                  value={form.currency_default ?? "USD"}
                  onChange={e => upd("currency_default", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Payment Terms (days)">
                <Input type="number" min={0} max={365} value={form.payment_terms_days ?? 30} onChange={e => upd("payment_terms_days", parseInt(e.target.value) || 30)} />
              </Field>
            </div>
          </Section>

          {/* Bank details */}
          <Section title="Bank / Payment Details (printed on invoice)">
            <Row>
              <Field label="Bank Name">
                <Input value={form.bank_name ?? ""} onChange={e => upd("bank_name", e.target.value)} placeholder="First National Bank" />
              </Field>
              <Field label="Beneficiary Name">
                <Input value={form.bank_beneficiary ?? ""} onChange={e => upd("bank_beneficiary", e.target.value)} placeholder="Acme Corp Ltd." />
              </Field>
            </Row>
            <Row>
              <Field label="Account Number">
                <Input value={form.bank_account ?? ""} onChange={e => upd("bank_account", e.target.value)} />
              </Field>
              <Field label="Routing / Sort Code">
                <Input value={form.bank_routing ?? ""} onChange={e => upd("bank_routing", e.target.value)} />
              </Field>
            </Row>
            <Row>
              <Field label="SWIFT / BIC">
                <Input value={form.bank_swift ?? ""} onChange={e => upd("bank_swift", e.target.value)} placeholder="FNBKUS44XXX" />
              </Field>
              <Field label="IBAN">
                <Input value={form.bank_iban ?? ""} onChange={e => upd("bank_iban", e.target.value)} placeholder="GB29NWBK60161331926819" />
              </Field>
            </Row>
          </Section>

          {/* Signature & footer */}
          <Section title="Signature & Footer">
            <Row>
              <Field label="Signatory Name">
                <Input value={form.signature_name ?? ""} onChange={e => upd("signature_name", e.target.value)} placeholder="Jane Smith" />
              </Field>
              <Field label="Signatory Title">
                <Input value={form.signature_title ?? ""} onChange={e => upd("signature_title", e.target.value)} placeholder="CFO" />
              </Field>
            </Row>
            <Field label="Footer Text (appears at bottom of invoice)">
              <Textarea rows={2} value={form.footer_text ?? ""} onChange={e => upd("footer_text", e.target.value)} placeholder="Thank you for your business." />
            </Field>
          </Section>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> :
             saved  ? <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" /> :
                      <Save className="h-4 w-4 mr-2" />}
            {saved ? "Saved!" : "Save Billing Profile"}
          </Button>
        </m.div>
      </PageShell>
    </FeatureGate>
  );
}
