# Comprehensive Code Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three-pass code review of the `scheduling-hardening` branch covering security, correctness, and code quality — finding and fixing all Critical/Warning issues before the branch ships.

**Architecture:** Each pass is an isolated task dispatched to a fresh subagent. The subagent reads only the files for its domain, works through a numbered checklist, fixes every 🔴/🟡 finding in place, and commits. Pass 2 may only start after Pass 1 has zero unfixed 🔴 issues. Pass 3 may only start after Pass 2 is clean.

**Tech Stack:** Expo / React Native (mobile), Next.js 14 (web), Supabase Postgres + Deno Edge Functions, TypeScript, pnpm monorepo. Repo root: `C:\Users\Emre\Berber randevu`. Active branch: `scheduling-hardening`.

---

## Conventions the subagent must know

**Finding format (use exactly this):**
```
🔴 CRITICAL [path/to/file.ts:42] — description + recommended fix
🟡 WARNING  [path/to/file.ts:42] — description + recommended fix
🟢 MINOR    [path/to/file.ts:42] — description (document only)
```

**Severity protocol:**
- 🔴 CRITICAL — Fix in same pass, commit immediately after each fix
- 🟡 WARNING — Fix in same pass if the change is ≤ 20 lines; otherwise document with a concrete fix recipe
- 🟢 MINOR — Document only; no code change in this pass

**Edge function convention:**
- `widget-*` functions = public, `verify_jwt = false` in config.toml (intentional)
- `app-*` functions = JWT required, `verify_jwt = true`
- Admin client lives in `supabase/functions/_shared/supabase-admin.ts` — server-side only, never in mobile/web bundles

**Design system tokens (mobile):** `T.brand600` = navy primary, `T.coral600` = danger/destructive, `T.positive` = mint for live/positive indicators. Hardcoded hex colors like `#1E3A8A`, `#DC2626` are legacy and must be replaced.

---

## Task 1 — Pass 1: Security Review

**Files to read (read ALL before checking):**

```
supabase/functions/delete-account/index.ts
supabase/functions/app-book-appointment/index.ts
supabase/functions/app-cancel-appointment/index.ts
supabase/functions/create-widget-token/index.ts
supabase/functions/widget-book-appointment/index.ts
supabase/functions/widget-get-availability/index.ts
supabase/functions/block-walkin/index.ts
supabase/functions/create-manual-block/index.ts
supabase/functions/_shared/supabase-admin.ts
supabase/functions/_shared/cors.ts
apps/mobile/app/(auth)/register.tsx
apps/mobile/app/(auth)/login.tsx
apps/mobile/app/_layout.tsx
apps/mobile/lib/user-context.tsx
supabase/migrations/20260513074317_backend_scheduling_hardening.sql
supabase/migrations/20260514080010_scheduling_rls_policy_consolidation.sql
supabase/migrations/20260515081251_restrict_scheduling_rpc_execute.sql
supabase/migrations/20260517100000_manual_block_edge_only.sql
supabase/migrations/20260518110000_block_direct_appointment_scheduling_writes.sql
supabase/migrations/20260518130000_non_scheduling_rls_advisor_cleanup.sql
supabase/migrations/20260518140000_scheduling_rpc_authorization_hardening.sql
supabase/migrations/20260518160000_customer_cancel_authorization.sql
supabase/migrations/20260518190000_phone_booking_rate_limit.sql
supabase/config.toml
```

- [ ] **Step 1.1 — Read all 24 files**

  Read every file in the list above before making any findings. Do not skip files.

- [ ] **Step 1.2 — Check S1: JWT extraction in all data-mutating edge functions**

  For each function in `app-book-appointment`, `app-cancel-appointment`, `create-widget-token`, `delete-account`, `block-walkin`, `create-manual-block`:

  **Good pattern (PASS):**
  ```typescript
  const authHeader = req.headers.get("Authorization");
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader?.replace("Bearer ", "") ?? ""
  );
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  // user.id is now safe to use
  ```

  **Bad pattern (FAIL → 🔴 CRITICAL):** Function reads `user_id` from `await req.json()` body and uses it directly — attacker can supply any user_id.

  File each violation as:
  ```
  🔴 CRITICAL [supabase/functions/X/index.ts:LINE] — user_id read from request body, not from JWT token. Replace body.user_id with user.id extracted from supabase.auth.getUser()
  ```

