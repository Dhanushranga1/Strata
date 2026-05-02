# TicketPilot Product Troubleshooting Guide

## API & Rate Limits

### Why am I getting HTTP 429 errors from the API?
HTTP 429 means you have exceeded your plan's rate limit. Limits by plan:
- **Starter**: 1,000 requests/hour
- **Growth**: 5,000 requests/hour
- **Enterprise**: Unlimited

**To fix 429 errors:**
1. Check the `Retry-After` header in the response — it tells you how many seconds to wait.
2. Implement exponential backoff in your client: start at 1 second, double on each failure, cap at 60 seconds.
3. Cache GET responses locally where possible to reduce read requests.
4. If you consistently hit the limit, upgrade your plan in Settings → Billing → Upgrade Plan.

**Monitoring usage:** Go to Settings → API → Usage Dashboard to see requests per hour in real time.

### My API token stopped working after a password change
JWT tokens issued before a password change remain valid until they expire (default 1 hour). However, **service tokens** tied to your account are invalidated immediately when you change your password or revoke them. To generate a new service token:
1. Go to Settings → API → Service Tokens.
2. Click **Revoke** on the old token.
3. Click **New Token**, give it a name, and save it immediately (it is only shown once).

### Webhooks are not firing
Check the following in order:
1. **Endpoint reachability**: Your webhook URL must return HTTP 200 within 10 seconds. Test it with `curl -X POST <your-url> -d '{}'`.
2. **Event subscription**: In Settings → Webhooks, ensure the correct events are enabled (e.g. `ticket.created`, `ticket.resolved`).
3. **Signing secret**: Verify the `X-TicketPilot-Signature` header in your handler. Re-generate the secret if needed.
4. **Retry log**: TicketPilot retries failed webhooks up to 5 times with exponential backoff. Check Settings → Webhooks → Delivery Logs for error details.
5. **Firewall**: Ensure your server allows inbound POST requests from TicketPilot's IP range: `52.74.0.0/16` (AP-South-1).

---

## Email & Inbound

### Customers are not receiving ticket confirmation emails
1. Check that your **from domain** is verified in Settings → Email → Sender Identity.
2. SPF and DKIM records must be added to your DNS — see Settings → Email → DNS Setup.
3. Ask the customer to check their spam folder and whitelist `noreply@ticketpilot.io`.
4. Verify the customer's email address is correct on the ticket.
5. If the problem persists, check the delivery log in Settings → Email → Send Logs.

### Inbound email replies are not appending to tickets
Each ticket generates a unique reply-to address like `reply+<token>@inbound.ticketpilot.io`. Ensure:
1. **Inbound email is enabled**: Settings → Email → Inbound Email → toggle ON.
2. The MX record `inbound.ticketpilot.io` is set correctly in your domain DNS.
3. The customer is replying to the original confirmation email (not forwarding).
4. The reply-to address has not been stripped by the customer's email client.

---

## Ticket Routing

### Tickets are going to the wrong rep
Auto-assignment routing uses the algorithm selected in Settings → Workflow → Auto-assign:
- **Round-robin**: distributes evenly across all active reps.
- **Skill-based**: routes to reps whose skills match the ticket's tags.
- **Load-balanced**: assigns to the rep with the fewest open tickets.

To fix incorrect routing:
1. Review rep **skill tags** in Settings → Team → Members — ensure tags match ticket categories.
2. Check that the rep is marked **Available** (not Away or Offline) in their profile.
3. If a specific ticket was mis-routed, manually reassign via the ticket's Assignee dropdown.

### Tickets are stuck in "open" with no assignee
This usually means no rep matched the routing rules. Check:
1. At least one rep is active and online.
2. If skill-based routing is on, at least one rep has skills matching the ticket's tags.
3. Check Settings → Workflow → Fallback Assignee — set a default rep to catch unmatched tickets.

---

## Performance

### The dashboard is loading slowly
1. Large ticket queues (10,000+) can slow list views. Use filters (date range, status, assignee) to narrow results.
2. Export tickets older than 90 days via Settings → Export to archive them.
3. FAISS vector search rebuilds happen on deploy — performance may be lower for a few minutes after a new release.
4. If slowness is persistent, contact support with your org ID and the slow endpoint URL.

### Knowledge base search returns irrelevant results
FAISS cosine similarity may return low-relevance matches when:
1. The KB has fewer than 10 documents — add more content to improve coverage.
2. Documents contain mostly images or tables — plain text and Markdown work best.
3. The query is very short (1–2 words) — ask a full question for better semantic matching.
4. Refresh the index by re-uploading any recently edited documents.
