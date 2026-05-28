# Missing Tests Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a test runner to the monorepo and fill the four highest-risk gaps: slot availability algorithm, booking flow state machine bug, phone validation duplication, and inactive-shop booking guard.

**Architecture:** Vitest is added to `packages/shared` and `apps/web` as isolated packages (no shared config); each package runs `vitest run` independently. The slot-utils pure functions are tested without a DB. The `booking-flow-state` bug (stale selectedSlot after success) is fixed before its test is updated. `isValidPhone` is moved to `packages/shared` so both edge functions import one canonical copy. The `create_appointment_atomic` RPC gets a `status = 'active'` guard via a new migration.

**Tech Stack:** Vitest 1.x, pnpm workspaces, TypeScript, PostgreSQL (migration only for Task 6)

---

## Corrections to the original findings

Before starting, note these two inaccuracies in the audit that produced this plan:

1. **Finding #2 last bullet** said "`getFullYear/.getMonth/.getDate` are UTC methods" — they are **local timezone** methods. In Deno serverless the system TZ is UTC so behaviour is identical; the DST concern for Istanbul is moot since Turkey switched to permanent UTC+3 in 2016. DST tests use `Europe/London` instead.

2. **Finding #5 `905551234567` case** — this string **passes** the fallback regex `/^[0-9]{10,15}$/` (12 digits). The claim that it silently fails is wrong.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/shared/package.json` | Modify | Add Vitest dev-dep + `test` script |
| `packages/shared/vitest.config.ts` | Create | Vitest config for shared package |
| `packages/shared/src/slot-utils.ts` | Modify | Export `localTimeToUTC` |
| `packages/shared/src/__tests__/slot-utils.test.ts` | Create | 14 test cases for `computeAvailableSlots` + `localTimeToUTC` |
| `apps/web/package.json` | Modify | Add Vitest dev-dep + `test` script |
| `apps/web/vitest.config.ts` | Create | Vitest config with jsdom environment |
| `apps/web/src/app/[slug]/booking-flow-state.ts` | Modify | Fix: clear `selectedSlot` after success |
| `apps/web/src/app/[slug]/booking-flow-state.test.ts` | Modify | Fix existing wrong assertion + add 2 new cases |
| `packages/shared/src/phone-utils.ts` | Create | Canonical `isValidPhone` + `normalizePhone` |
| `packages/shared/src/__tests__/phone-utils.test.ts` | Create | 10 test cases |
| `packages/shared/src/index.ts` | Modify | Re-export from `phone-utils` |
| `supabase/functions/widget-book-appointment/index.ts` | Modify | Import `isValidPhone` from shared |
| `supabase/functions/app-book-appointment/index.ts` | Modify | Import `isValidPhone` from shared |
| `supabase/migrations/20260528300000_shop_status_booking_guard.sql` | Create | Add `status = 'active'` check to `create_appointment_atomic` |

---

## Task 1: Add Vitest to `packages/shared`

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/vitest.config.ts`

- [ ] **Step 1: Add Vitest as dev dependency**

```bash
cd "packages/shared" && pnpm add -D vitest@1
```

- [ ] **Step 2: Add test script to `packages/shared/package.json`**

The full `scripts` block after the change:

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
}
```

- [ ] **Step 3: Create `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Verify Vitest is found**

```bash
cd "packages/shared" && pnpm test
```

Expected output: `No test files found` (no tests yet, but vitest exits 0 when `passWithNoTests` is default). If it exits non-zero, add `passWithNoTests: true` to the config's `test` object.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/package.json packages/shared/vitest.config.ts
git commit -m "chore(shared): add Vitest test runner"
```

---

## Task 2: Export `localTimeToUTC` from slot-utils

**Files:**
- Modify: `packages/shared/src/slot-utils.ts`

Currently `localTimeToUTC` is an unexported module-level function. It needs to be exported to be tested directly.

- [ ] **Step 1: Change the function declaration to export**

In `packages/shared/src/slot-utils.ts`, line 116, change:

```ts
function localTimeToUTC(date: Date, time: string, timezone: string): Date {
```

