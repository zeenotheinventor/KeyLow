import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { classifyIngredient } from "../../src/shopping";

const groups = fc.option(
  fc.oneof(fc.string(), fc.constantFrom("H", "WY", "OC", "WC", "WCN", "DG")),
);

describe("classifyIngredient, for any name and group", () => {
  it("should never throw and always answer staple or item", () => {
    fc.assert(
      fc.property(fc.string(), groups, (name, food_group) => {
        const { kind } = classifyIngredient({ name, food_group });

        expect(["staple", "item"]).toContain(kind);
      }),
    );
  });

  it("should keep any name with the word fresh as an item, whatever its group", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), groups, (before, after, food_group) => {
        const name = `${before}, fresh ,${after}`;

        expect(classifyIngredient({ name, food_group })).toEqual({ kind: "item", rule: "fresh" });
      }),
    );
  });
});
