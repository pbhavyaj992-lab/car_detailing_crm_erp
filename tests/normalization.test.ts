import { describe, expect, it } from "vitest";
import { normalizePhone, normalizeVehicleNumber, isValidPhone } from "@/lib/format";

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["+919876543210", "9876543210"],
    ["+91 9876543210", "9876543210"],
    ["91-9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["(987) 654-3210", "9876543210"],
    ["919876543210", "9876543210"],
  ])("normalizes %s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("returns empty for garbage input", () => {
    expect(normalizePhone("abc")).toBe("");
    expect(normalizePhone("12345")).toBe("");
    expect(normalizePhone(null)).toBe("");
  });

  it("isValidPhone matches 10-digit outputs", () => {
    expect(isValidPhone("+91 98765 43210")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });
});

describe("normalizeVehicleNumber", () => {
  it.each([
    ["GJ01AB1234", "GJ01AB1234"],
    ["GJ-01-AB-1234", "GJ01AB1234"],
    ["GJ 01 AB 1234", "GJ01AB1234"],
    ["gj01ab1234", "GJ01AB1234"],
    ["gj.01.ab.1234", "GJ01AB1234"],
    [" GJ / 01 / AB / 1234 ", "GJ01AB1234"],
  ])("normalizes %s → %s", (input, expected) => {
    expect(normalizeVehicleNumber(input)).toBe(expected);
  });
});
