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