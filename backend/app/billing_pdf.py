"""
BillingVault PDF generator — produces professional invoices using ReportLab.
No system library dependencies (pure Python).
"""
import base64
import io
from datetime import date
from typing import List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Palette ────────────────────────────────────────────────────────────────────

BRAND   = colors.HexColor("#6366f1")   # indigo-500
DARK    = colors.HexColor("#111827")   # near-black
MUTED   = colors.HexColor("#6b7280")   # gray-500
LIGHT   = colors.HexColor("#f9fafb")   # gray-50
BORDER  = colors.HexColor("#e5e7eb")   # gray-200
WHITE   = colors.white
RED     = colors.HexColor("#ef4444")

W, H = A4
MARGIN = 18 * mm

_styles = getSampleStyleSheet()


def _style(name, **kw) -> ParagraphStyle:
    base = ParagraphStyle(name, parent=_styles["Normal"])
    for k, v in kw.items():
        setattr(base, k, v)
    return base


S_TITLE     = _style("title",    fontSize=26, textColor=BRAND,  leading=30, spaceAfter=0,  fontName="Helvetica-Bold")
S_LABEL     = _style("label",    fontSize=7,  textColor=MUTED,  leading=10, spaceBefore=4, fontName="Helvetica-Bold", letterSpacing=0.8)
S_BODY      = _style("body",     fontSize=9,  textColor=DARK,   leading=13)
S_BODY_SM   = _style("bodysm",   fontSize=8,  textColor=DARK,   leading=12)
S_MUTED     = _style("muted",    fontSize=8,  textColor=MUTED,  leading=12)
S_RIGHT     = _style("right",    fontSize=9,  textColor=DARK,   leading=13, alignment=TA_RIGHT)
S_RIGHT_B   = _style("rightb",   fontSize=9,  textColor=DARK,   leading=13, alignment=TA_RIGHT, fontName="Helvetica-Bold")
S_TOTAL_LBL = _style("totlbl",   fontSize=10, textColor=DARK,   leading=14, alignment=TA_RIGHT, fontName="Helvetica-Bold")
S_TOTAL_VAL = _style("totval",   fontSize=10, textColor=BRAND,  leading=14, alignment=TA_RIGHT, fontName="Helvetica-Bold")
S_TH        = _style("th",       fontSize=8,  textColor=WHITE,  leading=11, fontName="Helvetica-Bold", alignment=TA_LEFT)
S_TH_R      = _style("thr",      fontSize=8,  textColor=WHITE,  leading=11, fontName="Helvetica-Bold", alignment=TA_RIGHT)
S_TD        = _style("td",       fontSize=8.5, textColor=DARK,  leading=12)
S_TD_R      = _style("tdr",      fontSize=8.5, textColor=DARK,  leading=12, alignment=TA_RIGHT)
S_TD_M      = _style("tdm",      fontSize=8.5, textColor=MUTED, leading=12, alignment=TA_RIGHT)
S_FOOTER    = _style("footer",   fontSize=7,  textColor=MUTED,  leading=10, alignment=TA_CENTER)
S_OVERDUE   = _style("overdue",  fontSize=8,  textColor=RED,    leading=11, fontName="Helvetica-Bold")


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(str(text or "").replace("\n", "<br/>"), style)


def _fmt_money(amount, currency: str = "USD") -> str:
    symbols = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "AUD": "A$", "CAD": "C$", "SGD": "S$"}
    sym = symbols.get(currency.upper(), currency + " ")
    try:
        return f"{sym}{float(amount):,.2f}"
    except Exception:
        return f"{sym}0.00"


def _fmt_date(d) -> str:
    if d is None:
        return "—"
    if isinstance(d, str):
        return d
    if isinstance(d, date):
        return d.strftime("%d %b %Y")
    return str(d)


