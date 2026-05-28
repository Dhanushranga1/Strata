"""
BillingVault — invoice generation, client management, payment tracking.
"""
import base64
import json
import logging
import os
import threading
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, Query
from fastapi.responses import Response
from pydantic import BaseModel

from .auth import User, get_current_user
from .org_middleware import require_org_context
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .billing_pdf import generate_invoice_pdf

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])

STRIPE_SECRET = os.getenv("STRIPE_SECRET_KEY", "")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "billing@strata.app")


def _require_rep(user: User):
    if user.role not in ("rep", "admin"):
        raise HTTPException(403, "Rep/Admin access required")


# ── Pydantic models ────────────────────────────────────────────────────────────

class BillingProfileIn(BaseModel):
    company_name: str = ""
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None
    company_city: Optional[str] = None
    company_state: Optional[str] = None
    company_zip: Optional[str] = None
    company_country: str = "US"
    tax_id: Optional[str] = None
    tax_label: str = "Tax ID"
    currency_default: str = "USD"
    payment_terms_days: int = 30
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_routing: Optional[str] = None
    bank_swift: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_beneficiary: Optional[str] = None
    footer_text: Optional[str] = "Thank you for your business."
    invoice_prefix: str = "INV"
    signature_name: Optional[str] = None
    signature_title: Optional[str] = None


class ClientIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    tax_id: Optional[str] = None
    tax_label: str = "Tax ID"
    currency: str = "USD"
    payment_terms_days: Optional[int] = None
    notes: Optional[str] = None


class InvoiceItemIn(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    tax_rate: float = 0.0
    discount_rate: float = 0.0
    sort_order: int = 0


class InvoiceIn(BaseModel):
    client_id: str
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    currency: str = "USD"
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    payment_terms: Optional[str] = None
    po_number: Optional[str] = None
    items: List[InvoiceItemIn] = []


class PaymentIn(BaseModel):
    amount: float
    payment_date: Optional[str] = None
    method: str = "bank_transfer"
    reference: Optional[str] = None
    notes: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _row_dict(row) -> dict:
    """Convert a psycopg3 Row to a plain dict, serializing dates/datetimes."""
    if row is None:
        return {}
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, (date, datetime)):
            d[k] = v.isoformat()
    return d


def _calc_item_amount(quantity: float, unit_price: float, discount_rate: float) -> float:
    return round(quantity * unit_price * (1.0 - discount_rate / 100.0), 2)


def _calc_totals(items: list) -> tuple[float, float, float]:
    """Returns (subtotal, tax_total, total)."""
    subtotal = sum(i["amount"] for i in items)
    tax_total = sum(
        round(i["amount"] * float(i.get("tax_rate", 0)) / 100.0, 2)
        for i in items
    )
    return round(subtotal, 2), round(tax_total, 2), round(subtotal + tax_total, 2)


def _get_or_create_profile(cur, org_id: str) -> dict:
    cur.execute(
        "SELECT * FROM app.billing_profiles WHERE organization_id = %s", (org_id,)
    )
    row = cur.fetchone()
    if not row:
        cur.execute(
            "INSERT INTO app.billing_profiles (organization_id) VALUES (%s) RETURNING *",
            (org_id,),
        )
        row = cur.fetchone()
    return _row_dict(row)


def _next_invoice_number(cur, org_id: str) -> str:
    cur.execute(
        "UPDATE app.billing_profiles SET next_invoice_num = next_invoice_num + 1 "
        "WHERE organization_id = %s "
        "RETURNING invoice_prefix, next_invoice_num - 1 AS num",
        (org_id,),
    )
    row = cur.fetchone()
    if not row:
        return "INV-001"
    prefix = row["invoice_prefix"] or "INV"
    num = row["num"]
    today = date.today()
    return f"{prefix}-{today.year}-{num:04d}"


# ── Billing profile ────────────────────────────────────────────────────────────

