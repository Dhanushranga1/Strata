"""
Email notification module for TicketPilot.
Uses SendGrid HTTP API — works with any recipient, not blocked by Render.

Required env vars:
  SENDGRID_API_KEY   from app.sendgrid.com/settings/api_keys
  EMAIL_FROM         sender address (default: noreply@ticketpilot.app)
"""
import os
import json
import logging
import threading
import urllib.request

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "TicketPilot <noreply@ticketpilot.app>")


def _enabled() -> bool:
    return bool(SENDGRID_API_KEY)


def _send(to: str, subject: str, html: str) -> bool:
    """Fire-and-forget send via SendGrid HTTP API in a background thread."""
    if not _enabled():
        logger.debug("[email] SENDGRID_API_KEY not set — skipping email to %s", to)
        return False

    def _do() -> None:
        try:
            # Parse "Name <addr>" format
            if "<" in EMAIL_FROM and ">" in EMAIL_FROM:
                name = EMAIL_FROM.split("<")[0].strip()
                addr = EMAIL_FROM.split("<")[1].rstrip(">").strip()
            else:
                name = "TicketPilot"
                addr = EMAIL_FROM.strip()

            payload = json.dumps({
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": addr, "name": name},
                "subject": subject,
                "content": [{"type": "text/html", "value": html}],
            }).encode()

            req = urllib.request.Request(
                "https://api.sendgrid.com/v3/mail/send",
                data=payload,
                headers={
                    "Authorization": f"Bearer {SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 202):
                    logger.info("[email] Sent '%s' to %s", subject, to)
                else:
                    logger.warning("[email] SendGrid returned %s for %s", resp.status, to)
        except Exception as exc:
            logger.warning("[email] Could not send to %s: %s", to, exc)

    threading.Thread(target=_do, daemon=True).start()
    return True


def _wrap(title: str, body: str) -> str:
    """Wrap body content in a branded email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title}</title>
</head>
<body style="margin:0;padding:40px 20px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#1e40af;padding:24px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-.5px;">TicketPilot</span>
    </div>
    <div style="padding:32px;">
      {body}
    </div>
    <div style="padding:16px 32px;background:#f3f4f6;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated message from TicketPilot. Do not reply.</p>
    </div>
  </div>
</body>
</html>"""


# ── New ticket notification ───────────────────────────────────────────────────

def send_new_ticket_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    created_by_email: str,
) -> bool:
    subject = f"New ticket: {ticket_title}"
    short_id = ticket_id[:8]
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">New support ticket raised</h2>
      <p style="color:#374151;margin:0 0 16px;">A new ticket has been submitted and needs attention.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#1d4ed8;font-weight:600;letter-spacing:.5px;">TICKET</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">Raised by: <strong style="color:#374151;">{created_by_email}</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>"""
    return _send(to, subject, _wrap(subject, body))


# ── AI failure notification ───────────────────────────────────────────────────

def send_ai_failure_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    confidence: float,
) -> bool:
    subject = f"AI could not resolve: {ticket_title}"
    short_id = ticket_id[:8]
    confidence_pct = round(confidence * 100)
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">AI assistant needs backup</h2>
      <p style="color:#374151;margin:0 0 16px;">
        The AI assistant could not resolve a ticket with sufficient confidence.
        Manual review is required.
      </p>
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#92400e;font-weight:600;letter-spacing:.5px;">TICKET NEEDING REVIEW</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">
        AI confidence: <strong style="color:#d97706;">{confidence_pct}%</strong>
        (threshold: 55%)
      </p>
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>"""
    return _send(to, subject, _wrap(subject, body))


# ── Overdue notifications ─────────────────────────────────────────────────────

def send_overdue_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    hours_open: int,
) -> bool:
    subject = f"Overdue ticket: {ticket_title}"
    short_id = ticket_id[:8]
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;color:#dc2626;">Ticket is overdue</h2>
      <p style="color:#374151;margin:0 0 16px;">
        A ticket has passed its resolution deadline and is now marked <strong>overdue</strong>.
      </p>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#991b1b;font-weight:600;letter-spacing:.5px;">OVERDUE TICKET</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">Open for: <strong style="color:#dc2626;">{hours_open} hours</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>"""
    return _send(to, subject, _wrap(subject, body))


