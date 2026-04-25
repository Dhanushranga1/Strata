# PostgreSQL RLS Deep Dive - Interview Brief

## 1) What is RLS (2 Lines)

Row-Level Security is a PostgreSQL feature that automatically filters rows in SELECT/INSERT/UPDATE/DELETE based on policies tied to the current user or session variables. Enforces access control at the database layer, preventing data leakage even if application logic fails or is bypassed.

---

## 2) Tenant-Isolation Mechanism (5 Bullets)

- **Request arrives**: FastAPI middleware extracts `org_id` from JWT payload after verifying signature and expiry
- **Session variable set**: Execute `SET LOCAL app.org_id = '{org_id}'` at connection start using SQLAlchemy event listeners
- **RLS policy checks**: Every query hits policy like `USING (org_id = current_setting('app.org_id')::uuid)` automatically
- **Database filters**: PostgreSQL rewrites query plan to include `WHERE org_id = 'extracted_value'` before execution
- **Isolation guarantee**: Users see only rows matching their org_id; attempts to access others are silently filtered (no error, just empty results)

---

## 3) Sample Minimal RLS Policy

```sql
-- Enable RLS on table
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- SELECT policy: users see only their org's tickets
CREATE POLICY tenant_isolation_select ON tickets
  FOR SELECT
  USING (org_id = current_setting('app.org_id')::uuid);

-- INSERT policy: users can only create tickets for their org
CREATE POLICY tenant_isolation_insert ON tickets
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- UPDATE policy: users can only update their org's tickets
CREATE POLICY tenant_isolation_update ON tickets
  FOR UPDATE
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- DELETE policy: users can only delete their org's tickets
CREATE POLICY tenant_isolation_delete ON tickets
  FOR DELETE
  USING (org_id = current_setting('app.org_id')::uuid);
```

---

## 4) Supabase RLS Integration (4 Bullets)

- **JWT auth**: Client sends JWT → Supabase verifies signature → extracts `user_id` and `role` claims → sets as `auth.uid()` and `auth.role()`
- **Built-in functions**: Supabase provides `auth.uid()` (current user UUID), `auth.role()` (user role), and `auth.jwt()` (full claims) for use in policies
- **Automatic org mapping**: Policy like `USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()))` joins user to org on every query
- **Service role bypass**: Supabase service key sets `role = service_role` which bypasses RLS for admin operations (migration, seeding)

---

## 5) Common Attack Vectors + Fixes

**SQL Injection**  
Risk: Malicious input in `current_setting()` or policy subqueries.  
Fix: Use parameterized queries only, validate UUID format before setting session vars, never concatenate user input into SQL.

**Missing Policies**  
Risk: Table has RLS enabled but no policy → implicit DENY blocks all access (or implicit ALLOW if misconfigured).  
Fix: Write comprehensive tests checking CRUD for each role, automate policy coverage checks in CI, use policy templates.

**Security Definer Functions**  
Risk: Functions with `SECURITY DEFINER` run as owner, bypassing RLS and leaking cross-tenant data.  
Fix: Use `SECURITY INVOKER` (default), audit all functions with `\df+` for SECURITY DEFINER, wrap sensitive queries in policies.

**Leaky Joins**  
Risk: Joining RLS-protected table with non-protected table can leak data via side-channel (e.g., join reveals existence of rows).  
Fix: Apply RLS to all tables in tenant schema, avoid joins between tenant and shared tables, use views with explicit filters.

---

## 6) Performance Impact + Optimization

**Indexing Strategy**  
Impact: RLS adds `WHERE org_id = X` to every query; missing index causes table scans.  
Fix: Create composite indexes like `CREATE INDEX idx_tickets_org_created ON tickets(org_id, created_at DESC)` for common filters.

**Partitioning**  
Impact: Large tables with RLS scan all partitions even if only one org's data is needed.  
Fix: Use declarative partitioning by `org_id` (`PARTITION BY LIST (org_id)`) so queries hit only relevant partition, reducing scan overhead.

**Policy Complexity**  
Impact: Policies with subqueries (e.g., `SELECT org_id FROM users WHERE id = auth.uid()`) execute per row, causing N+1 queries.  
Fix: Denormalize `org_id` onto user session, use materialized views, or cache org lookup in application layer and pass as session var.

---

## 7) 30-Second Interviewer Explanation (90 Words)

"In TicketPilot, I used PostgreSQL Row-Level Security to enforce multi-tenancy at the database layer. When a request arrives, my FastAPI middleware extracts the organization ID from the JWT, sets it as a session variable using `SET LOCAL`, and RLS policies automatically filter every query to show only that org's data. The key benefit is defense-in-depth: even if my application has a bug or SQL injection vulnerability, the database physically prevents cross-tenant access because the policies are enforced at query execution time. I also indexed on org_id and tested all policies with automated checks to ensure no leakage."

---

## Bonus: Interview Questions You Can Now Answer

**Q: Why RLS over application-level filtering?**  
Defense-in-depth. Application bugs, bypassed authentication, or SQL injection can't leak data because database enforces isolation. Centralized security logic reduces code duplication across endpoints.

**Q: How do you test RLS policies?**  
Write integration tests that set different `org_id` values, attempt CRUD on cross-tenant data, and assert zero results. Use `SET ROLE` to simulate different users in test DB.

**Q: What happens if you forget to set session variable?**  
If `app.org_id` is not set, `current_setting()` throws error (safe fail). Use `current_setting('app.org_id', true)` (returns null instead of error) + policy default to deny access.

**Q: Can you bypass RLS?**  
Yes, with `SET ROLE postgres` or `SECURITY DEFINER` functions. Mitigate: restrict superuser access, audit SECURITY DEFINER functions, use `SECURITY INVOKER` by default.

**Q: How does RLS affect query performance?**  
Adds `WHERE` clause to every query. If `org_id` is indexed, minimal impact (<5ms). Without index, full table scans. Use `EXPLAIN ANALYZE` to verify index usage.

**Q: RLS with Supabase vs. custom FastAPI?**  
Supabase: JWT → `auth.uid()` automatic, built-in policies. FastAPI: Manual session variable setting, more control, no Supabase lock-in. I chose Supabase for auth simplicity, FastAPI for business logic.

**Q: How do you handle analytics across orgs (admin view)?**  
Use service role connection that bypasses RLS. Execute aggregate queries as superuser or create special `admin_analytics` role with permissive policies.

**Q: What if policy has bug (e.g., wrong comparison)?**  
Data leakage. Prevent: code review all policies, write explicit tests per role, use policy templates, enable query logging in staging to audit `WHERE` clauses.

---

## Key Takeaways for Interview

✅ RLS = database-layer security, not application-layer  
✅ Session variables (`SET LOCAL`) propagate to policy evaluation  
✅ Policies use `USING` (SELECT/UPDATE/DELETE) and `WITH CHECK` (INSERT/UPDATE)  
✅ Supabase integrates via `auth.uid()` from JWT  
✅ Index `org_id` and use partitioning for performance  
✅ Test thoroughly: missing policies, SECURITY DEFINER, leaky joins  
✅ Explain trade-off: security vs. slight performance cost (mitigated by indexing)
