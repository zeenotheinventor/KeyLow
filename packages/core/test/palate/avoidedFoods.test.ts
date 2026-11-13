import { describe, expect, it } from "vitest";

import { findAvoidedFood, listAvoidedFoods } from "../../src/palate";

import type { PalatePreference } from "../../src/palate";

const preference = (
  id: string,
  kind: PalatePreference["kind"],
  label: string | null,
): PalatePreference => ({ id, kind, foodId: null, recipeId: null, label });

const PREFERENCES = [
  preference("a", "dislike", "mushrooms"),
  preference("b", "allergy", "peanuts"),
  preference("c", "not_usual", "drinks"),
  preference("d", "not_usual", null),
  preference("e", "dislike", "coriander"),
];

describe("listAvoidedFoods", () => {
  it("should list allergies first, then dislikes, each in the order given", () => {
    expect(listAvoidedFoods(PREFERENCES)).toEqual([
      { preferenceId: "b", label: "peanuts", kind: "allergy" },
      { preferenceId: "a", label: "mushrooms", kind: "dislike" },
      { preferenceId: "e", label: "coriander", kind: "dislike" },
    ]);
  });

  it("should leave out the corrections", () => {
    expect(listAvoidedFoods([preference("c", "not_usual", "drinks")])).toEqual([]);
  });

  it("should leave out a blank label and trim the others", () => {
    expect(
      listAvoidedFoods([preference("a", "dislike", "   "), preference("b", "dislike", " olives ")]),
    ).toEqual([{ preferenceId: "b", label: "olives", kind: "dislike" }]);
  });

  it("should list a word once when it is on the list under both kinds, as the allergy", () => {
    expect(
      listAvoidedFoods([
        preference("a", "dislike", "Peanuts"),
        preference("b", "allergy", "peanuts"),
      ]),
    ).toEqual([{ preferenceId: "b", label: "peanuts", kind: "allergy" }]);
  });
});

describe("findAvoidedFood", () => {
  it("should find a word under the same kind, whatever its case", () => {
    expect(findAvoidedFood(PREFERENCES, "PEANUTS")).toEqual({
      preferenceId: "b",
      label: "peanuts",
      kind: "allergy",
    });
  });

  it("should say which kind a word is on the list as, so the caller can tell the other kind", () => {
    expect(findAvoidedFood(PREFERENCES, "mushrooms")?.kind).toBe("dislike");
    expect(findAvoidedFood(PREFERENCES, "peanuts")?.kind).toBe("allergy");
  });

  it("should ignore spaces around the word", () => {
    expect(findAvoidedFood(PREFERENCES, "  coriander ")?.preferenceId).toBe("e");
  });

  it("should find nothing for a word that is only a correction", () => {
    expect(findAvoidedFood(PREFERENCES, "drinks")).toBeUndefined();
  });

  it("should find nothing for a new word", () => {
    expect(findAvoidedFood(PREFERENCES, "olives")).toBeUndefined();
  });
});