def send_etr_reminder_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    expected_resolve_at: str,
) -> bool:
    subject = f"ETR in 1 hour: {ticket_title}"
    short_id = ticket_id[:8]
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;color:#d97706;">ETR approaching in ~1 hour</h2>
      <p style="color:#374151;margin:0 0 16px;">
        A ticket you're working on is due to be resolved within the next hour.
      </p>
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#92400e;font-weight:600;letter-spacing:.5px;">TICKET</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">Expected by: <strong style="color:#374151;">{expected_resolve_at}</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>"""
    return _send(to, subject, _wrap(subject, body))


def send_rep_reply_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    message_preview: str,
) -> bool:
    subject = f"Support replied: {ticket_title}"
    short_id = ticket_id[:8]
    preview = (message_preview[:200] + "…") if len(message_preview) > 200 else message_preview
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">A support rep has replied to your ticket</h2>
      <p style="color:#374151;margin:0 0 16px;">You have a new reply waiting for you.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#1d4ed8;font-weight:600;letter-spacing:.5px;">TICKET</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">"{preview}"</p>
      </div>
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>"""
    return _send(to, subject, _wrap(subject, body))


def send_ticket_resolved_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    resolution_note: str | None,
) -> bool:
    subject = f"Resolved: {ticket_title}"
    short_id = ticket_id[:8]
    note_html = (
        f'<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 16px;">'
        f'<p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;">RESOLUTION NOTE</p>'
        f'<p style="margin:0;font-size:14px;color:#374151;">{resolution_note}</p></div>'
    ) if resolution_note else ''
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;color:#059669;">Your ticket has been resolved</h2>
      <p style="color:#374151;margin:0 0 16px;">Your support ticket has been marked as resolved.</p>
      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#065f46;font-weight:600;letter-spacing:.5px;">RESOLVED</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      {note_html}
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>
      <p style="color:#6b7280;font-size:14px;margin:16px 0 0;">If the issue persists, please open a new ticket.</p>"""
    return _send(to, subject, _wrap(subject, body))


def send_ticket_created_for_customer_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    rep_email: str,
    priority: str = "normal",
) -> bool:
    subject = f"A support ticket was opened for you: {ticket_title}"
    short_id = ticket_id[:8]
    priority_color = {"urgent": "#dc2626", "high": "#d97706", "normal": "#2563eb", "low": "#6b7280"}.get(priority, "#2563eb")
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">A support ticket has been created for you</h2>
      <p style="color:#374151;margin:0 0 16px;">
        A member of our support team has opened a ticket on your behalf.
        You can reply to this thread and a rep will follow up with you.
      </p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#1d4ed8;font-weight:600;letter-spacing:.5px;">YOUR TICKET</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">
        Priority: <strong style="color:{priority_color};">{priority.capitalize()}</strong>
      </p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">Opened by: <strong style="color:#374151;">{rep_email}</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>"""
    return _send(to, subject, _wrap(subject, body))


def send_customer_reply_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    customer_email: str,
    message_preview: str,
) -> bool:
    subject = f"Customer replied: {ticket_title}"
    short_id = ticket_id[:8]
    preview = (message_preview[:200] + "…") if len(message_preview) > 200 else message_preview
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">A customer has replied to their ticket</h2>
      <p style="color:#374151;margin:0 0 16px;">A customer has posted a new message and may need your attention.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#1d4ed8;font-weight:600;letter-spacing:.5px;">TICKET</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;">CUSTOMER MESSAGE</p>
        <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">"{preview}"</p>
      </div>
      <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">From: <strong style="color:#374151;">{customer_email}</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>"""
    return _send(to, subject, _wrap(subject, body))


def send_overdue_reminder_email(
    to: str,
    ticket_id: str,
    ticket_title: str,
    hours_open: int,
) -> bool:
    subject = f"Reminder — still unresolved: {ticket_title}"
    short_id = ticket_id[:8]
    body = f"""
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;color:#dc2626;">Overdue ticket still unresolved</h2>
      <p style="color:#374151;margin:0 0 16px;">This is a reminder that an overdue ticket still requires your attention.</p>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#991b1b;font-weight:600;letter-spacing:.5px;">STILL UNRESOLVED</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{ticket_title}</p>
      </div>
      <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">Open for: <strong style="color:#dc2626;">{hours_open} hours</strong></p>
      <p style="color:#6b7280;font-size:14px;margin:0;">Ticket ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">{short_id}</code></p>"""
    return _send(to, subject, _wrap(subject, body))
