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