- [ ] **Step 1.3 — Check S2: delete-account IDOR**

  In `delete-account/index.ts`: after extracting `user.id` from JWT, verify the shop lookup uses `WHERE owner_user_id = user.id` (or `owner_id = user.id`). The shop_id must NOT come from the request body.

  **Good:** `supabase.from("shops").select("id").eq("owner_user_id", user.id)` — shop is derived from authenticated user.

  **Bad → 🔴 CRITICAL:** `const { shop_id } = await req.json(); admin.from("shops").delete().eq("id", shop_id)` — attacker can delete any shop.

- [ ] **Step 1.4 — Check S3: delete-account ownership ambiguity**

  In `delete-account/index.ts`: if a user is BOTH a shop owner AND a staff member of another shop, what happens? The function should:
  1. First check if user owns a shop. If yes → execute owner deletion path (delete shop → cascades).
  2. Else check if user is staff. If yes → execute staff deletion path (null out user_id, then delete auth user).

  **Bad → 🟡 WARNING:** Both paths execute if both queries return data, potentially deleting a shop the user only has staff access to.

- [ ] **Step 1.5 — Check S4: create-widget-token scope**

  In `create-widget-token/index.ts`: the token must be created scoped to the calling user's own shop. Verify the insert uses `shop_id` derived from the authenticated user, not from the request body.

  **Good:** `SELECT id FROM shops WHERE owner_user_id = user.id` → then insert token with that shop_id.
  **Bad → 🔴 CRITICAL:** Token insert uses `shop_id` from request body — attacker can create tokens for any shop.

- [ ] **Step 1.6 — Check S5: public widget functions — rate limiting**

  `widget-book-appointment` and `widget-get-availability` have `verify_jwt = false`. Check if the phone booking rate limit migration (`20260518190000_phone_booking_rate_limit.sql`) is actually enforced inside `widget-book-appointment/index.ts`.

  **Good:** Function queries a rate-limit table keyed by phone number and rejects if limit exceeded.
  **Bad → 🟡 WARNING:** Rate limit migration creates the table but the edge function never queries it — DDoS/spam vector.

- [ ] **Step 1.7 — Check S6: block-walkin and create-manual-block authorization**

  `config.toml` shows `verify_jwt = false` for `block-walkin` — meaning it's a public endpoint. Check `block-walkin/index.ts` for what authorization it performs:

  **Good for `block-walkin` (widget-side):** Accepts a widget token in the request, validates it against the `widget_tokens` table, and only blocks slots for the shop that token belongs to.
  **Bad → 🔴 CRITICAL:** No authorization at all — anyone can create walk-in blocks on any shop.

  For `create-manual-block` (`verify_jwt = true`): after JWT extraction, verify the caller is staff/owner of the shop they're blocking.

- [ ] **Step 1.8 — Check S7: register.tsx slug injection**

  In `apps/mobile/app/(auth)/register.tsx`, find the `toSlug()` function. Verify it:
  1. Converts Turkish chars (ğ→g, ş→s, ı→i, ö→o, ü→u, ç→c)
  2. Lowercases everything
  3. Replaces non-`[a-z0-9]` chars with `-`
  4. Collapses multiple `-` into one
  5. Trims leading/trailing `-`

  **Good pattern:**
  ```typescript
  function toSlug(s: string): string {
    return s
      .toLowerCase()
      .replace(/[ğ]/g, "g").replace(/[ş]/g, "s").replace(/[ı]/g, "i")
      .replace(/[öô]/g, "o").replace(/[üû]/g, "u").replace(/[ç]/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  ```

  **Bad → 🟡 WARNING:** Slug can contain `'`, `"`, `;`, or other SQL/URL-dangerous characters.

- [ ] **Step 1.9 — Check S8: one-shop-per-user server-side guard**

  In `register.tsx`, after `supabase.auth.signUp()`, the client calls `supabase.from("shops").insert(...)`. Check if the `shops` table has a UNIQUE constraint on `owner_user_id` (look in migrations). If yes, a duplicate shop insert returns error code `23505` — verify the client handles it.

  **Good:** Migration has `UNIQUE (owner_user_id)` on shops table AND client handles `23505` error gracefully.
  **Bad → 🟡 WARNING:** No server-side uniqueness guard — user can register twice and create two shops.

