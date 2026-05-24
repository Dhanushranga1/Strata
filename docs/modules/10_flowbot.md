# FlowBot — Automation Rules Engine

## Problem It Solves
IT spends hours every week on repetitive ticket housekeeping:
- Routing "printer" tickets to the hardware rep
- Closing tickets that haven't been updated in 7 days
- Sending reminder emails when a ticket goes overdue
- Escalating tickets that haven't been assigned within 2 hours

FlowBot is a configurable IF/THEN rule engine that automates these actions without code or external tools. It runs as part of the existing TicketPilot workflow.

---

## Feature Gate
`"flowbot"` — Business plan and above

---

## Rule Model
```
IF [trigger] AND [conditions] THEN [actions]
```

### Triggers
| Trigger | Description |
|---------|-------------|
| `ticket_created` | New ticket submitted |
| `ticket_updated` | Any ticket field changes |
| `ticket_status_changed` | Status transitions |
| `ticket_assigned` | Assignee changed |
| `ticket_idle` | No activity for N hours |
| `ticket_overdue` | `is_overdue` becomes true |
| `ticket_priority_changed` | Priority changes |
| `message_added` | New message on a ticket |

### Conditions (chainable with AND)
| Condition | Example value |
|-----------|--------------|
| `title_contains` | "printer", "vpn", "error" |
| `priority_is` | "urgent", "high" |
| `status_is` | "open", "pending" |
| `department_is` | "Engineering" |
| `unassigned` | (boolean) |
| `tag_is` | "hardware", "network" |
| `created_by_role` | "customer" |
| `idle_hours_gt` | 48 |
| `custom_field_equals` | `{field: "type", value: "hardware"}` |

### Actions
| Action | Description |
|--------|-------------|
| `assign_to_user` | Assign to specific rep |
| `assign_to_role` | Assign to first available rep with role |
| `change_priority` | Set priority level |
| `change_status` | Transition status |
| `add_tag` | Add tag to ticket |
| `send_notification` | Notify specific user or role |
| `send_email` | Email the ticket creator |
| `add_note` | Post internal note on ticket |
| `add_to_sla_policy` | Apply specific SLA policy |
| `create_linked_ticket` | Create follow-up ticket |

---

## Database Schema
**Migration:** `backend/migrations/0040_flowbot.sql`

```sql
CREATE TABLE app.automation_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  trigger_event    text NOT NULL,
  conditions       jsonb NOT NULL DEFAULT '[]',
  -- [{field: str, operator: str, value: any}]
  actions          jsonb NOT NULL DEFAULT '[]',
  -- [{type: str, params: {}}]
  is_active        bool NOT NULL DEFAULT true,
  run_count        int NOT NULL DEFAULT 0,
  last_run_at      timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_rules_org_active_trigger
  ON app.automation_rules(organization_id, trigger_event)
  WHERE is_active = true;
```

---

## Rule Evaluation Engine
Pure Python — no external libraries needed. Runs as a FastAPI background task on ticket events.

```python
# backend/app/modules/flowbot/engine.py

async def evaluate_rules(event: str, ticket: dict, org_id: str, db):
    rules = await db.fetch("""
        SELECT * FROM app.automation_rules
        WHERE organization_id = $1 AND trigger_event = $2 AND is_active = true
        ORDER BY created_at
    """, org_id, event)

    for rule in rules:
        if await matches_conditions(ticket, rule["conditions"]):
            await execute_actions(ticket, rule["actions"], org_id, db)
            await db.execute("""
                UPDATE app.automation_rules
                SET run_count = run_count + 1, last_run_at = now()
                WHERE id = $1
            """, rule["id"])

async def matches_conditions(ticket: dict, conditions: list) -> bool:
    for cond in conditions:
        if not evaluate_condition(ticket, cond):
            return False
    return True

def evaluate_condition(ticket: dict, cond: dict) -> bool:
    field = cond["field"]
    op = cond["operator"]
    value = cond["value"]
    ticket_val = ticket.get(field, "")

    if op == "contains":    return value.lower() in str(ticket_val).lower()
    if op == "equals":      return str(ticket_val) == str(value)
    if op == "not_equals":  return str(ticket_val) != str(value)
    if op == "is_empty":    return not ticket_val
    if op == "gt":          return float(ticket_val or 0) > float(value)
    if op == "lt":          return float(ticket_val or 0) < float(value)
    return False
```

