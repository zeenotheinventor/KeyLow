import { describe, expect, it } from "vitest";

import { jsonObjectOf } from "../src/jsonObject.ts";

describe("jsonObjectOf", () => {
  it("should keep strings, numbers, booleans, nulls, arrays and nested objects as they are", () => {
    const column = {
      v: 1,
      kind: "recipe",
      per: { kcal: 350, fibre_g: null },
      steps: ["a", "b"],
      ok: true,
    };

    expect(jsonObjectOf(column)).toEqual(column);
  });

  it("should drop a key whose value is undefined, as a stored column does, at any depth", () => {
    expect(
      jsonObjectOf({ kcal: 100, sat_fat_g: undefined, total: { salt_g: undefined, fat_g: 3 } }),
    ).toEqual({
      kcal: 100,
      total: { fat_g: 3 },
    });
  });

  it("should refuse a value JSON cannot hold, without naming it", () => {
    expect(() => jsonObjectOf({ secret: () => "x" })).toThrow(
      new RangeError("A plan column holds a value that is not JSON"),
    );
  });

  it("should refuse an array where a column object is expected", () => {
    expect(() => jsonObjectOf([1, 2])).toThrow(new RangeError("A plan column must be an object"));
  });
});