- [ ] **Step 1.10 — Check S9: role escalation via direct table insert**

  In `apps/mobile/lib/user-context.tsx`: the `role` is determined by querying `shops` (if shop found with `owner_user_id = user.id` → role = "owner") and `staff` (if found → role = "staff").

  Check the RLS policies on `shops` INSERT in the migrations:

  **Good:** RLS policy on `shops` restricts INSERT to service role only (i.e., edge functions via admin client). A user can't INSERT into shops directly to claim owner role.
  **Bad → 🔴 CRITICAL:** RLS allows authenticated users to INSERT into shops directly with any `owner_user_id`.

- [ ] **Step 1.11 — Check S10: RLS policy completeness audit**

  Check migrations for RLS policies on:
  - `staff` table: SELECT, INSERT, UPDATE, DELETE policies
  - `appointments` table: SELECT, INSERT, UPDATE, DELETE policies
  - `manual_blocks` table (or `blocks`): SELECT, INSERT, UPDATE, DELETE policies
  - `widget_tokens` table: SELECT, INSERT, UPDATE, DELETE policies

  For each table, verify `ROW LEVEL SECURITY` is enabled AND policies exist for all four operations. A table with RLS enabled but no SELECT policy blocks all reads — flag both missing policies and tables without RLS as 🟡 WARNING.

- [ ] **Step 1.12 — Check S11: admin client not in client bundles**

  The file `supabase/functions/_shared/supabase-admin.ts` must ONLY be imported from files inside `supabase/functions/`. Run a grep check:

  ```bash
  grep -r "supabase-admin" apps/mobile apps/web packages
  ```

  **Good:** Zero results — admin client is never imported from client code.
  **Bad → 🔴 CRITICAL:** Any import of supabase-admin from mobile/web code exposes the service role key.

  Also check that `SUPABASE_SERVICE_ROLE_KEY` is not referenced in any mobile/web file:
  ```bash
  grep -r "SERVICE_ROLE" apps/mobile apps/web packages
  ```

- [ ] **Step 1.13 — Check S12: CORS wildcard acceptability**

  In `supabase/functions/_shared/cors.ts`: verify the CORS headers. Wildcard `Access-Control-Allow-Origin: *` is acceptable here because:
  - Widget functions must embed on arbitrary customer websites
  - App/auth functions use JWT for security (not cookies), so origin restriction is not the security mechanism

  This is a 🟢 MINOR documentation note unless the function also sets `Access-Control-Allow-Credentials: true` (wildcard + credentials = CRITICAL browser security violation).

  **Bad → 🔴 CRITICAL:** `Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true`.

- [ ] **Step 1.14 — Check S13: app-cancel-appointment authorization**

  In `app-cancel-appointment/index.ts`: after extracting `user.id` from JWT, verify the cancellation query includes an ownership check.

  **Good:** The update/delete query has a WHERE clause like:
  ```sql
  WHERE id = $appointment_id AND customer_user_id = $user_id
  ```
  Or for staff cancelling: verify caller is staff of the appointment's shop.

  **Bad → 🔴 CRITICAL:** Delete by appointment_id only with no ownership check — any authenticated user can cancel any appointment.

- [ ] **Step 1.15 — Fix all 🔴 CRITICAL findings from Pass 1**

  For each 🔴 CRITICAL finding identified in steps 1.2–1.14:
  1. Edit the file to fix the issue
  2. Commit immediately with message:
  ```
  security: fix [description] in [filename]
  ```

  Example fixes by type:

  **JWT body injection fix:**
  ```typescript
  // BEFORE (bad):
  const { user_id } = await req.json();

  // AFTER (good):
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  // use user.id, never body.user_id
  ```

  **IDOR fix (delete-account):**
  ```typescript
  // BEFORE (bad):
  const { shop_id } = await req.json();
  await admin.from("shops").delete().eq("id", shop_id);

  // AFTER (good):
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user } } = await supabase.auth.getUser(token);
  const { data: shop } = await admin.from("shops").select("id").eq("owner_user_id", user.id).single();
  await admin.from("shops").delete().eq("id", shop.id); // shop.id is derived from JWT, not body
  ```

- [ ] **Step 1.16 — Fix all 🟡 WARNING findings from Pass 1**

  For each 🟡 WARNING finding, fix inline if ≤ 20 lines. If larger, write a concrete fix recipe as a comment block in the finding report.

