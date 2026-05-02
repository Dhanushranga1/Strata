# TicketPilot Team Management & Onboarding Guide

## Inviting Team Members

### How do I add a new support rep to my organization?
Only **owners** and **admins** can invite new members. Steps:
1. Go to **Settings → Team → Members**.
2. Click **Invite Member**.
3. Enter the rep's email address and select their role: **Rep**, **Admin**, or **Member** (read-only customer view).
4. Click **Send Invite** — the rep receives an email with a link valid for **7 days**.
5. Once they accept, they appear in the Members list and can log in immediately.

**Role permissions:**
- **Owner**: Full access, billing, can delete the organization.
- **Admin**: Everything except billing and org deletion; can manage members.
- **Rep**: Can view and reply to tickets, manage KB, but cannot invite members or change settings.
- **Member**: Customers — can submit tickets and view their own ticket history only.

### The invite email expired — how do I resend it?
1. Go to Settings → Team → Invites.
2. Find the pending invite and click **Resend** — this generates a fresh 7-day link.
3. If the rep accidentally deleted the original email, resending is the only option (invite tokens are single-use).

### How do I remove a team member?
1. Go to Settings → Team → Members.
2. Click the three-dot menu next to the member's name.
3. Select **Remove from Organization**.
4. The member loses access immediately but their past messages and assigned tickets are preserved.

---

## Roles & Permissions

### Can I change a rep's role after they've joined?
Yes. Go to Settings → Team → Members, click the role badge next to the member, and select the new role. Changes take effect immediately — the member will see the updated permissions on their next page load or after re-logging in.

### What is the difference between Admin and Owner?
- There can be **only one Owner** per organization (the account that created it).
- The Owner cannot be removed or have their role changed except by transferring ownership (Settings → Organization → Transfer Ownership).
- **Admins** have the same permissions as Owner except they cannot access billing, delete the organization, or transfer ownership.

### How do I give a customer rep-level access?
Customers (Members) must be manually upgraded to Rep role:
1. Settings → Team → Members → find the user.
2. Click their role badge → select **Rep**.
3. Optionally assign them to a team or skill group.

---

## Organization Settings

### How do I rename my organization?
Go to Settings → Organization → General → change the **Organization Name** field → click **Save**. The new name appears in all ticket emails and the customer portal immediately.

### How do I set SLA / overdue thresholds?
Go to Settings → Workflow → SLA Thresholds. You can set per-priority overdue hours:
- P1 (Critical): default 6 hours
- P2 (High): default 12 hours
- P3 (Medium-High): default 24 hours
- P4 (Medium): default 48 hours
- P5 (Low-Medium): default 72 hours
- P6/P7: default 168 hours

Changes apply to new tickets immediately; existing open tickets re-evaluate on the next overdue scan (runs every 15 minutes).

### How do I set up team-based routing?
1. Create a **Team** in Settings → Team → Teams → New Team.
2. Add reps to the team and assign skill tags (e.g. `billing`, `technical`, `returns`).
3. In Settings → Workflow → Auto-assign, select **Skill-based** and map ticket categories to teams.
4. Tickets tagged with matching categories will be routed to the corresponding team's reps.

---

## User Profile & Authentication

### How do reps log in?
Reps log in at `app.ticketpilot.io/login` using their email and password. If they signed up via Google, they must use **Continue with Google** — password login will fail.

### Can I require MFA for all team members?
Yes. Go to Settings → Security → Authentication → enable **Require MFA for all members**. Members will be prompted to set up an authenticator app on their next login. Existing sessions are revoked after 24 hours.

### A rep is locked out after too many failed logins
TicketPilot locks accounts after **10 consecutive failed login attempts** with a **15-minute cooldown**. To unlock immediately:
1. Settings → Team → Members → find the rep.
2. Click **Unlock Account**.
3. Optionally reset their password from the same menu to send them a new reset link.
