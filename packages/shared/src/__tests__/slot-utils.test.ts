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
    expect(slots[0]?.available).toBe(true);
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
    expect(slots[0]?.startsAt.getTime()).toBe(openIstanbul09.getTime());
    expect(slots[0]?.available).toBe(true);
    expect(slots[1]?.available).toBe(false);
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