- [ ] **Step 1.17 — Commit Pass 1 findings report**

  Create `docs/superpowers/reviews/2026-05-19-pass1-security.md` with all findings in the format:
  ```
  🔴 CRITICAL [path:line] — description + fix applied
  🟡 WARNING  [path:line] — description + fix applied (or fix recipe if deferred)
  🟢 MINOR    [path:line] — description
  ```

  Then commit:
  ```bash
  git add docs/superpowers/reviews/2026-05-19-pass1-security.md
  git commit -m "review: Pass 1 security findings report"
  ```

---

## Task 2 — Pass 2: Correctness Review

**Prerequisite:** Pass 1 must have zero unfixed 🔴 CRITICAL findings before starting this task.

**Files to read (read ALL before checking):**

```
packages/shared/src/slot-utils.ts
packages/shared/src/constants.ts
packages/shared/src/types.ts
supabase/functions/widget-book-appointment/index.ts
supabase/functions/app-book-appointment/index.ts
supabase/functions/app-cancel-appointment/index.ts
supabase/functions/block-walkin/index.ts
supabase/functions/create-manual-block/index.ts
supabase/migrations/20260512080000_atomic_scheduling.sql
supabase/migrations/20260518180000_any_staff_advisory_lock.sql
supabase/migrations/20260519100000_schedule_has_conflict_single_scan.sql
supabase/migrations/20260519110000_appointments_no_overlap_strengthen.sql
supabase/migrations/20260519120000_advisory_lock_bigint_key.sql
supabase/migrations/20260518150000_commission_snapshot_integrity.sql
supabase/migrations/20260518170000_past_slot_guard.sql
supabase/migrations/20260520100000_drop_customer_profiles.sql
supabase/migrations/20260520110000_retire_barbers_table.sql
apps/mobile/app/(auth)/register.tsx
apps/mobile/app/(owner)/team.tsx
apps/mobile/app/_layout.tsx
apps/mobile/lib/user-context.tsx
apps/web/src/app/[slug]/BookingFlow.tsx
```

- [ ] **Step 2.1 — Read all 22 files**

  Read every file in the list above before making any findings.

- [ ] **Step 2.2 — Check C1: advisory lock key uniqueness**

  In `20260519120000_advisory_lock_bigint_key.sql` and the scheduling RPC functions: find where `pg_advisory_xact_lock(key)` is called.

  **Good:** Key is unique per staff+date combination to prevent cross-staff lock collisions:
  ```sql
  pg_advisory_xact_lock(
    ('x' || md5(p_staff_id::text || p_slot_date::text))::bit(64)::bigint
  )
  ```

  **Bad → 🔴 CRITICAL:** Key is just `shop_id` or a constant — all staff in the same shop would block each other's bookings (deadlock risk) or two different staff could get the same lock key.

  **Also bad → 🟡 WARNING:** Key is `staff_id` cast to bigint without date component — concurrent same-staff bookings on different dates don't need to serialize, so this is overly conservative but not incorrect.

- [ ] **Step 2.3 — Check C2: slot overlap boundary condition**

  In `20260519100000_schedule_has_conflict_single_scan.sql`, find the `schedule_has_conflict()` function. Check the overlap condition.

  **Good (exclusive end boundary):** Uses `tstzrange` with `[)` bounds OR explicit:
  ```sql
  existing.starts_at < p_ends_at AND existing.ends_at > p_starts_at
  ```
  This correctly allows a 9:00–10:00 appointment followed by a 10:00–11:00 appointment.

  **Bad → 🔴 CRITICAL:**
  ```sql
  existing.starts_at <= p_ends_at AND existing.ends_at >= p_starts_at
  ```
  This would flag two back-to-back appointments as conflicting.

- [ ] **Step 2.4 — Check C3: past slot guard timezone**

  In `20260518170000_past_slot_guard.sql`: find the past-slot check. Verify:
  1. `now()` or `CURRENT_TIMESTAMP` is used (both return `timestamptz` — correct)
  2. The slot_start column is `timestamptz` (not `timestamp without time zone`)
  3. The comparison is `p_slot_start < now()` (reject past slots)

  **Good:**
  ```sql
  IF p_slot_start < now() THEN
    RAISE EXCEPTION 'slot_in_past';
  END IF;
  ```

  **Bad → 🟡 WARNING:** Slot_start stored as `timestamp` (no timezone) compared to `now()` — timezone offset errors possible for non-UTC deployments.