to:

```ts
export function localTimeToUTC(date: Date, time: string, timezone: string): Date {
```

- [ ] **Step 2: Verify typecheck still passes**

```bash
cd "packages/shared" && pnpm typecheck
```

Expected: `exit 0`, no output.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/slot-utils.ts
git commit -m "refactor(shared): export localTimeToUTC for testing"
```

---

## Task 3: Write slot-utils tests

**Files:**
- Create: `packages/shared/src/__tests__/slot-utils.test.ts`

Background on the functions:
- `computeAvailableSlots` loops from shop open time to close time in steps of `max(SLOT_GRANULARITY_MIN, durationMin)`. A slot is included only if `cursorMs >= minAllowedMs && cursorMs <= maxAllowedMs`. A slot is `available: false` if any occupied range (after applying buffer) overlaps `[cursorMs, slotEndMs)`.
- `localTimeToUTC(date, "HH:mm", timezone)` converts a local wall-clock time on a given calendar date to a UTC `Date` object. The strategy: construct a naïve UTC timestamp, ask `Intl.DateTimeFormat` what local time that UTC instant represents in the target timezone, compute the offset, then subtract the offset.
- `SLOT_GRANULARITY_MIN = 15`, `MIN_BOOKING_NOTICE_MINUTES = 60`, `MAX_BOOKING_DAYS = 30`.

- [ ] **Step 1: Create the test file**

```ts
// packages/shared/src/__tests__/slot-utils.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { computeAvailableSlots, localTimeToUTC } from "../slot-utils.ts";
import type { WorkingHours, OccupiedRange } from "../types.ts";

// A Monday in the future (within booking window)
// 2026-06-01 is a Monday
const MONDAY = new Date("2026-06-01T00:00:00.000Z");
const TZ = "Europe/Istanbul"; // UTC+3, no DST

// Working hours helper: Mon–Sat 09:00–19:00, Sun closed
function makeWorkingHours(overrides: Partial<WorkingHours> = {}): WorkingHours {
  return {
    mon: { open: "09:00", close: "19:00", enabled: true },
    tue: { open: "09:00", close: "19:00", enabled: true },
    wed: { open: "09:00", close: "19:00", enabled: true },
    thu: { open: "09:00", close: "19:00", enabled: true },
    fri: { open: "09:00", close: "19:00", enabled: true },
    sat: { open: "09:00", close: "17:00", enabled: true },
    sun: { open: null, close: null, enabled: false },
    ...overrides,
  };
}

// ── computeAvailableSlots ──────────────────────────────────────────────────