---

## Integration Points
Rules are evaluated in existing ticket endpoints in `tickets.py`:

```python
# After ticket creation:
await evaluate_rules("ticket_created", ticket, org_id, db)

# After ticket update:
await evaluate_rules("ticket_updated", ticket, org_id, db)

# Status change:
if old_status != new_status:
    await evaluate_rules("ticket_status_changed",
                         {**ticket, "old_status": old_status}, org_id, db)
```

Idle/overdue rules are evaluated by a background job (existing overdue checker in `tasks.py`).

---

## API Endpoints
**Router prefix:** `/api/automation`
**File:** `backend/app/modules/flowbot/router.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/automation/rules` | List rules |
| POST | `/api/automation/rules` | Create rule |
| GET | `/api/automation/rules/{id}` | Rule detail |
| PATCH | `/api/automation/rules/{id}` | Update rule |
| DELETE | `/api/automation/rules/{id}` | Delete rule |
| POST | `/api/automation/rules/{id}/toggle` | Enable/disable rule |
| GET | `/api/automation/stats` | Module stats for Strata hub |

---

## Built-in Rule Templates
Pre-built rules admins can enable with one click:

| Template | Trigger | Condition | Action |
|----------|---------|-----------|--------|
| Auto-assign hardware tickets | ticket_created | title_contains "printer" OR "laptop" | assign_to_role "hardware_tech" |
| Escalate urgent unassigned | ticket_idle | priority = urgent, unassigned, idle > 2h | send_notification to admins |
| Auto-close stale tickets | ticket_idle | status = pending, idle > 7 days | change_status "closed", add_note "Auto-closed after 7 days" |
| Tag VPN tickets | ticket_created | title_contains "vpn" | add_tag "network", "vpn" |
| Notify on P1 creation | ticket_created | priority = urgent | send_notification to all_admins |

---

## Stats Response (Strata Hub)
```json
{
  "primary": "8 active rules",
  "secondary": "143 actions this month",
  "health": "healthy"
}
```

---

## Frontend Pages
**Base route:** `/automation`

| Page | Path | Description |
|------|------|-------------|
| Rule list | `/automation` | All rules with run counts + toggle |
| Rule editor | `/automation/rules/new` | Create rule (visual IF/THEN builder) |
| Rule detail | `/automation/rules/{id}` | Edit rule, view run history |

### Rule editor UI
```
IF  [Ticket Created ▼]
AND [ Title         ▼] [ contains ▼] [ printer          ]  [+ Add condition]

THEN
  [ Assign to role  ▼] [ hardware_tech ▼]    [+ Add action]
  [ Add tag         ▼] [ hardware      ]

[ Save Rule ]  [ Test Run ]
```

---

## Cross-Module Links
- **TicketPilot:** All rules execute against ticket events — the engine is embedded in ticket workflows
- **PeopleSync:** Future — Leaver trigger: "When HR event type = leaver, transfer open tickets"
- **IncidentBridge:** Future — "When incident severity = P1, set all open tickets from affected services to urgent"

---

## Notes
- Conditions are AND-only in v1 — OR conditions come in v2
- Max 50 active rules per org to prevent performance impact
- Rules execute synchronously in-process (no queue needed at SME scale)
- `test_run` endpoint: evaluates a rule against the last 10 tickets, returns which would have matched
- No circular rule chains: a rule action cannot trigger another rule (prevents infinite loops)