- [ ] **Step 2.5 — Check C4: register.tsx transaction atomicity**

  In `apps/mobile/app/(auth)/register.tsx`, find the registration submit handler. Look for the sequence of DB calls.

  **Good:** Either (a) a single RPC call that does signUp + shop + staff atomically, or (b) explicit cleanup on partial failure:
  ```typescript
  const { data: shop, error: shopErr } = await supabase.from("shops").insert(...).select().single();
  if (shopErr) { /* handle */ return; }
  const { error: staffErr } = await supabase.from("staff").insert({ shop_id: shop.id, ... });
  if (staffErr) {
    // Cleanup orphan shop
    await supabase.from("shops").delete().eq("id", shop.id);
    Alert.alert("Hata", "Kayıt tamamlanamadı, tekrar dene.");
    return;
  }
  ```

  **Bad → 🟡 WARNING:** Staff insert fails silently or only shows error without cleaning up the already-created shop — leaves orphan shop in DB.

- [ ] **Step 2.6 — Check C5: slug uniqueness retry loop**

  In `register.tsx`, find the slug generation and fallback logic. Verify:
  1. On `23505` unique constraint violation, a new slug is generated and re-tried
  2. Retry loop has a maximum (e.g., 3 attempts) to avoid infinite loops

  **Good:**
  ```typescript
  let slug = toSlug(shopName);
  let attempts = 0;
  while (attempts < 3) {
    const { error } = await supabase.from("shops").insert({ slug, ... });
    if (!error) break;
    if (error.code === "23505") {
      slug = toSlug(shopName) + "-" + Math.floor(Math.random() * 9000 + 1000);
      attempts++;
    } else {
      throw error;
    }
  }
  ```

  **Bad → 🟡 WARNING:** Only one fallback attempt — on collision of the fallback slug, insert fails with a raw error.

- [ ] **Step 2.7 — Check C6: commission math consistency**

  In `packages/shared/src/constants.ts` or types: find how `commission_rate_bps` is defined. Verify:
  - DB stores as integer basis points: `1500` = 15%
  - Display in mobile/web: `(rate_bps / 100).toFixed(1) + "%"` → "15.0%"
  - If commission is applied to a price: `price * rate_bps / 10000` (not `/100`)

  **Bad → 🔴 CRITICAL:** Any place that computes `price * rate_bps / 100` (off by 100x — charges 150% instead of 1.5%).

- [ ] **Step 2.8 — Check C7: route guard null-role handling**

  In `apps/mobile/app/_layout.tsx`: find the route guard logic. Look for what happens when `role === null` after a session is established.

  **Good:** A timeout or error fallback after N seconds of null role:
  ```typescript
  // After session confirmed but role still null for >5s → show error
  ```

  **Acceptable:** A loading spinner that resolves once role loads (acceptable if role query is fast and reliable).

  **Bad → 🟡 WARNING:** `role === null && session !== null` → infinite loading spinner with no escape path — user can't log out or retry.

- [ ] **Step 2.9 — Check C8: user-context.tsx network failure handling**

  In `apps/mobile/lib/user-context.tsx`: find the role resolution logic. Both shop query and staff query can fail. Verify there's an error state:

  **Good:**
  ```typescript
  const { data: shop, error: shopErr } = await supabase.from("shops").select(...)...;
  const { data: staff, error: staffErr } = await supabase.from("staff").select(...)...;
  if (shopErr && staffErr) {
    setRoleError(true); // Shows retry button, not infinite spinner
    return;
  }
  ```

  **Bad → 🟡 WARNING:** On network error, `role` stays `null` forever → app unusable offline.

- [ ] **Step 2.10 — Check C9: MIN_CANCEL_NOTICE_MINUTES server-side enforcement**

  In `supabase/functions/app-cancel-appointment/index.ts`: verify the minimum notice check is present server-side.

  **Good:**
  ```typescript
  import { MIN_CANCEL_NOTICE_MINUTES } from "@berber/shared/constants";
  const cutoff = new Date(appointment.starts_at);
  cutoff.setMinutes(cutoff.getMinutes() - MIN_CANCEL_NOTICE_MINUTES);
  if (new Date() > cutoff) {
    return new Response(JSON.stringify({ error: "too_late_to_cancel" }), { status: 422 });
  }
  ```

  **Bad → 🟡 WARNING:** Check only exists in the mobile/web client — server doesn't enforce it, allowing cancellations via direct API calls even within the notice window.