describe("computeAvailableSlots", () => {
  // Freeze time so MIN/MAX booking window is predictable.
  // Set now = 2026-05-31T00:00:00Z so MONDAY (2026-06-01) is 24h ahead
  // and well within the 30-day window but outside the 60-min notice window.
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T00:00:00.000Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns [] when day is disabled (Sunday)", () => {
    const sunday = new Date("2026-06-07T00:00:00.000Z"); // a Sunday
    const slots = computeAvailableSlots({
      date: sunday,
      durationMin: 30,
      workingHours: makeWorkingHours(),
      occupied: [],
      timezone: TZ,
    });
    expect(slots).toEqual([]);
  });

  it("returns [] when closeTs <= openTs (misconfigured midnight-crossing hours)", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      workingHours: makeWorkingHours({
        mon: { open: "20:00", close: "08:00", enabled: true },
      }),
      occupied: [],
      timezone: TZ,
    });
    expect(slots).toEqual([]);
  });

  it("last slot where cursorMs + durationMs === closeMs is included", () => {
    // 09:00–09:30 with durationMin=30 → one slot: 09:00
    // close is at 09:30 Istanbul = 06:30 UTC
    // cursor starts at 09:00 Istanbul = 06:00 UTC
    // 06:00 + 30min = 06:30 <= 06:30 → included (while condition <=)
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      workingHours: makeWorkingHours({
        mon: { open: "09:00", close: "09:30", enabled: true },
      }),
      occupied: [],
      timezone: TZ,
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].available).toBe(true);
  });

  it("slot abutting an occupied range is available (exclusive boundary check)", () => {
    // Slot 09:00–09:30, occupied 09:30–10:00
    // slotEndMs (09:30) is NOT > occupied.start (09:30) → no overlap → available
    const openIstanbul09 = localTimeToUTC(MONDAY, "09:00", TZ);
    const openIstanbul0930 = localTimeToUTC(MONDAY, "09:30", TZ);
    const openIstanbul10 = localTimeToUTC(MONDAY, "10:00", TZ);

    const occupied: OccupiedRange[] = [
      {
        starts_at: openIstanbul0930.toISOString(),
        ends_at: openIstanbul10.toISOString(),
      },
    ];
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      workingHours: makeWorkingHours({
        mon: { open: "09:00", close: "10:00", enabled: true },
      }),
      occupied,
      timezone: TZ,
    });
    // Two slots: 09:00 (available) and 09:30 (unavailable, overlaps occupied)
    expect(slots[0].startsAt.getTime()).toBe(openIstanbul09.getTime());
    expect(slots[0].available).toBe(true);
    expect(slots[1].available).toBe(false);
  });

  it("buffer merges two close appointments and blocks the gap slot", () => {
    // Appointments at 09:00–09:30 and 09:45–10:15, bufferMin=15
    // Buffered ranges: [08:45–09:45] and [09:30–10:30]
    // Slot 09:00–09:30 overlaps [08:45–09:45] → unavailable
    // Slot 09:30–10:00 overlaps [09:30–10:30] → unavailable
    const a09 = localTimeToUTC(MONDAY, "09:00", TZ);
    const a0930 = localTimeToUTC(MONDAY, "09:30", TZ);
    const a0945 = localTimeToUTC(MONDAY, "09:45", TZ);
    const a1015 = localTimeToUTC(MONDAY, "10:15", TZ);

    const occupied: OccupiedRange[] = [
      { starts_at: a09.toISOString(), ends_at: a0930.toISOString() },
      { starts_at: a0945.toISOString(), ends_at: a1015.toISOString() },
    ];
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      workingHours: makeWorkingHours({
        mon: { open: "09:00", close: "11:00", enabled: true },
      }),
      occupied,
      timezone: TZ,
      bufferMin: 15,
    });
    const unavailable = slots.filter((s) => !s.available);
    expect(unavailable.length).toBeGreaterThanOrEqual(2);
    // The gap slot at 09:30 must be unavailable
    const gapSlot = slots.find(
      (s) => s.startsAt.getTime() === localTimeToUTC(MONDAY, "09:30", TZ).getTime()
    );
    expect(gapSlot?.available).toBe(false);
  });

  it("step equals durationMin when durationMin > SLOT_GRANULARITY_MIN (15)", () => {
    // durationMin=45 → stepMs=45min → slots at :00, :45, :30 (if window allows)
    // 09:00–10:30 with 45min duration → slots: 09:00 and 09:45 only
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 45,
      workingHours: makeWorkingHours({
        mon: { open: "09:00", close: "10:30", enabled: true },
      }),
      occupied: [],
      timezone: TZ,
    });
    expect(slots).toHaveLength(2);
    const startTimes = slots.map((s) =>
      s.startsAt.toLocaleTimeString("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })
    );
    expect(startTimes).toEqual(["09:00", "09:45"]);
  });

  it("returns slots with available=false for all when all are occupied", () => {
    // Entire window blocked
    const open = localTimeToUTC(MONDAY, "09:00", TZ);
    const close = localTimeToUTC(MONDAY, "19:00", TZ);
    const occupied: OccupiedRange[] = [
      { starts_at: open.toISOString(), ends_at: close.toISOString() },
    ];
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      workingHours: makeWorkingHours(),
      occupied,
      timezone: TZ,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => !s.available)).toBe(true);
  });

  it("returns [] when queried date is beyond MAX_BOOKING_DAYS (30 days)", () => {
    // now = 2026-05-31, date = 2026-07-01 (31 days ahead)
    const farFuture = new Date("2026-07-01T00:00:00.000Z");
    const slots = computeAvailableSlots({
      date: farFuture,
      durationMin: 30,
      workingHours: makeWorkingHours({
        wed: { open: "09:00", close: "19:00", enabled: true },
      }),
      occupied: [],
      timezone: TZ,
    });
    expect(slots).toHaveLength(0);
  });
});

