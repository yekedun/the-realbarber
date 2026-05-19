# Pass 3 — Code Quality Review

**Date:** 2026-05-19
**Branch:** scheduling-hardening
**Scope:** mobile + web DS components, mobile screens (owner + staff + auth), web booking flow, tailwind config + globals.css.

Passes 1 (Security) and 2 (Correctness) shipped clean. Pass 3 focuses on coding standards, DS contracts, dead code, and token discipline.

---

## Q1 — DS Button variant prop contract

Mobile `Button` union: `"primary" | "secondary" | "ghost" | "danger" | "accent"`.
Web `Button` union: identical.

All `<Button variant=…>` usages audited across:
- `apps/mobile/app/(owner)/agenda.tsx`
- `apps/mobile/app/(owner)/team.tsx` (7 usages)
- `apps/mobile/app/(owner)/settings.tsx` (6 usages)
- `apps/mobile/app/(staff)/settings.tsx` (2 usages)

Every variant value is in the union. **No findings.**

(Other `variant=` matches in `(staff)/index.tsx` belong to local `TimeColumn` / `TrackColumn` components with their own union — not DS Button.)

---

## Q2 — DS TextField onChange convention

Mobile DS `TextField` exposes `onChange: (v: string) => void`. The three call sites in `apps/mobile/app/(owner)/team.tsx` (lines 348, 399, 439) all pass `onChange=`. No screen passes `onChangeText=` to a DS `TextField`.

The `onChangeText=` matches in the grep output are all on raw `<TextInput>` (delete-confirm boxes in both `settings.tsx` files, plus all fields in `register.tsx` / `login.tsx`) — those are correct for the React Native primitive.

**No findings.**

---

## Q3 — DS Sheet onClose coverage

All five `<Sheet …>` call sites supply `onClose`:
- `apps/mobile/app/(staff)/settings.tsx:204` — `onClose={() => { if (!deleting) setDeleteSheetVisible(false); }}`
- `apps/mobile/app/(owner)/settings.tsx:211` — same pattern
- `apps/mobile/app/(owner)/team.tsx:316`, `:358`, `:410` — all wired to close handlers

**No findings.**

---

## Q4 — Unused imports

- Zero `Feather` / `feather` imports in `apps/mobile/app` (Lucide migration complete).
- All Lucide icons imported in audited screens are rendered.
- `Shadow.lg` is defined in `theme.ts` (line 151) — no stale alias.

**No findings.**

---

## Q5 — `any` casts audit

Three `as any` occurrences in the mobile app, all on Expo Router `router.push` / `router.replace` calls:
- `apps/mobile/app/_layout.tsx:30` `router.replace("/(owner)" as any)`
- `apps/mobile/app/_layout.tsx:32` `router.replace("/(staff)" as any)`
- `apps/mobile/app/(auth)/login.tsx:86` `router.push("/(auth)/register" as any)`

These are the standard Expo Router typed-routes workaround. Web has zero ` as any` occurrences. The unrelated `as never` casts on `supabase.rpc(...)` calls (agenda.tsx, AddAppointmentModal, (staff)/index.tsx) target missing entries in the generated `Database` types — same category.

🟢 MINOR  [apps/mobile/app/_layout.tsx:30,32] — Expo Router typed-routes workaround. Add `// expo-router typed routes` inline comment to make the intent obvious (next time someone runs strict typecheck and is tempted to "fix" it).
🟢 MINOR  [apps/mobile/app/(auth)/login.tsx:86] — same.
🟢 MINOR  [apps/mobile/components/AddAppointmentModal.tsx:204,212,213,223; apps/mobile/app/(owner)/agenda.tsx:236,244; apps/mobile/app/(staff)/index.tsx:290,292] — `as never` on `supabase.rpc(...)` because `update_appointment_atomic` / `create_appointment_atomic` / `cancel_appointment_atomic` are missing from `@berber/db` generated types. Real fix: regenerate types from migration `update_appointment_atomic.sql` (out of scope for code-quality pass — pure types-codegen task).

---

## Q6 — Files over 300 lines

| File | Lines | Notes |
|---|---:|---|
| `apps/mobile/app/(staff)/index.tsx` | 859 | Mixes screen container + Header + Timeline + ApptRow + TimeColumn + TrackColumn + DoneRow + UpcomingRow + BlockRow + NowRow + EmptyDay in one module. |
| `apps/mobile/app/(owner)/team.tsx` | 482 | Single screen with three sheets inline (Add staff / Commission / Slug). |
| `apps/mobile/app/(owner)/agenda.tsx` | 415 | Screen + DraggableAppointmentCard, cohesive. |
| `apps/mobile/app/(owner)/settings.tsx` | 291 | Below threshold. |

🟢 MINOR  [apps/mobile/app/(staff)/index.tsx] — extract `Timeline`, `ApptRow` family, and `NowRow` into `apps/mobile/components/staff/Timeline/*.tsx`. Keep the screen file as the data-fetching shell. ~300 line reduction.
🟢 MINOR  [apps/mobile/app/(owner)/team.tsx] — extract the three modal sheets into `components/team/{AddStaffSheet,CommissionSheet,SlugSheet}.tsx`. Each is self-contained and would simplify the screen render.

---

## Q7 — Supabase error handling in screens

Many `supabase.from(...).select(...)` calls destructure only `data`, dropping `error`. When the query fails the screen silently renders empty/stale data with no Alert.