@router.get("/profile")
def get_profile(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        profile = _get_or_create_profile(cur, org_id)
        conn.commit()
    # Don't leak full logo in list — just a boolean flag
    profile["has_logo"] = bool(profile.pop("logo_base64", None))
    return profile


@router.put("/profile")
def update_profile(
    body: BillingProfileIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        _get_or_create_profile(cur, org_id)  # ensure exists
        cur.execute(
            """
            UPDATE app.billing_profiles SET
              company_name       = %s, company_email   = %s, company_phone   = %s,
              company_address    = %s, company_city    = %s, company_state   = %s,
              company_zip        = %s, company_country = %s, tax_id          = %s,
              tax_label          = %s, currency_default= %s, payment_terms_days= %s,
              bank_name          = %s, bank_account    = %s, bank_routing    = %s,
              bank_swift         = %s, bank_iban       = %s, bank_beneficiary= %s,
              footer_text        = %s, invoice_prefix  = %s,
              signature_name     = %s, signature_title = %s
            WHERE organization_id = %s
            RETURNING *
            """,
            (
                body.company_name, body.company_email, body.company_phone,
                body.company_address, body.company_city, body.company_state,
                body.company_zip, body.company_country, body.tax_id,
                body.tax_label, body.currency_default, body.payment_terms_days,
                body.bank_name, body.bank_account, body.bank_routing,
                body.bank_swift, body.bank_iban, body.bank_beneficiary,
                body.footer_text, body.invoice_prefix,
                body.signature_name, body.signature_title,
                org_id,
            ),
        )
        row = _row_dict(cur.fetchone())
        conn.commit()
    row["has_logo"] = bool(row.pop("logo_base64", None))
    return row


@router.post("/profile/logo", status_code=204)
async def upload_logo(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    raw = await file.read()
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(400, "Logo must be under 2 MB")
    b64 = base64.b64encode(raw).decode()
    with get_db_connection() as conn:
        cur = conn.cursor()
        _get_or_create_profile(cur, org_id)
        cur.execute(
            "UPDATE app.billing_profiles SET logo_base64 = %s, logo_content_type = %s "
            "WHERE organization_id = %s",
            (b64, file.content_type, org_id),
        )
        conn.commit()


# ── Clients ────────────────────────────────────────────────────────────────────

@router.get("/clients")
def list_clients(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    org_id = require_org_context(request)
    conditions = ["organization_id = %s"]
    params: list = [org_id]
    if q:
        conditions.append("(name ILIKE %s OR email ILIKE %s)")
        params += [f"%{q}%", f"%{q}%"]
    where = " AND ".join(conditions)
    params += [limit, offset]
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT * FROM app.billing_clients WHERE {where} ORDER BY name LIMIT %s OFFSET %s",
            params,
        )
        rows = [_row_dict(r) for r in cur.fetchall()]
    return rows


@router.post("/clients", status_code=201)
def create_client(
    body: ClientIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO app.billing_clients
              (organization_id, name, email, phone, contact_person, address, city,
               state, zip, country, tax_id, tax_label, currency, payment_terms_days, notes)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """,
            (org_id, body.name, body.email, body.phone, body.contact_person,
             body.address, body.city, body.state, body.zip, body.country,
             body.tax_id, body.tax_label, body.currency, body.payment_terms_days, body.notes),
        )
        row = _row_dict(cur.fetchone())
        conn.commit()
    return row


@router.get("/clients/{client_id}")
def get_client(
    client_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM app.billing_clients WHERE id = %s::uuid AND organization_id = %s",
            (client_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Client not found")
    return _row_dict(row)


@router.put("/clients/{client_id}")
def update_client(
    client_id: str,
    body: ClientIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE app.billing_clients SET
              name=%s, email=%s, phone=%s, contact_person=%s, address=%s, city=%s,
              state=%s, zip=%s, country=%s, tax_id=%s, tax_label=%s, currency=%s,
              payment_terms_days=%s, notes=%s
            WHERE id=%s::uuid AND organization_id=%s RETURNING *
            """,
            (body.name, body.email, body.phone, body.contact_person, body.address,
             body.city, body.state, body.zip, body.country, body.tax_id, body.tax_label,
             body.currency, body.payment_terms_days, body.notes, client_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Client not found")
        conn.commit()
    return _row_dict(row)


@router.delete("/clients/{client_id}", status_code=204)
def delete_client(
    client_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM app.billing_clients WHERE id=%s::uuid AND organization_id=%s RETURNING id",
            (client_id, org_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Client not found")
        conn.commit()


# ── Invoices ───────────────────────────────────────────────────────────────────

@router.get("/invoices")
def list_invoices(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
    status: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    org_id = require_org_context(request)
    conditions = ["i.organization_id = %s"]
    params: list = [org_id]
    if status:
        conditions.append("i.status = %s")
        params.append(status)
    if client_id:
        conditions.append("i.client_id = %s::uuid")
        params.append(client_id)
    if q:
        conditions.append("(i.invoice_number ILIKE %s OR c.name ILIKE %s)")
        params += [f"%{q}%", f"%{q}%"]
    where = " AND ".join(conditions)
    params += [limit, offset]
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT i.*, c.name AS client_name, c.email AS client_email
            FROM app.invoices i
            LEFT JOIN app.billing_clients c ON c.id = i.client_id
            WHERE {where}
            ORDER BY i.created_at DESC
            LIMIT %s OFFSET %s
            """,
            params,
        )
        rows = [_row_dict(r) for r in cur.fetchall()]
    return rows


@router.post("/invoices", status_code=201)
def create_invoice(
    body: InvoiceIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    if not body.items:
        raise HTTPException(400, "At least one line item is required")

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Verify client belongs to org
        cur.execute(
            "SELECT id, payment_terms_days, currency FROM app.billing_clients "
            "WHERE id = %s::uuid AND organization_id = %s",
            (body.client_id, org_id),
        )
        client = cur.fetchone()
        if not client:
            raise HTTPException(404, "Client not found")

        # Compute due date
        profile = _get_or_create_profile(cur, org_id)
        terms_days = client["payment_terms_days"] or profile.get("payment_terms_days") or 30
        issue_date = date.fromisoformat(body.issue_date) if body.issue_date else date.today()
        due_date = date.fromisoformat(body.due_date) if body.due_date else issue_date + timedelta(days=terms_days)
        currency = body.currency or client["currency"] or profile.get("currency_default", "USD")

        # Auto-generate invoice number
        inv_num = _next_invoice_number(cur, org_id)

        # Build line items
        items = []
        for item in body.items:
            amt = _calc_item_amount(item.quantity, item.unit_price, item.discount_rate)
            items.append({
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_rate": item.tax_rate,
                "discount_rate": item.discount_rate,
                "sort_order": item.sort_order,
                "amount": amt,
            })

        subtotal, tax_total, total = _calc_totals(items)

        # Insert invoice
        cur.execute(
            """
            INSERT INTO app.invoices
              (organization_id, client_id, invoice_number, issue_date, due_date, currency,
               subtotal, tax_total, total, notes, internal_notes, payment_terms,
               po_number, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """,
            (org_id, body.client_id, inv_num, issue_date, due_date, currency,
             subtotal, tax_total, total, body.notes, body.internal_notes,
             body.payment_terms, body.po_number, user.id),
        )
        invoice = _row_dict(cur.fetchone())
        inv_id = invoice["id"]

        # Insert line items
        for item in items:
            cur.execute(
                """
                INSERT INTO app.invoice_items
                  (invoice_id, sort_order, description, quantity, unit_price,
                   tax_rate, discount_rate, amount)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (inv_id, item["sort_order"], item["description"], item["quantity"],
                 item["unit_price"], item["tax_rate"], item["discount_rate"], item["amount"]),
            )
        conn.commit()

    invoice["items"] = items
    invoice["payments"] = []
    return invoice


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT i.*, c.name AS client_name, c.email AS client_email,
                   c.address AS client_address, c.city AS client_city,
                   c.state AS client_state, c.zip AS client_zip,
                   c.country AS client_country, c.phone AS client_phone,
                   c.tax_id AS client_tax_id, c.tax_label AS client_tax_label,
                   c.contact_person AS client_contact_person
            FROM app.invoices i
            LEFT JOIN app.billing_clients c ON c.id = i.client_id
            WHERE i.id = %s::uuid AND i.organization_id = %s
            """,
            (invoice_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Invoice not found")
        invoice = _row_dict(row)

        cur.execute(
            "SELECT * FROM app.invoice_items WHERE invoice_id = %s::uuid ORDER BY sort_order, id",
            (invoice_id,),
        )
        items = [_row_dict(r) for r in cur.fetchall()]

        cur.execute(
            "SELECT * FROM app.invoice_payments WHERE invoice_id = %s::uuid ORDER BY payment_date, created_at",
            (invoice_id,),
        )
        payments = [_row_dict(r) for r in cur.fetchall()]

    invoice["items"] = items
    invoice["payments"] = payments
    return invoice


@router.put("/invoices/{invoice_id}")
def update_invoice(
    invoice_id: str,
    body: InvoiceIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, status FROM app.invoices WHERE id=%s::uuid AND organization_id=%s",
            (invoice_id, org_id),
        )
        inv = cur.fetchone()
        if not inv:
            raise HTTPException(404, "Invoice not found")
        if inv["status"] not in ("draft",):
            raise HTTPException(400, "Only draft invoices can be edited")

        issue_date = date.fromisoformat(body.issue_date) if body.issue_date else date.today()
        due_date = date.fromisoformat(body.due_date) if body.due_date else None

        items = []
        for item in body.items:
            amt = _calc_item_amount(item.quantity, item.unit_price, item.discount_rate)
            items.append({
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_rate": item.tax_rate,
                "discount_rate": item.discount_rate,
                "sort_order": item.sort_order,
                "amount": amt,
            })

        subtotal, tax_total, total = _calc_totals(items)

        cur.execute(
            """
            UPDATE app.invoices SET
              client_id=%s::uuid, issue_date=%s, due_date=%s, currency=%s,
              subtotal=%s, tax_total=%s, total=%s, notes=%s, internal_notes=%s,
              payment_terms=%s, po_number=%s
            WHERE id=%s::uuid AND organization_id=%s RETURNING *
            """,
            (body.client_id, issue_date, due_date, body.currency,
             subtotal, tax_total, total, body.notes, body.internal_notes,
             body.payment_terms, body.po_number, invoice_id, org_id),
        )
        invoice = _row_dict(cur.fetchone())

        # Replace line items
        cur.execute("DELETE FROM app.invoice_items WHERE invoice_id = %s::uuid", (invoice_id,))
        for item in items:
            cur.execute(
                """
                INSERT INTO app.invoice_items
                  (invoice_id, sort_order, description, quantity, unit_price,
                   tax_rate, discount_rate, amount)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (invoice_id, item["sort_order"], item["description"], item["quantity"],
                 item["unit_price"], item["tax_rate"], item["discount_rate"], item["amount"]),
            )
        conn.commit()

    invoice["items"] = items
    return invoice


@router.delete("/invoices/{invoice_id}", status_code=204)
def delete_invoice(
    invoice_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT status FROM app.invoices WHERE id=%s::uuid AND organization_id=%s",
            (invoice_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Invoice not found")
        if row["status"] not in ("draft", "void", "cancelled"):
            raise HTTPException(400, "Only draft/void/cancelled invoices can be deleted")
        cur.execute(
            "DELETE FROM app.invoices WHERE id=%s::uuid AND organization_id=%s",
            (invoice_id, org_id),
        )
        conn.commit()


@router.post("/invoices/{invoice_id}/void", status_code=204)
def void_invoice(
    invoice_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE app.invoices SET status='void' "
            "WHERE id=%s::uuid AND organization_id=%s AND status != 'paid' RETURNING id",
            (invoice_id, org_id),
        )
        if not cur.fetchone():
            raise HTTPException(400, "Invoice cannot be voided (not found or already paid)")
        conn.commit()


@router.post("/invoices/{invoice_id}/send", status_code=204)
def send_invoice(
    invoice_id: str,
    request: Request,
    bg: BackgroundTasks,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    """Mark invoice as sent and email PDF to client."""
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT i.*, c.email AS client_email, c.name AS client_name "
            "FROM app.invoices i LEFT JOIN app.billing_clients c ON c.id = i.client_id "
            "WHERE i.id=%s::uuid AND i.organization_id=%s",
            (invoice_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Invoice not found")
        inv = _row_dict(row)
        if inv["status"] == "paid":
            raise HTTPException(400, "Invoice already paid")

        cur.execute(
            "UPDATE app.invoices SET status='sent', sent_at=now() "
            "WHERE id=%s::uuid",
            (invoice_id,),
        )
        conn.commit()

    # Email in background
    client_email = inv.get("client_email")
    if client_email and SENDGRID_API_KEY:
        bg.add_task(_email_invoice_bg, invoice_id, org_id, client_email, inv)


def _email_invoice_bg(invoice_id: str, org_id: str, to_email: str, inv: dict):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM app.billing_profiles WHERE organization_id = %s", (org_id,))
            profile = _row_dict(cur.fetchone() or {})
            cur.execute(
                "SELECT * FROM app.billing_clients WHERE id = %s::uuid", (inv.get("client_id"),)
            )
            client = _row_dict(cur.fetchone() or {})
            cur.execute(
                "SELECT * FROM app.invoice_items WHERE invoice_id=%s::uuid ORDER BY sort_order", (invoice_id,)
            )
            items = [_row_dict(r) for r in cur.fetchall()]
            cur.execute(
                "SELECT * FROM app.invoice_payments WHERE invoice_id=%s::uuid ORDER BY payment_date", (invoice_id,)
            )
            payments = [_row_dict(r) for r in cur.fetchall()]

        pdf_bytes = generate_invoice_pdf(inv, profile, client, items, payments)
        _send_invoice_email(to_email, inv, pdf_bytes)
    except Exception:
        _log.exception("Failed to email invoice %s", invoice_id)


def _send_invoice_email(to: str, inv: dict, pdf_bytes: bytes):
    """Send invoice PDF via SendGrid with attachment."""
    import json
    import urllib.request
    import base64

    inv_num = inv.get("invoice_number", "Invoice")
    due = inv.get("due_date", "")
    total = inv.get("total", 0)
    currency = inv.get("currency", "USD")

    html = f"""
    <p>Dear {inv.get('client_name','Customer')},</p>
    <p>Please find attached invoice <strong>{inv_num}</strong>
       for <strong>{currency} {float(total):,.2f}</strong>
       due <strong>{due}</strong>.</p>
    <p>If you have any questions, please reply to this email.</p>
    """

    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": EMAIL_FROM, "name": "Billing"},
        "subject": f"Invoice {inv_num}",
        "content": [{"type": "text/html", "value": html}],
        "attachments": [{
            "content": base64.b64encode(pdf_bytes).decode(),
            "type": "application/pdf",
            "filename": f"{inv_num}.pdf",
        }],
    }

    req = urllib.request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
    except Exception:
        _log.exception("SendGrid email failed for invoice %s", inv.get("invoice_number"))


@router.post("/invoices/{invoice_id}/payments", status_code=201)
def record_payment(
    invoice_id: str,
    body: PaymentIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, total, amount_paid, status FROM app.invoices "
            "WHERE id=%s::uuid AND organization_id=%s",
            (invoice_id, org_id),
        )
        inv = cur.fetchone()
        if not inv:
            raise HTTPException(404, "Invoice not found")
        if inv["status"] in ("void", "cancelled"):
            raise HTTPException(400, "Cannot record payment on void/cancelled invoice")

        pay_date = date.fromisoformat(body.payment_date) if body.payment_date else date.today()
        cur.execute(
            """
            INSERT INTO app.invoice_payments
              (invoice_id, amount, payment_date, method, reference, notes, recorded_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """,
            (invoice_id, body.amount, pay_date, body.method,
             body.reference, body.notes, user.id),
        )
        payment = _row_dict(cur.fetchone())

        # Update amount_paid + status
        new_paid = float(inv["amount_paid"]) + body.amount
        total = float(inv["total"])
        if new_paid >= total:
            new_status = "paid"
        elif new_paid > 0:
            new_status = "partial"
        else:
            new_status = inv["status"]

        paid_at = "now()" if new_status == "paid" else "NULL"
        cur.execute(
            f"UPDATE app.invoices SET amount_paid=%s, status=%s, paid_at={'now()' if new_status=='paid' else 'NULL'} "
            "WHERE id=%s::uuid",
            (new_paid, new_status, invoice_id),
        )
        conn.commit()

    return payment


@router.get("/invoices/{invoice_id}/pdf")
def download_pdf(
    invoice_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT i.*,
                   c.name AS client_name, c.email AS client_email,
                   c.address AS client_address, c.city AS client_city,
                   c.state AS client_state, c.zip AS client_zip,
                   c.country AS client_country, c.phone AS client_phone,
                   c.tax_id AS client_tax_id, c.tax_label AS client_tax_label,
                   c.contact_person AS client_contact_person
            FROM app.invoices i
            LEFT JOIN app.billing_clients c ON c.id = i.client_id
            WHERE i.id=%s::uuid AND i.organization_id=%s
            """,
            (invoice_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Invoice not found")
        invoice = _row_dict(row)

        cur.execute("SELECT * FROM app.billing_profiles WHERE organization_id=%s", (org_id,))
        profile = _row_dict(cur.fetchone() or {})

        cur.execute(
            "SELECT * FROM app.invoice_items WHERE invoice_id=%s::uuid ORDER BY sort_order", (invoice_id,)
        )
        items = [_row_dict(r) for r in cur.fetchall()]

        cur.execute(
            "SELECT * FROM app.invoice_payments WHERE invoice_id=%s::uuid ORDER BY payment_date", (invoice_id,)
        )
        payments = [_row_dict(r) for r in cur.fetchall()]

    # Build client dict from prefixed columns
    client = {
        k[len("client_"):]: invoice.pop(f"client_{k}", None)
        for k in ["name","email","address","city","state","zip","country","phone","tax_id","tax_label","contact_person"]
    }
    client["name"] = invoice.pop("client_name", "")
    client["email"] = invoice.pop("client_email", "")

    pdf_bytes = generate_invoice_pdf(invoice, profile, client, items, payments)
    inv_num = invoice.get("invoice_number", "invoice")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{inv_num}.pdf"'},
    )


# ── Dashboard + platform stats ─────────────────────────────────────────────────

@router.get("/dashboard")
def billing_dashboard(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              COUNT(*) FILTER (WHERE status = 'draft')          AS drafts,
              COUNT(*) FILTER (WHERE status IN ('sent','viewed','partial','overdue')) AS outstanding,
              COUNT(*) FILTER (WHERE status = 'paid')           AS paid_count,
              COUNT(*) FILTER (WHERE status = 'overdue')        AS overdue_count,
              COALESCE(SUM(total - amount_paid) FILTER (WHERE status IN ('sent','viewed','partial','overdue')), 0) AS outstanding_amount,
              COALESCE(SUM(amount_paid) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('month', now())), 0) AS paid_this_month,
              COALESCE(SUM(total - amount_paid) FILTER (WHERE status = 'overdue'), 0) AS overdue_amount
            FROM app.invoices WHERE organization_id = %s
            """,
            (org_id,),
        )
        row = _row_dict(cur.fetchone() or {})

        cur.execute(
            """
            SELECT i.*, c.name AS client_name
            FROM app.invoices i LEFT JOIN app.billing_clients c ON c.id = i.client_id
            WHERE i.organization_id = %s
            ORDER BY i.created_at DESC LIMIT 10
            """,
            (org_id,),
        )
        recent = [_row_dict(r) for r in cur.fetchall()]

    return {**row, "recent_invoices": recent}


@router.get("/platform-stats")
def billing_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("billing"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              COUNT(*) FILTER (WHERE status IN ('sent','viewed','partial','overdue')) AS outstanding,
              COALESCE(SUM(total - amount_paid) FILTER (WHERE status IN ('sent','viewed','partial','overdue')), 0) AS outstanding_amount,
              COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
              currency_default AS currency
            FROM app.invoices i
            LEFT JOIN app.billing_profiles bp ON bp.organization_id = i.organization_id
            WHERE i.organization_id = %s
            GROUP BY currency_default
            LIMIT 1
            """,
            (org_id,),
        )
        row = cur.fetchone()

    if not row:
        return {"stats": ["No invoices yet"], "health": "healthy"}

    outstanding = int(row["outstanding"] or 0)
    overdue = int(row["overdue_count"] or 0)
    amount = float(row["outstanding_amount"] or 0)
    cur_sym = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹"}.get(str(row["currency"] or "USD"), "")

    stats = [f"{outstanding} outstanding"]
    if amount > 0:
        stats[0] = f"{cur_sym}{amount:,.0f} outstanding"
    if overdue:
        stats.append(f"{overdue} overdue")

    health = "critical" if overdue > 0 else ("warning" if outstanding > 0 else "healthy")
    return {"stats": stats, "health": health}