def generate_invoice_pdf(invoice: dict, profile: dict, client: dict, items: list, payments: list) -> bytes:
    """
    Generate a professional PDF invoice and return raw bytes.

    invoice  — dict with keys: invoice_number, status, issue_date, due_date,
                currency, subtotal, tax_total, discount_amount, total, amount_paid,
                notes, payment_terms, po_number
    profile  — dict with billing profile fields (company name, logo, bank, etc.)
    client   — dict with billing client fields
    items    — list of dicts: description, quantity, unit_price, tax_rate, discount_rate, amount
    payments — list of dicts: payment_date, amount, method, reference
    """
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN,
        title=f"Invoice {invoice.get('invoice_number', '')}",
    )

    story = []
    usable_w = W - 2 * MARGIN
    cur = invoice.get("currency", "USD")
    status = invoice.get("status", "draft").upper()
    amount_due = float(invoice.get("total", 0)) - float(invoice.get("amount_paid", 0))

    # ── HEADER: logo + INVOICE title ────────────────────────────────────────

    logo_cell: object = ""
    logo_b64 = profile.get("logo_base64") or ""
    if logo_b64:
        try:
            raw = base64.b64decode(logo_b64)
            img_buf = io.BytesIO(raw)
            logo_img = Image(img_buf, width=40*mm, height=16*mm, kind="bound")
            logo_cell = logo_img
        except Exception:
            logo_cell = _p(profile.get("company_name", ""), S_TITLE)
    else:
        logo_cell = _p(profile.get("company_name", ""), S_TITLE)

    # Status stamp
    if status in ("OVERDUE", "VOID", "CANCELLED"):
        stamp_color = RED
    elif status == "PAID":
        stamp_color = colors.HexColor("#10b981")
    else:
        stamp_color = BRAND

    header_table = Table(
        [[logo_cell, _p(f'<font color="{stamp_color.hexval() if hasattr(stamp_color,"hexval") else "#6366f1"}">{status if status != "DRAFT" else "INVOICE"}</font>', S_TITLE)]],
        colWidths=[usable_w * 0.55, usable_w * 0.45],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",  (1, 0), (1, 0),  "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND, spaceAfter=5*mm))

    # ── FROM / BILL TO / INVOICE META ────────────────────────────────────────

    def _addr_block(title: str, name: str, lines: list[str]) -> list:
        block = [_p(title, S_LABEL), Spacer(1, 1*mm)]
        block.append(_p(f"<b>{name}</b>", S_BODY))
        for line in lines:
            if line:
                block.append(_p(line, S_BODY_SM))
        return block

    # FROM
    from_lines = [
        profile.get("company_address", ""),
        ", ".join(filter(None, [profile.get("company_city"), profile.get("company_state"), profile.get("company_zip")])),
        profile.get("company_country", ""),
        profile.get("company_email", ""),
        profile.get("company_phone", ""),
    ]
    if profile.get("tax_id"):
        from_lines.append(f"{profile.get('tax_label','Tax ID')}: {profile['tax_id']}")

    # BILL TO
    to_lines = [
        client.get("address", "") or "",
        ", ".join(filter(None, [client.get("city"), client.get("state"), client.get("zip")])),
        client.get("country", "") or "",
        client.get("email", "") or "",
        client.get("phone", "") or "",
    ]
    if client.get("contact_person"):
        to_lines.insert(0, f"Attn: {client['contact_person']}")
    if client.get("tax_id"):
        to_lines.append(f"{client.get('tax_label','Tax ID')}: {client['tax_id']}")

    # META
    meta_rows = [
        ["Invoice No.", invoice.get("invoice_number", "")],
        ["Issue Date",  _fmt_date(invoice.get("issue_date"))],
        ["Due Date",    _fmt_date(invoice.get("due_date"))],
        ["Currency",    cur],
    ]
    if invoice.get("payment_terms"):
        meta_rows.append(["Terms", invoice["payment_terms"]])
    if invoice.get("po_number"):
        meta_rows.append(["PO Number", invoice["po_number"]])

    meta_table = Table(
        [[_p(k, S_MUTED), _p(v, S_BODY_SM)] for k, v in meta_rows],
        colWidths=[22*mm, 28*mm],
        hAlign="RIGHT",
    )
    meta_table.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
    ]))

    from_block = _addr_block("FROM", profile.get("company_name", "Your Company"), from_lines)
    to_block   = _addr_block("BILL TO", client.get("name", "Client"), to_lines)
    meta_block = [_p("INVOICE DETAILS", S_LABEL), Spacer(1, 1*mm), meta_table]

    info_table = Table(
        [[from_block, to_block, meta_block]],
        colWidths=[usable_w * 0.33, usable_w * 0.33, usable_w * 0.34],
    )
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LINEAFTER", (0, 0), (1, 0), 0.5, BORDER),
        ("RIGHTPADDING", (0, 0), (1, 0), 6*mm),
        ("LEFTPADDING",  (1, 0), (-1, 0), 6*mm),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6*mm))

    # ── OVERDUE / AMOUNT DUE NOTICE ──────────────────────────────────────────

    if status in ("OVERDUE",) or (status not in ("PAID", "VOID", "CANCELLED") and amount_due > 0):
        due_label = "AMOUNT DUE" if status == "OVERDUE" else "BALANCE DUE"
        badge = Table(
            [[_p(due_label, S_LABEL), _p(_fmt_money(amount_due, cur), S_TOTAL_VAL if status != "OVERDUE" else _style("odue", fontSize=11, textColor=RED, leading=14, alignment=TA_RIGHT, fontName="Helvetica-Bold"))]],
            colWidths=[usable_w * 0.6, usable_w * 0.4],
        )
        badge.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), LIGHT),
            ("ROUNDEDCORNERS", [3]),
            ("TOPPADDING",    (0, 0), (-1, -1), 4*mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4*mm),
            ("LEFTPADDING",   (0, 0), (0, -1),  4*mm),
            ("RIGHTPADDING",  (-1, 0), (-1, -1), 4*mm),
        ]))
        story.append(badge)
        story.append(Spacer(1, 5*mm))

    # ── LINE ITEMS TABLE ─────────────────────────────────────────────────────

    col_w = [usable_w * 0.42, usable_w * 0.1, usable_w * 0.14, usable_w * 0.1, usable_w * 0.1, usable_w * 0.14]
    headers = [
        _p("DESCRIPTION", S_TH),
        _p("QTY", S_TH_R),
        _p("UNIT PRICE", S_TH_R),
        _p("DISC %", S_TH_R),
        _p("TAX %", S_TH_R),
        _p("AMOUNT", S_TH_R),
    ]

    rows = [headers]
    for item in items:
        qty = float(item.get("quantity", 1))
        qty_str = f"{qty:g}"
        rows.append([
            _p(item.get("description", ""), S_TD),
            _p(qty_str, S_TD_R),
            _p(_fmt_money(item.get("unit_price", 0), cur), S_TD_R),
            _p(f"{float(item.get('discount_rate',0)):g}%", S_TD_M),
            _p(f"{float(item.get('tax_rate',0)):g}%", S_TD_M),
            _p(_fmt_money(item.get("amount", 0), cur), S_TD_R),
        ])

    items_table = Table(rows, colWidths=col_w, repeatRows=1)
    item_style = TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), BRAND),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT]),
        ("GRID",          (0, 0), (-1, -1), 0.3, BORDER),
        ("LINEBELOW",     (0, 0), (-1, 0), 0, WHITE),
        ("TOPPADDING",    (0, 0), (-1, -1), 3*mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3*mm),
        ("LEFTPADDING",   (0, 0), (-1, -1), 3*mm),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 3*mm),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ])
    items_table.setStyle(item_style)
    story.append(KeepTogether(items_table))
    story.append(Spacer(1, 4*mm))

    # ── TOTALS ───────────────────────────────────────────────────────────────

    subtotal = float(invoice.get("subtotal", 0))
    tax_total = float(invoice.get("tax_total", 0))
    discount  = float(invoice.get("discount_amount", 0))
    total     = float(invoice.get("total", 0))
    paid      = float(invoice.get("amount_paid", 0))

    totals_rows = []
    totals_rows.append([_p("Subtotal", S_MUTED),    _p(_fmt_money(subtotal, cur), S_RIGHT)])
    if discount:
        totals_rows.append([_p("Discount", S_MUTED), _p(f"− {_fmt_money(discount, cur)}", _style("disc", fontSize=9, textColor=RED, leading=13, alignment=TA_RIGHT))])
    if tax_total:
        totals_rows.append([_p("Tax", S_MUTED),      _p(_fmt_money(tax_total, cur), S_RIGHT)])
    totals_rows.append(["", ""])  # separator row
    totals_rows.append([_p("TOTAL", S_TOTAL_LBL),   _p(_fmt_money(total, cur), S_TOTAL_VAL)])
    if paid > 0:
        totals_rows.append([_p("Amount Paid", S_MUTED), _p(f"− {_fmt_money(paid, cur)}", _style("paid", fontSize=9, textColor=colors.HexColor("#10b981"), leading=13, alignment=TA_RIGHT))])
        totals_rows.append([_p("BALANCE DUE", S_TOTAL_LBL), _p(_fmt_money(amount_due, cur), S_TOTAL_VAL)])

    totals_table = Table(totals_rows, colWidths=[usable_w * 0.6, usable_w * 0.4], hAlign="RIGHT")
    sep_row_idx = next((i for i, r in enumerate(totals_rows) if r == ["", ""]), None)

    totals_style = [
        ("TOPPADDING",    (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("ALIGN",         (0, 0), (-1, -1), "RIGHT"),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
    ]
    total_row_idx = next((i for i, r in enumerate(totals_rows) if r[0] != "" and "TOTAL" in str(r[0]._text if hasattr(r[0], "_text") else r[0])), None)
    if sep_row_idx is not None:
        totals_style.append(("LINEABOVE", (0, sep_row_idx), (-1, sep_row_idx), 1, BORDER))

    totals_table.setStyle(TableStyle(totals_style))

    story.append(Table(
        [[None, totals_table]],
        colWidths=[usable_w * 0.5, usable_w * 0.5],
    ))
    story.append(Spacer(1, 5*mm))

    # ── NOTES ────────────────────────────────────────────────────────────────

    if invoice.get("notes"):
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=3*mm))
        story.append(_p("NOTES", S_LABEL))
        story.append(Spacer(1, 1*mm))
        story.append(_p(invoice["notes"], S_BODY_SM))
        story.append(Spacer(1, 4*mm))

    # ── PAYMENT HISTORY ──────────────────────────────────────────────────────

    if payments:
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=3*mm))
        story.append(_p("PAYMENT HISTORY", S_LABEL))
        story.append(Spacer(1, 1*mm))
        pay_rows = [[
            _p("DATE", S_TH), _p("METHOD", S_TH), _p("REFERENCE", S_TH), _p("AMOUNT", S_TH_R)
        ]]
        for pay in payments:
            pay_rows.append([
                _p(_fmt_date(pay.get("payment_date")), S_TD),
                _p(str(pay.get("method", "")).replace("_", " ").title(), S_TD),
                _p(pay.get("reference", "") or "—", S_TD),
                _p(_fmt_money(pay.get("amount", 0), cur), S_TD_R),
            ])
        pay_table = Table(pay_rows, colWidths=[25*mm, 30*mm, usable_w-95*mm, 30*mm])
        pay_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 2.5*mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5*mm),
            ("LEFTPADDING",   (0, 0), (-1, -1), 2*mm),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 2*mm),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(pay_table)
        story.append(Spacer(1, 4*mm))

    # ── BANK / PAYMENT INSTRUCTIONS ─────────────────────────────────────────

    bank_fields = [
        ("Bank Name",    profile.get("bank_name")),
        ("Account Name", profile.get("bank_beneficiary")),
        ("Account No.",  profile.get("bank_account")),
        ("Routing No.",  profile.get("bank_routing")),
        ("SWIFT/BIC",    profile.get("bank_swift")),
        ("IBAN",         profile.get("bank_iban")),
    ]
    bank_present = [(k, v) for k, v in bank_fields if v]

    if bank_present:
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=3*mm))
        story.append(_p("BANK / PAYMENT DETAILS", S_LABEL))
        story.append(Spacer(1, 1*mm))
        bank_table = Table(
            [[_p(k, S_MUTED), _p(v, S_BODY_SM)] for k, v in bank_present],
            colWidths=[30*mm, usable_w - 30*mm],
        )
        bank_table.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 1.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ("ALIGN", (0, 0), (0, -1), "RIGHT"),
            ("RIGHTPADDING", (0, 0), (0, -1), 4*mm),
        ]))
        story.append(bank_table)
        story.append(Spacer(1, 4*mm))

    # ── FOOTER ───────────────────────────────────────────────────────────────

    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=2*mm))
    footer_text = profile.get("footer_text") or "Thank you for your business."
    if profile.get("signature_name"):
        footer_text += f"  ·  {profile['signature_name']}"
        if profile.get("signature_title"):
            footer_text += f", {profile['signature_title']}"
    story.append(_p(footer_text, S_FOOTER))
    story.append(_p(f"Invoice {invoice.get('invoice_number', '')}  ·  Generated by Strata BillingVault", S_FOOTER))

    doc.build(story)
    return buf.getvalue()