- [ ] **Step 2.11 — Check C10: retire_barbers_table FK cleanup**

  In `20260520110000_retire_barbers_table.sql`: verify the migration explicitly drops or migrates all FK references to the `barbers` table before dropping it.

  **Good:** Migration lists all tables with `REFERENCES barbers` and handles each (drop FK, or migrate data to `staff`).
  **Bad → 🔴 CRITICAL:** `DROP TABLE barbers` without first removing FK constraints — will fail in Postgres (constraint violation) or if using CASCADE, silently deletes referencing data.

- [ ] **Step 2.12 — Check C11: drop_customer_profiles cascade**

  In `20260520100000_drop_customer_profiles.sql`: verify data in tables referencing `customer_profiles` is handled.

  **Good:** Migration uses `DROP TABLE customer_profiles CASCADE` or explicitly deletes/migrates all referencing rows first.
  **Bad → 🟡 WARNING:** Drop without cascade and FK references exist — migration will fail on a DB with existing data.

- [ ] **Step 2.13 — Check C12: BookingFlow "any staff" handling**

  In `apps/web/src/app/[slug]/BookingFlow.tsx`: find where `selectedStaff` is submitted to the booking API.

  **Good:** When `selectedStaff === "any"`, the request body sends `staff_id: null` and the edge function (`widget-book-appointment`) has a code path to select an available staff member automatically.

  **Bad → 🔴 CRITICAL:** `staff_id: "any"` sent as a string — edge function tries to look up a staff with id "any", fails, booking always errors.

  **Bad → 🟡 WARNING:** `staff_id: null` sent but edge function doesn't handle the null case — booking silently fails or throws.

- [ ] **Step 2.14 — Fix all 🔴 CRITICAL findings from Pass 2**

  For each 🔴 CRITICAL: fix, then commit immediately:
  ```bash
  git commit -m "fix: [description] — Pass 2 correctness"
  ```

  Example fix for C12 (any staff):
  ```typescript
  // In BookingFlow.tsx:
  body: JSON.stringify({
    shop_slug: slug,
    staff_id: selectedStaff === "any" ? null : selectedStaff,
    service_id: selectedService,
    starts_at: selectedSlot,
    customer_phone: phone,
  })
  ```

  Example fix for C2 (overlap boundary):
  ```sql
  -- In schedule_has_conflict():
  WHERE staff_id = p_staff_id
    AND starts_at < p_ends_at    -- existing starts before new ends
    AND ends_at > p_starts_at    -- existing ends after new starts
    AND id IS DISTINCT FROM p_exclude_id
  ```

- [ ] **Step 2.15 — Fix all 🟡 WARNING findings from Pass 2**

  Fix inline if ≤ 20 lines. Document fix recipe if larger.

- [ ] **Step 2.16 — Commit Pass 2 findings report**

  Create `docs/superpowers/reviews/2026-05-19-pass2-correctness.md` with all findings.

  ```bash
  git add docs/superpowers/reviews/2026-05-19-pass2-correctness.md
  git commit -m "review: Pass 2 correctness findings report"
  ```

---

## Task 3 — Pass 3: Code Quality Review

**Prerequisite:** Pass 2 must have zero unfixed 🔴 CRITICAL findings before starting this task.

**Files to read (read ALL before checking):**

```
apps/mobile/components/ds/index.ts
apps/mobile/components/ds/Button.tsx
apps/mobile/components/ds/TextField.tsx
apps/mobile/components/ds/Sheet.tsx
apps/mobile/components/ds/Card.tsx
apps/mobile/components/ds/StaffRow.tsx
apps/mobile/components/ds/OverlineHeader.tsx
apps/mobile/components/ds/DayPicker.tsx
apps/mobile/components/ds/AppointmentCard.tsx
apps/mobile/components/ds/TabBar.tsx
apps/web/src/components/ds/index.ts
apps/web/src/components/ds/Button.tsx
apps/web/src/components/ds/BookingModalShell.tsx
apps/web/src/components/ds/StaffPicker.tsx
apps/web/src/components/ds/DateRail.tsx
apps/mobile/app/(owner)/index.tsx
apps/mobile/app/(owner)/agenda.tsx
apps/mobile/app/(owner)/team.tsx
apps/mobile/app/(owner)/settings.tsx
apps/mobile/app/(staff)/index.tsx
apps/mobile/app/(staff)/block.tsx
apps/mobile/app/(staff)/settings.tsx
apps/mobile/app/(auth)/register.tsx
apps/mobile/lib/theme.ts
apps/web/src/app/[slug]/page.tsx
apps/web/src/app/[slug]/BookingFlow.tsx
apps/web/tailwind.config.ts
```

