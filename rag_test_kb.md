# TicketPilot Support Knowledge Base

## Account & Billing

### How do I reset my password?
Go to the login page and click "Forgot password". Enter your registered email address and you will receive a password reset link within 2 minutes. The link expires after 30 minutes. If you don't see the email, check your spam folder or contact support at help@ticketpilot.io.

### How do I upgrade my plan?
Navigate to Settings → Billing → Upgrade Plan. We offer three tiers: Starter ($29/month, up to 5 reps), Growth ($79/month, up to 20 reps), and Enterprise (custom pricing, unlimited reps). All plans include a 14-day free trial. Annual billing saves 20%.

### Can I get a refund?
We offer a full refund within 7 days of initial purchase. After 7 days, refunds are prorated for unused time on annual plans. Monthly plans are non-refundable after the billing cycle starts. To request a refund, email billing@ticketpilot.io with your account email and reason.

### What payment methods do you accept?
We accept Visa, Mastercard, American Express, and PayPal. For Enterprise plans, we also accept wire transfers and purchase orders. All transactions are processed securely via Stripe.

---

## AI Assistant (CASPER)

### What is CASPER?
CASPER (Contextual Adaptive Scoring with Probabilistic Ensemble Ranking) is TicketPilot's AI engine. It automatically classifies incoming tickets, scores confidence (0–1), routes to the right rep, and drafts cited answers from your knowledge base. A confidence score above 0.75 means the AI is highly certain; below 0.55 it escalates to a human rep.

### Why is CASPER's confidence score low?
Low confidence (below 0.55) usually means one of three things:
1. Your knowledge base doesn't have documents covering that topic — upload relevant docs in Settings → Knowledge Base.
2. The ticket is very ambiguous or uses unusual terminology.
3. The KB documents are outdated — re-upload the latest versions.

### How do I improve AI response quality?
Upload more detailed documentation in plain language. CASPER performs best with docs that include specific product names, error codes, and step-by-step instructions. Avoid PDFs with scanned images — use text-based PDFs or Markdown files. Aim for at least 10 high-quality documents before relying on AI responses.

### Can CASPER handle multiple languages?
Currently CASPER processes tickets in English only. Tickets in other languages are automatically flagged for human review. Multi-language support is on our Q2 roadmap.

---

## Tickets & Workflow

### How are ticket priorities assigned?
Tickets are automatically scored P1 through P7 based on:
- **P1 (Critical)**: Service down, data loss, security breach — 6-hour SLA
- **P2 (High)**: Major feature broken, affecting multiple users — 12-hour SLA
- **P3 (Medium-High)**: Important feature degraded — 24-hour SLA
- **P4 (Medium)**: Feature partially working — 48-hour SLA
- **P5 (Low-Medium)**: Minor inconvenience — 72-hour SLA
- **P6 (Low)**: Cosmetic issues, feature requests — 168-hour SLA
- **P7 (Informational)**: Questions, feedback — 168-hour SLA

### What happens when a ticket goes overdue?
When a ticket exceeds its SLA threshold, it is automatically marked overdue and the assigned rep receives an email notification. If it remains unresolved after another reminder interval (default 24 hours), a follow-up reminder is sent. Overdue tickets appear with a red indicator in the dashboard.

### How do I assign a ticket to a specific rep?
Open the ticket and click the "Assignee" dropdown on the right sidebar. You can assign to any active rep in your organization. The rep receives an email notification. You can also enable auto-assignment in Settings → Workflow, which uses round-robin or skill-based routing.

### Can customers reply to tickets via email?
Yes. Each ticket generates a unique reply-to email address. When a customer replies to their confirmation email, the message is automatically appended to the ticket thread. Enable this in Settings → Email → Inbound Email.

### How do I close or resolve a ticket?
Click the status dropdown at the top of the ticket and select "Resolved" or "Closed". Resolved means the issue is fixed but the ticket stays open for customer confirmation. Closed means the ticket is fully done. Customers receive an automatic satisfaction survey when a ticket is closed.

---

## Integrations

### Does TicketPilot integrate with Slack?
Yes. Go to Settings → Integrations → Slack and click "Connect". You can configure notifications for new tickets, overdue alerts, and escalations. Specific channels can be mapped to ticket categories.

### Does TicketPilot have a public API?
Yes. Our REST API is documented at docs.ticketpilot.io/api. Authentication uses Bearer tokens. Rate limits are 1000 requests/hour on Starter, 5000/hour on Growth, and unlimited on Enterprise. Webhooks are available for ticket creation, status changes, and resolution events.

### Can I import tickets from Zendesk or Intercom?
Yes, we have a one-click migration tool under Settings → Import. It supports Zendesk, Intercom, Freshdesk, and CSV imports. Historical tickets are imported with their original timestamps and metadata. The migration usually completes within 1 hour for up to 50,000 tickets.

---

## Security & Privacy

### Is my data encrypted?
All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Backups are encrypted and stored in a separate geographic region. We are SOC 2 Type II certified and GDPR compliant.

### Can I delete my account and all data?
Yes. Go to Settings → Account → Delete Account. This permanently deletes all tickets, knowledge base documents, user accounts, and billing history within 30 days. This action is irreversible. Export your data first via Settings → Export.

### Where is my data stored?
Data is stored in AWS ap-south-1 (Mumbai, India). Enterprise customers can request dedicated regions including US-East, EU-West, and AP-Southeast. Data residency agreements are available for Enterprise plans.
