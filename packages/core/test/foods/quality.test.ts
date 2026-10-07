import { describe, expect, it } from "vitest";

import { requiresConfirmation } from "../../src/foods/quality";

describe("requiresConfirmation", () => {
  it("should be true when the food is suspect", () => {
    expect(requiresConfirmation({ quality: { suspect: true } })).toBe(true);
  });

  it("should be false when the food is explicitly not suspect", () => {
    expect(requiresConfirmation({ quality: { suspect: false } })).toBe(false);
  });

  it("should be false when suspect is absent, because an absent boolean reads as false", () => {
    expect(requiresConfirmation({ quality: {} })).toBe(false);
  });

  it("should be false when only other quality flags are set", () => {
    expect(
      requiresConfirmation({ quality: { kcal_derived: true, fields_missing: ["fibre_g"] } }),
    ).toBe(false);
  });
});