Also run these greps before starting checklist:
```bash
# From repo root C:\Users\Emre\Berber randevu
grep -rn "ThemeTokens" apps/mobile apps/web packages
grep -rn "onChangeText" apps/mobile/app
grep -rn "#1E3A8A\|#DC2626\|#DC2626\|#F59E0B\|#10B981" apps/mobile/app apps/web/src
grep -rn "feather\|Feather" apps/mobile/app --include="*.tsx"
grep -rn " as any" apps/mobile/app apps/web/src
```

- [ ] **Step 3.1 — Read all 26 files + run grep commands above**

  Read every file. Record grep results as evidence for later checklist items.

- [ ] **Step 3.2 — Check Q1: DS Button variant prop contract**

  From reading `apps/mobile/components/ds/Button.tsx`, identify the exact union type for `variant`. Should be:
  ```typescript
  variant: "accent" | "secondary" | "ghost" | "danger"
  ```

  Then scan all screen files (`(owner)/`, `(staff)/`, `(auth)/`) for `<Button variant=`. Verify every value matches the union exactly.

  **Bad → 🟡 WARNING:** Any undocumented variant like `"primary"`, `"outline"`, `"destructive"` — won't throw a runtime error (TypeScript `as any` might mask it) but creates inconsistency.

- [ ] **Step 3.3 — Check Q2: DS TextField onChange convention**

  From `apps/mobile/components/ds/TextField.tsx`, verify the prop is `onChange: (v: string) => void` (not `onChangeText`).

  Scan all usages in screen files for `<TextField`. Verify every usage uses `onChange=` not `onChangeText=`.

  **Bad → 🟡 WARNING:** Screen passes `onChangeText` — prop is silently ignored, TextField becomes uncontrolled.

- [ ] **Step 3.4 — Check Q3: DS Sheet onClose coverage**

  Scan all `<Sheet` usages. Every usage must supply `onClose`. On Android, the back button triggers a close — without `onClose`, sheet gets stuck.

  **Bad → 🟡 WARNING:** Any `<Sheet` without `onClose` prop.