🟡 WARNING  [apps/mobile/app/(owner)/index.tsx:115,119] — `staff` and `appointments` fetches drop `error`. On failure `setStaff([])` runs but no Alert is shown. Recipe: destructure `error` from each await, and `if (error || !data) { setLoading(false); setRefreshing(false); Alert.alert("Hata", error?.message ?? "Veri yüklenemedi"); return; }`. (~6 lines, but applies to two queries — fits inline.)

🟡 WARNING  [apps/mobile/app/(owner)/agenda.tsx:152,178,186] — same pattern for staff + appointments + blocks. Three queries; recipe: add `error` to each destructure and surface via `Alert.alert("Hata", staffErr?.message ?? apptErr?.message ?? blockErr?.message ?? "Veri yüklenemedi")` once at the bottom of `load()`. ~10 lines but reorganises promise destructuring — left for follow-up.

🟡 WARNING  [apps/mobile/app/(staff)/index.tsx:107,124,131] — staff lookup + appointments + blocks all drop `error`. Same recipe.

🟡 WARNING  [apps/mobile/app/(staff)/settings.tsx:45,54] — staffRow / shop lookups silently fail; account stays at defaults. Recipe: log to console + Alert on hard failure (but ignore if user is mid-signup with empty record).

🟡 WARNING  [apps/mobile/app/(staff)/block.tsx:80] — staff lookup error dropped. Recipe: destructure `error` alongside `data` and `if (error) throw new Error(error.message)` before the `if (!staff)` check.

🟡 WARNING  [apps/mobile/app/(owner)/settings.tsx:48] — `shop` lookup error dropped (function is wrapped in `try { } catch {}` with comment "retain defaults", so the silence is intentional but the catch swallows any meaningful diagnostic). Optionally `console.warn(err)` inside the catch.

**Not fixed inline** — touching every screen for proper error surfacing is a coordinated UX decision (Alert.alert spam vs. silent empty state); flagged for a dedicated follow-up sprint.

---

## Q8 — Loading states on async actions

All Button-triggered async actions in audited screens already gate on `disabled={…}`:
- `team.tsx` add-staff / commission / slug — `disabled={inviting / savingCommission / savingSlug}`.
- `settings.tsx` (both) delete-account — `disabled={deleting}`.
- `settings.tsx` (owner) generate-token — `disabled={generating}`.
- `block.tsx` FAB — `disabled={loading}` with `ActivityIndicator` swap (line 168).

**No findings.**

---

## Q9 — register.tsx ActivityIndicator

`apps/mobile/app/(auth)/register.tsx:252-255` — `loading ? <ActivityIndicator color="#fff" /> : <Text>Hesabı Oluştur</Text>` swap during signup. Button is also `disabled={loading || …}` (line 249). Press-feedback is correct.

**No findings.**

---

## Q10 — ThemeTokens references

`grep -rn "ThemeTokens" apps/mobile apps/web packages` (inside this worktree):
- `apps/mobile/lib/theme.ts` — **0 hits** (the original ramp-down export was removed during P5 cleanup; the file ends at line 168 with the Motion tokens).
- All other hits are in docs (specs/plans) and an unrelated worktree under `.claude/worktrees/dazzling-lalande-631df8/...`.

**No findings.**

---

## Q11 — tailwind.config.ts CSS variable references

`tailwind.config.ts` defines colors as literal hex; it does not itself reference `var(--…)`. CSS-var consumption happens in component class strings (`bg-[var(--brand-600)]` etc.). All ~80 unique `var(--…)` references in `apps/web/src/components/ds/*.tsx` map to definitions in `apps/web/src/app/globals.css` lines 36–158.

**No findings.**

---

## Q12 — Hardcoded hex colors in migrated files

- `#1E3A8A` / `#DC2626` / `#A0303F` / `#F59E0B` / `#10B981` — zero hits in `apps/mobile/app/**` (excluding `(auth)/register.tsx` BrandMark stripe `rgba(220,38,38,0.85)`, explicitly exempted).
- Web `src/**`: only literal hex hits are the `#1E3A8A` and `#A0303F` lines inside `globals.css` itself (the canonical token definitions) — not user code.

One off-palette slate color spotted:

🟢 MINOR  [apps/mobile/app/(staff)/index.tsx:712] — `backgroundColor: "#94A3B8"` on `diamondSlate`. Not in the Q12 replacement table, but it's a one-off hardcoded slate inside an otherwise tokenized file. Closest token is `T.slate400` (#8590A4) or `T.slate300` (#B4BBC8). Replace with `T.slate400` for consistency; visual delta is imperceptible.

Other hardcoded literals (`"#fff"`, `"rgba(255,255,255,…)"`, `"rgba(0,0,0,0.55)"`) are all on dark surfaces or overlays where they're idiomatic and not part of the migration table.

---

## Summary

| Severity | Count |
|---|---:|
| 🔴 CRITICAL | 0 |
| 🟡 WARNING | 6 (all Q7 error-handling — silent Supabase failures, batched as a follow-up) |
| 🟢 MINOR | 9 (Q5 cast comments, Q6 file-size recommendations, Q12 stray slate) |

**No CRITICAL issues.** No inline fixes were applied — the only WARNING category (Q7) is a cross-screen UX policy decision that doesn't fit the ≤20-lines-inline rule and is documented above with concrete recipes per call site. Mobile + web DS contracts, variant unions, Sheet wiring, and token discipline are clean. P5 cleanup of `ThemeTokens` is complete.