// ── localTimeToUTC ────────────────────────────────────────────────────────

describe("localTimeToUTC", () => {
  it("converts Istanbul time (UTC+3) correctly", () => {
    // 09:00 Istanbul = 06:00 UTC
    const result = localTimeToUTC(MONDAY, "09:00", "Europe/Istanbul");
    expect(result.getUTCHours()).toBe(6);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it("handles non-hour offset (Asia/Kolkata UTC+5:30)", () => {
    // 09:00 Kolkata = 03:30 UTC
    const result = localTimeToUTC(MONDAY, "09:00", "Asia/Kolkata");
    expect(result.getUTCHours()).toBe(3);
    expect(result.getUTCMinutes()).toBe(30);
  });

  it("handles midnight (00:00) correctly", () => {
    // 00:00 Istanbul = 21:00 UTC previous day
    const result = localTimeToUTC(MONDAY, "00:00", "Europe/Istanbul");
    // MONDAY is 2026-06-01T00:00:00Z, midnight Istanbul = 2026-05-31T21:00:00Z
    expect(result.toISOString()).toBe("2026-05-31T21:00:00.000Z");
  });

  it("handles BST (Europe/London in summer, UTC+1)", () => {
    // In summer (June), London is BST = UTC+1
    // 09:00 London = 08:00 UTC
    const result = localTimeToUTC(MONDAY, "09:00", "Europe/London");
    expect(result.getUTCHours()).toBe(8);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it("handles UK spring-forward DST transition day without crashing", () => {
    // 2026-03-29 at 01:00 UK clocks spring forward to 02:00
    // 02:30 doesn't exist — Intl normalises it to 03:30
    const dstDay = new Date("2026-03-29T00:00:00.000Z");
    expect(() => localTimeToUTC(dstDay, "02:30", "Europe/London")).not.toThrow();
    const result = localTimeToUTC(dstDay, "02:30", "Europe/London");
    // Result should be a valid Date object
    expect(result instanceof Date).toBe(true);
    expect(isNaN(result.getTime())).toBe(false);
  });

  it("is deterministic when called twice with same inputs", () => {
    const a = localTimeToUTC(MONDAY, "14:30", "Europe/Istanbul");
    const b = localTimeToUTC(MONDAY, "14:30", "Europe/Istanbul");
    expect(a.getTime()).toBe(b.getTime());
  });
});
```

- [ ] **Step 2: Run the tests and confirm they pass**

```bash
cd "packages/shared" && pnpm test
```

Expected: all tests pass, no errors. If any fail, read the error carefully — most likely cause is the fake timer interacting with `Date.now()` inside `computeAvailableSlots`. If `MIN_BOOKING_NOTICE_MINUTES` check filters out all slots, adjust `vi.setSystemTime` to be further in the past.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/__tests__/slot-utils.test.ts
git commit -m "test(shared): add slot-utils tests for computeAvailableSlots and localTimeToUTC"
```

---

## Task 4: Add Vitest to `apps/web`

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Add Vitest as dev dependency**

```bash
cd "apps/web" && pnpm add -D vitest@1 @vitest/globals jsdom
```

- [ ] **Step 2: Add test script to `apps/web/package.json`**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
}
```

- [ ] **Step 3: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts
git commit -m "chore(web): add Vitest test runner"
```

---

## Task 5: Fix `booking-flow-state` bug and update tests

**Files:**
- Modify: `apps/web/src/app/[slug]/booking-flow-state.ts`
- Modify: `apps/web/src/app/[slug]/booking-flow-state.test.ts`

**The bug:** `nextBookingSuccessState` spreads state and only overrides `modalOpen: true`. This means `selectedSlot` is preserved after a successful booking, so the "Book" CTA button still shows a stale time.

- [ ] **Step 1: Fix the function in `booking-flow-state.ts`**

Replace the entire file content:

```ts
export interface BookingFlowState {
  modalOpen: boolean;
  selectedSlot: string | null;
}

export function nextBookingSuccessState(_state: BookingFlowState): BookingFlowState {
  return {
    modalOpen: true,
    selectedSlot: null,
  };
}
```

- [ ] **Step 2: Run existing test to confirm it now fails (as expected)**

```bash
cd "apps/web" && pnpm test
```

Expected: the existing test fails because it asserts `selectedSlot: '09:30'` but now gets `null`. This is correct — the test was wrong.

- [ ] **Step 3: Fix the test in `booking-flow-state.test.ts`**

Replace the entire file content:

```ts
import { describe, it, expect } from "vitest";
import { nextBookingSuccessState } from "./booking-flow-state";

describe("nextBookingSuccessState", () => {
  it("keeps modal open so success state can be shown", () => {
    const result = nextBookingSuccessState({ modalOpen: true, selectedSlot: "09:30" });
    expect(result.modalOpen).toBe(true);
  });

  it("clears selectedSlot so the stale CTA does not reappear after success", () => {
    const result = nextBookingSuccessState({ modalOpen: false, selectedSlot: "14:45" });
    expect(result.selectedSlot).toBeNull();
  });

  it("works regardless of the input selectedSlot value", () => {
    expect(nextBookingSuccessState({ modalOpen: true, selectedSlot: null }).selectedSlot).toBeNull();
    expect(nextBookingSuccessState({ modalOpen: false, selectedSlot: "11:00" }).selectedSlot).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd "apps/web" && pnpm test
```

Expected: 3 tests pass.

- [ ] **Step 5: Verify `BookingClient` handles `selectedSlot: null` correctly**

Search for where `selectedSlot` drives the CTA button:

```bash
grep -n "selectedSlot" "apps/web/src/app/[slug]/BookingClient.tsx" 2>/dev/null || \
grep -rn "selectedSlot" apps/web/src/app/ --include="*.tsx" | grep -v test
```

Confirm the CTA is conditionally rendered or disabled when `selectedSlot` is null. If it isn't, fix the conditional in `BookingClient.tsx` as well (look for `selectedSlot && <Button>` or similar pattern).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/[slug]/booking-flow-state.ts" "apps/web/src/app/[slug]/booking-flow-state.test.ts"
git commit -m "fix(web): clear selectedSlot after booking success to prevent stale CTA"
```

---

## Task 6: Extract `isValidPhone` to `packages/shared`

**Files:**
- Create: `packages/shared/src/phone-utils.ts`
- Create: `packages/shared/src/__tests__/phone-utils.test.ts`
- Modify: `packages/shared/src/index.ts` (re-export)
- Modify: `supabase/functions/widget-book-appointment/index.ts`
- Modify: `supabase/functions/app-book-appointment/index.ts`

**Why:** The function is copy-pasted in two edge functions. If one is updated and the other isn't, they silently diverge. Moving it to `packages/shared` makes it the single source of truth.

**Note on the regex:** The function has two regimes:
- Turkish mobile (`+90` / `0` prefix, starts with `5`, 10 digits after prefix)
- International fallback (10–15 digits)

The `905551234567` format (90 prefix without `+`) passes via the fallback regex — this is by design.

- [ ] **Step 1: Write the failing test first**

Create `packages/shared/src/__tests__/phone-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isValidPhone } from "../phone-utils.ts";

describe("isValidPhone", () => {
  // Valid Turkish mobile formats
  it("accepts +90 5XX format", () => {
    expect(isValidPhone("+905551234567")).toBe(true);
  });

  it("accepts 0 5XX format (10 digits with leading 0)", () => {
    expect(isValidPhone("05551234567")).toBe(true);
  });

  it("accepts bare 5XX format (10 digits, no prefix)", () => {
    expect(isValidPhone("5551234567")).toBe(true);
  });

  it("accepts phone with spaces (stripped before validation)", () => {
    expect(isValidPhone("+90 555 123 45 67")).toBe(true);
  });

  it("accepts phone with dashes", () => {
    expect(isValidPhone("+90-555-123-4567")).toBe(true);
  });

  it("accepts 90XXXXXXXXXX format (no +, passes fallback regex)", () => {
    // Falls through to /^[0-9]{10,15}$/ — 12 digits, all numeric
    expect(isValidPhone("905551234567")).toBe(true);
  });

  // Invalid formats
  it("rejects too-short number", () => {
    expect(isValidPhone("12345")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidPhone("")).toBe(false);
  });

  it("rejects number with letters", () => {
    expect(isValidPhone("+90abc1234567")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isValidPhone("   ")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd "packages/shared" && pnpm test
```

Expected: `phone-utils.ts` not found / `isValidPhone` not found.

- [ ] **Step 3: Create `packages/shared/src/phone-utils.ts`**

```ts
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-\(\)]/g, "");
  return /^(\+90|0)?[5][0-9]{9}$/.test(digits) || /^[0-9]{10,15}$/.test(digits);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "packages/shared" && pnpm test
```

Expected: all 10 phone-utils tests pass.

- [ ] **Step 5: Re-export from `packages/shared/src/index.ts`**

Read the current `index.ts` to see what's already exported, then add:

```ts
export { isValidPhone } from "./phone-utils.ts";
```

- [ ] **Step 6: Add `phone-utils` to package.json exports**

In `packages/shared/package.json`, add to the `exports` object:

```json
"./phone-utils": "./src/phone-utils.ts"
```

- [ ] **Step 7: Update `widget-book-appointment/index.ts`**

At the top of the file, add the import (Deno edge functions use HTTP imports for npm packages, but `packages/shared` is a local import — check the existing import pattern in the file):

```ts
// Replace the local isValidPhone function with:
import { isValidPhone } from "../../packages/shared/src/phone-utils.ts";
```

Then delete the local `isValidPhone` function definition (lines ~65–68 of the original).

**Important:** Verify the import path is correct by checking how other shared imports are done in other edge functions:

```bash
grep -rn "from.*shared" supabase/functions/ --include="*.ts" | head -5
```

If no shared imports exist in edge functions, the shared package is only for web/app clients. In that case, **skip the import step** — keep the function local to both edge functions but ensure they are identical to what's in `phone-utils.ts`. Add a comment: `// canonical copy in packages/shared/src/phone-utils.ts`.

- [ ] **Step 8: Typecheck**

```bash
cd "packages/shared" && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/phone-utils.ts \
        packages/shared/src/__tests__/phone-utils.test.ts \
        packages/shared/src/index.ts \
        packages/shared/package.json
git commit -m "feat(shared): extract isValidPhone to canonical shared module with tests"
```

---

## Task 7: Guard `create_appointment_atomic` against inactive shops

**Files:**
- Create: `supabase/migrations/20260528300000_shop_status_booking_guard.sql`

**The gap:** After migration `20260526100000_shop_status.sql` added `shops.status DEFAULT='active'`, the `create_appointment_atomic` RPC fetches the shop (lines 69–76 of the migration file) but never checks `v_shop.status`. A shop with `status = 'pending'` or `status = 'inactive'` can still accept bookings through the RPC.

- [ ] **Step 1: Read the current RPC to find the injection point**

```bash
grep -n "IF NOT FOUND\|RAISE EXCEPTION\|v_shop" \
  "supabase/migrations/20260519120000_advisory_lock_bigint_key.sql" | head -20
```

The shop fetch block ends with `IF NOT FOUND THEN RAISE EXCEPTION 'Dukkan bulunamadi'`. The status check should be inserted immediately after that `END IF`.

- [ ] **Step 2: Create the migration**

Create `supabase/migrations/20260528300000_shop_status_booking_guard.sql`:

```sql
-- Guard: reject bookings for non-active shops.
-- create_appointment_atomic fetches the shop but never checked status after
-- 20260526100000_shop_status.sql introduced the status column.

CREATE OR REPLACE FUNCTION public.create_appointment_atomic(
  p_shop_slug text DEFAULT NULL,
  p_shop_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL,
  p_customer_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_staff_id uuid;
  v_ends_at timestamptz;
  v_appointment_id uuid;
  v_staff_name text;
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
  v_is_privileged boolean;
BEGIN
  IF p_service_id IS NULL OR p_starts_at IS NULL OR trim(COALESCE(p_customer_name, '')) = '' THEN
    RAISE EXCEPTION 'Eksik randevu bilgisi' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Isim en az 2 karakter olmali' USING ERRCODE = '22023';
  END IF;

  IF p_starts_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Geçmiş bir saate randevu oluşturulamaz' USING ERRCODE = '22023';
  END IF;

  IF p_customer_phone IS NOT NULL AND trim(p_customer_phone) <> '' THEN
    IF (
      SELECT COUNT(*)
      FROM public.appointments
      WHERE customer_phone = trim(p_customer_phone)
        AND created_at > now() - interval '10 minutes'
    ) >= 5 THEN
      RAISE EXCEPTION 'Çok fazla randevu isteği. Lütfen birkaç dakika bekleyin.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  SELECT * INTO v_shop
  FROM public.shops
  WHERE (p_shop_id IS NOT NULL AND id = p_shop_id)
     OR (p_shop_id IS NULL AND slug = p_shop_slug)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dukkan bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  -- NEW: reject bookings for shops that are not active
  IF v_shop.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Bu dükkan şu anda randevu kabul etmiyor' USING ERRCODE = 'P0002';
  END IF;
```

**Stop here** — the rest of the RPC body is unchanged from the previous migration. Rather than copy 200+ lines, open `supabase/migrations/20260519120000_advisory_lock_bigint_key.sql`, find the `CREATE OR REPLACE FUNCTION public.create_appointment_atomic` block, and copy everything from `SELECT * INTO v_service` to the final `END;` into this new migration, pasting it after the `END IF;` for the status check above.

> **Why copy the whole function?** Postgres `CREATE OR REPLACE FUNCTION` replaces the entire function body. Partial patches are not possible. The safest way is to include the complete replacement function in this migration.

- [ ] **Step 3: Verify the migration runs cleanly**

```bash
npx supabase db reset
```

Expected: migration applies without error. Then run the scheduling proof:

```bash
pnpm backend:proof:fast
```

Expected: all proofs pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528300000_shop_status_booking_guard.sql
git commit -m "fix(db): reject bookings for non-active shops in create_appointment_atomic"
```

---

## Self-Review

### Spec coverage

| Finding | Task |
|---|---|
| `computeAvailableSlots` untested | Task 3 |
| `localTimeToUTC` untested | Tasks 2 + 3 |
| `booking-flow-state` stale CTA bug | Task 5 |
| `isValidPhone` duplicated, untested | Task 6 |
| `create_appointment_atomic` no shop.status check | Task 7 |
| No test runner at all | Tasks 1 + 4 |

Intentionally deferred (require a live DB, higher setup cost):
- `create_appointment_atomic` concurrency / advisory lock test (#3)
- `create_block_atomic` authorization bypass (#4)
- `get_occupied_ranges` boundary overlaps (#10)
- `sync_appointment_slots` trigger edge cases (#8)
- `daily-summary-push` empty-day / double-fire (#9)

These are real risks but require pgTAP or a test Supabase instance and belong in a separate integration test plan.

### Placeholder scan

No TBDs. Task 7 has one manual step (copy the function body) with explicit instructions for where to copy from and why.

### Type consistency

- `WorkingHours`, `OccupiedRange`, `Slot` — all imported from `../types.ts` in tests, consistent with the source file's own imports.
- `isValidPhone` — same signature in `phone-utils.ts` and usage in both edge functions.
- `nextBookingSuccessState` — `BookingFlowState` interface unchanged, only the return value body changes.