- [ ] **Step 3.5 — Check Q4: unused imports**

  From reading the screen files, flag any import that is never used in the file body:
  - `Feather` from `@expo/vector-icons` (replaced by Lucide)
  - Old token aliases (e.g., `R.input`, `Shadow.lg` if those don't exist in theme.ts)
  - `Switch` from React Native if not used
  - Any icon from `lucide-react-native` that's imported but not rendered

  **Bad → 🟢 MINOR:** Unused import (TypeScript will catch at compile time, but noisy diffs).

- [ ] **Step 3.6 — Check Q5: any casts audit**

  From the grep results for ` as any`, examine each occurrence. Classify:

  - **Necessary `as any`:** Expo Router typed routes limitation (`router.push("/(auth)/register" as any)`) — 🟢 MINOR, add a `// expo-router typed routes` comment
  - **Avoidable `as any`:** Cast on a Supabase response that has a known type, or on a React state update — 🟡 WARNING, provide the proper type
  - **Hiding a bug `as any`:** Cast that suppresses a type error that indicates a real logic problem — 🔴 CRITICAL

- [ ] **Step 3.7 — Check Q6: files over 300 lines**

  From reading the files, note any file over 300 lines. For each:
  1. Does it have a single clear responsibility?
  2. Can it be meaningfully split?

  **Flag → 🟢 MINOR:** Any file >300 lines that mixes responsibilities (e.g., a screen file that also defines a complex data-fetching hook inline). Document the recommended split but do not refactor in this pass.

- [ ] **Step 3.8 — Check Q7: supabase error handling in screens**

  For every `supabase.from(...).select/insert/update/delete` call in screen files, verify the `error` is checked and surfaced to the user:

  **Good:**
  ```typescript
  const { data, error } = await supabase.from("staff").select(...);
  if (error) {
    Alert.alert("Hata", error.message);
    return;
  }
  ```

  **Bad → 🟡 WARNING:**
  ```typescript
  const { data } = await supabase.from("staff").select(...); // error destructured away
  ```
  Or: `const { data, error } = ...; // error never checked`

- [ ] **Step 3.9 — Check Q8: loading states on async actions**

  For every button that triggers an async action (save, delete, submit), verify:
  1. The button is disabled while the action is in flight (`disabled={loading}`)
  2. A visual indicator (spinner, text change) shows something is happening

  **Bad → 🟡 WARNING:** Button stays enabled during async operation — double-submit possible.

- [ ] **Step 3.10 — Check Q9: register.tsx ActivityIndicator**

  Specifically in `apps/mobile/app/(auth)/register.tsx`: verify the submit button shows an `ActivityIndicator` (or loading text) between the "Hesabı Oluştur" press and the navigation to the next screen.

  **Good:**
  ```tsx
  <TouchableOpacity disabled={loading} ...>
    {loading ? <ActivityIndicator color="#fff" /> : <Text>Hesabı Oluştur</Text>}
  </TouchableOpacity>
  ```

  **Bad → 🟡 WARNING:** No loading state — user sees nothing happen for 1–3 seconds and may press again.

- [ ] **Step 3.11 — Check Q10: ThemeTokens type references**

  From the grep result for `ThemeTokens`: after P5 DS cleanup, this type should be gone. Any remaining reference is dead code.

  **Bad → 🟢 MINOR:** Any `ThemeTokens` reference — delete the import/type.

- [ ] **Step 3.12 — Check Q11: tailwind.config.ts CSS variable references**

  In `apps/web/tailwind.config.ts`: check each CSS variable reference (e.g., `var(--color-brand-600)`). Then check `apps/web/src/app/globals.css` (or the equivalent CSS file) to verify the variable actually exists.

  **Bad → 🟡 WARNING:** A Tailwind config references a CSS variable that no longer exists in globals.css — those Tailwind classes silently produce no styles.

- [ ] **Step 3.13 — Check Q12: hardcoded hex colors in migrated files**

  From the grep result for hardcoded hex colors. Each occurrence in a screen or component file should be replaced with the appropriate token:

  | Hex | Replace with |
  |-----|-------------|
  | `#1E3A8A` | `T.brand600` |
  | `#DC2626` | `T.coral600` (NOT `T.red` — that alias was removed in P5) |
  | `"rgba(220,38,38,..."` | `T.coral600` with opacity via StyleSheet |
  | `"#fff"` | Acceptable for `color` on dark backgrounds (white text), but flag if used as background color |
  | `"#000"` | Flag if used as text color — should be `T.fg1` |

  **Bad → 🟡 WARNING:** Any hardcoded hex in a screen file that has a corresponding token.

  Note: `login.tsx` BrandMark component has intentional `"rgba(220,38,38,0.85)"` for the stripe effect — this is a 🟢 MINOR (visual detail that benefits from being literal) unless a `T.coral600` with opacity helper exists.

- [ ] **Step 3.14 — Fix all 🔴 CRITICAL findings from Pass 3**

  Fix and commit immediately per finding.

- [ ] **Step 3.15 — Fix all 🟡 WARNING findings from Pass 3**

  Fix inline if ≤ 20 lines. Document fix recipe if larger.

- [ ] **Step 3.16 — Commit Pass 3 findings report**

  Create `docs/superpowers/reviews/2026-05-19-pass3-quality.md` with all findings.

  ```bash
  git add docs/superpowers/reviews/2026-05-19-pass3-quality.md
  git commit -m "review: Pass 3 code quality findings report"
  ```

---

## Final Step — Summary Commit

After all three passes are complete and all reports are written:

- [ ] **Step F1 — Verify TypeScript clean**

  ```bash
  cd "C:\Users\Emre\Berber randevu"
  pnpm --filter @berber/mobile tsc --noEmit
  pnpm --filter @berber/web tsc --noEmit
  ```

  Fix any TypeScript errors introduced by the review fixes.

- [ ] **Step F2 — Final commit**

  ```bash
  git add -A
  git commit -m "review: comprehensive 3-pass security/correctness/quality review complete"
  ```
