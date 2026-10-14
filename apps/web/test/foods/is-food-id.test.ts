import { describe, expect, it } from "vitest";

import { isFoodId } from "@/components/foods/isFoodId";

describe("isFoodId", () => {
  it("should accept a v4 uuid", () => {
    expect(isFoodId("55555555-5555-4555-8555-555555555555")).toBe(true);
  });

  it("should accept a seed id that is not an RFC 4122 uuid", () => {
    expect(isFoodId("00000000-0000-0000-0000-000000000001")).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["a word", "not-a-uuid"],
    ["a uuid with a character cut off", "55555555-5555-4555-8555-55555555555"],
    ["a uuid with a character added", "55555555-5555-4555-8555-5555555555555"],
    ["a uuid with a filter appended", "55555555-5555-4555-8555-555555555555,name.eq.x"],
    ["a uuid with a space", "55555555-5555-4555-8555-555555555555 "],
  ])("should reject %s", (_description, value) => {
    expect(isFoodId(value)).toBe(false);
  });
});
