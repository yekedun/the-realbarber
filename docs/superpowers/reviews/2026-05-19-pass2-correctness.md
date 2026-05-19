# Pass 2 — Correctness Review Findings

**Date:** 2026-05-19
**Branch:** scheduling-hardening

## Summary
- 🔴 CRITICAL: 0
- 🟡 WARNING: 4 (4 fixed, 0 deferred)
- 🟢 MINOR: 2 (documented only)

## Findings

### C1 — Advisory lock key uniqueness
✅ PASS. `20260519120000_advisory_lock_bigint_key.sql` keys all
`pg_advisory_xact_lock` calls on `('x' || md5(staff_id::text))::bit(64)::bigint`
— per-staff, 64-bit, low collision. Different staff in the same shop book in
parallel; same staff serialize as intended.

### C2 — Slot overlap boundary
✅ PASS. `schedule_has_conflict()` in
`20260519100000_schedule_has_conflict_single_scan.sql` uses
`tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')`
— half-open intervals throughout, so a 9:00–10:00 appointment does not
conflict with a 10:00–11:00 follow-up. The `appointments_no_overlap` EXCLUDE
constraint (`20260519110000`) uses the same `'[)'` bound, keeping DB and RPC
in lock-step.

### C3 — Past slot guard timezone
✅ PASS. `appointments.starts_at` is `TIMESTAMPTZ` (initial schema).
`20260518170000_past_slot_guard.sql` compares it to `now()` with a 5-minute
grace — both `timestamptz`, no naive-timestamp mismatch.

### C4 — register.tsx transaction atomicity
🟡 WARNING [apps/mobile/app/(auth)/register.tsx:111-135] — **FIXED**.
Original flow created the `shops` row, then called `createOwnerStaff`; if the
staff insert failed (network blip, RLS edge case, validation), the orphan shop
stayed in the DB forever. Patched: wrap `createOwnerStaff` in a try/catch
that deletes the just-inserted shop on failure before rethrowing. Commit
`4542376`.

### C5 — Slug uniqueness retry loop
🟡 WARNING [apps/mobile/app/(auth)/register.tsx:106-131] — **FIXED**.
Original code attempted the base slug once and, on `23505`, retried exactly
once with a random suffix. Two concurrent registrations that both hit the
random fallback could still collide. Replaced with a 3-attempt loop: base
slug → random-suffix → random-suffix, only retrying on `23505`. Commit
`4542376`.

### C6 — Commission math consistency
✅ PASS. SQL paths use `ROUND((gross::numeric * rate_bps::numeric) / 10000)`
(`20260518150000_commission_snapshot_integrity.sql:397`,
`20260517090000_optional_commission_tracking.sql:178`). UI display uses
`rate_bps / 100` to render as a percent (`apps/mobile/app/(owner)/team.tsx:150,281`).
Bps→percent is `/100`; bps applied to a price is `/10000` — both correct.

### C7 — Route guard null-role handling
🟡 WARNING [apps/mobile/app/_layout.tsx:17-37] — **FIXED**.
Previously, when `session !== null && role === null && !loading`, no branch
ran: the user was left on whatever screen they happened to be on, with no
escape if it was the loading spinner. Now `RouterGuard` checks the new
`error` flag from `useUserRole`; on a real profile-load failure it calls
`supabase.auth.signOut()` and redirects to `/(auth)/login`. The "auth user
exists but no shop/staff row yet" case is preserved (no error → no forced
sign-out). Commit `b9f3b10`.

### C8 — user-context.tsx network failure
🟡 WARNING [apps/mobile/lib/user-context.tsx:38-82] — **FIXED**.
Both Supabase calls used `.single()` with destructured `data` only — any
network/PostgREST error was silently swallowed and `role` stuck at `null`
forever, leaving the app unusable offline. Now each query inspects
`response.error.code`, treating only `PGRST116` (no rows) as a non-error.
A real error sets the new `error` field on the context, which RouterGuard
acts on (see C7). Commit `b9f3b10`.

### C9 — MIN_CANCEL_NOTICE_MINUTES server-side enforcement
✅ PASS. `supabase/functions/app-cancel-appointment/index.ts:45-51`
enforces the 120-minute window against `appointment.starts_at` before
calling the RPC. Direct edge function calls cannot bypass it.

### C10 — retire_barbers_table migration FK cleanup
🟢 MINOR [supabase/migrations/20260520110000_retire_barbers_table.sql:91].
`DROP TABLE IF EXISTS public.barbers;` is executed without `CASCADE`.
This is safe in the current codebase because
`20260512080000_atomic_scheduling.sql` already renamed `barber_id → staff_id`
on `block_slots` and migration `20260508_multi_seat_and_admin.sql` moved
`appointments.barber_id` references to `staff_id`. No live FK constraint
points at `public.barbers` by this migration. Documented for awareness — a
future env that somehow restored a `barber_id` FK would see this migration
fail loudly (acceptable behavior — fail-fast is preferred over silent
CASCADE data loss).

### C11 — drop_customer_profiles cascade
🟢 MINOR [supabase/migrations/20260520100000_drop_customer_profiles.sql:4].
`DROP TABLE IF EXISTS public.customer_profiles;` without CASCADE. Migration
comment confirms no edge function or app code referenced the table, and
grep across the repo confirms no remaining FK references. Same fail-fast
rationale as C10: prefer a loud migration error over a silent CASCADE
delete in any unexpected environment.

### C12 — BookingFlow "any staff" handling
✅ PASS. `apps/web/src/app/[slug]/BookingFlow.tsx:294` maps the
sentinel string `"any"` to `null` before passing `staffId` into
`BookingModal`. `BookingModal.tsx:76` forwards that `null` as `staff_id` in
the request body. `widget-book-appointment/index.ts:108` passes
`staff_id ?? null` to the RPC, and `create_appointment_atomic` invokes
`assign_any_staff(...)` whenever `p_staff_id IS NULL`. No "any" string ever
reaches the database.
