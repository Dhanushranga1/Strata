-- BillingVault: invoice generation, client management, payment tracking

-- Org billing identity (letterhead, bank details, numbering)
CREATE TABLE IF NOT EXISTS app.billing_profiles (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL UNIQUE REFERENCES app.organizations(id) ON DELETE CASCADE,
  company_name        text        NOT NULL DEFAULT '',
  company_email       text,
  company_phone       text,
  company_address     text,
  company_city        text,
  company_state       text,
  company_zip         text,
  company_country     text        DEFAULT 'US',
  tax_id              text,
  tax_label           text        DEFAULT 'Tax ID',   -- GST No / VAT No / EIN etc.
  logo_base64         text,                           -- base64-encoded PNG/JPG
  logo_content_type   text        DEFAULT 'image/png',
  currency_default    text        DEFAULT 'USD',
  payment_terms_days  int         NOT NULL DEFAULT 30,
  bank_name           text,
  bank_account        text,
  bank_routing        text,
  bank_swift          text,
  bank_iban           text,
  bank_beneficiary    text,
  footer_text         text        DEFAULT 'Thank you for your business.',
  invoice_prefix      text        NOT NULL DEFAULT 'INV',
  next_invoice_num    int         NOT NULL DEFAULT 1,
  signature_name      text,
  signature_title     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Billing clients (who you invoice — separate from platform users)
CREATE TABLE IF NOT EXISTS app.billing_clients (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  email               text,
  phone               text,
  contact_person      text,
  address             text,
  city                text,
  state               text,
  zip                 text,
  country             text,
  tax_id              text,
  tax_label           text        DEFAULT 'Tax ID',
  currency            text        DEFAULT 'USD',
  payment_terms_days  int,                           -- overrides billing profile default
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_clients_org
  ON app.billing_clients(organization_id, created_at DESC);

-- Invoices
CREATE TABLE IF NOT EXISTS app.invoices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  client_id           uuid        REFERENCES app.billing_clients(id) ON DELETE SET NULL,
  invoice_number      text        NOT NULL,
  status              text        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','viewed','paid','partial','overdue','cancelled','void')),
  issue_date          date        NOT NULL DEFAULT CURRENT_DATE,
  due_date            date,
  currency            text        NOT NULL DEFAULT 'USD',
  subtotal            numeric(14,2) NOT NULL DEFAULT 0,
  tax_total           numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount     numeric(14,2) NOT NULL DEFAULT 0,
  total               numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(14,2) NOT NULL DEFAULT 0,
  notes               text,
  internal_notes      text,
  payment_terms       text,
  po_number           text,
  stripe_invoice_id   text,
  stripe_hosted_url   text,
  stripe_invoice_pdf  text,
  sent_at             timestamptz,
  paid_at             timestamptz,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_status
  ON app.invoices(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_client
  ON app.invoices(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON app.invoices(due_date) WHERE status NOT IN ('paid','void','cancelled');

-- Invoice line items
CREATE TABLE IF NOT EXISTS app.invoice_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid        NOT NULL REFERENCES app.invoices(id) ON DELETE CASCADE,
  sort_order      int         NOT NULL DEFAULT 0,
  description     text        NOT NULL,
  quantity        numeric(12,4) NOT NULL DEFAULT 1,
  unit_price      numeric(14,2) NOT NULL,
  tax_rate        numeric(6,3) NOT NULL DEFAULT 0,   -- % e.g. 18.000
  discount_rate   numeric(6,3) NOT NULL DEFAULT 0,   -- % line discount
  amount          numeric(14,2) NOT NULL              -- qty * unit_price * (1-disc/100)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
  ON app.invoice_items(invoice_id, sort_order);

-- Payment records
CREATE TABLE IF NOT EXISTS app.invoice_payments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid        NOT NULL REFERENCES app.invoices(id) ON DELETE CASCADE,
  amount          numeric(14,2) NOT NULL,
  payment_date    date        NOT NULL DEFAULT CURRENT_DATE,
  method          text        NOT NULL DEFAULT 'bank_transfer'
                  CHECK (method IN ('bank_transfer','card','cash','cheque','stripe','crypto','other')),
  reference       text,
  notes           text,
  stripe_charge_id text,
  recorded_by     uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice
  ON app.invoice_payments(invoice_id);

-- Auto-touch updated_at
CREATE OR REPLACE FUNCTION app.touch_billing_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_billing_profiles_updated
  BEFORE UPDATE ON app.billing_profiles
  FOR EACH ROW EXECUTE FUNCTION app.touch_billing_updated();

CREATE TRIGGER trg_billing_clients_updated
  BEFORE UPDATE ON app.billing_clients
  FOR EACH ROW EXECUTE FUNCTION app.touch_billing_updated();

CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON app.invoices
  FOR EACH ROW EXECUTE FUNCTION app.touch_billing_updated();

-- Mark invoices overdue daily (can be run via pg_cron or app scheduler)
CREATE OR REPLACE FUNCTION app.mark_overdue_invoices()
RETURNS void LANGUAGE sql AS $$
  UPDATE app.invoices
  SET status = 'overdue'
  WHERE status IN ('sent','viewed')
    AND due_date < CURRENT_DATE;
$$;
