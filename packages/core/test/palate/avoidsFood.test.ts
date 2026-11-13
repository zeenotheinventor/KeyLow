import { describe, expect, it } from "vitest";

import { avoidsFood } from "../../src/palate";

import type { PalatePreference } from "../../src/palate";

const preference = (
  kind: PalatePreference["kind"],
  label: string | null,
  ids: { foodId?: string; recipeId?: string } = {},
): PalatePreference => ({
  id: `preference-${kind}-${label ?? "none"}`,
  kind,
  label,
  foodId: ids.foodId ?? null,
  recipeId: ids.recipeId ?? null,
});

describe("avoidsFood", () => {
  it("should avoid nothing when there are no preferences", () => {
    expect(avoidsFood({ id: "f1", name: "Peanuts, roasted" }, [])).toEqual({
      avoid: false,
      reason: null,
    });
  });

  it("should avoid a food whose name holds the word of an allergy", () => {
    expect(
      avoidsFood({ id: "f1", name: "Peanuts, roasted" }, [preference("allergy", "peanuts")]),
    ).toEqual({
      avoid: true,
      reason: "allergy",
    });
  });

  it("should avoid a food whose name holds the word of a dislike", () => {
    expect(
      avoidsFood({ id: "f1", name: "Soup, mushroom, carton" }, [
        preference("dislike", "mushrooms"),
      ]),
    ).toEqual({ avoid: true, reason: "dislike" });
  });

  it("should match a singular label to a plural name and the other way round", () => {
    expect(
      avoidsFood({ id: "f1", name: "Peanut butter" }, [preference("allergy", "peanuts")]).avoid,
    ).toBe(true);
    expect(
      avoidsFood({ id: "f1", name: "Mushrooms, fried" }, [preference("dislike", "mushroom")]).avoid,
    ).toBe(true);
  });

  it("should match whole words only for a dislike, so a word inside another word is not a match", () => {
    expect(avoidsFood({ id: "f1", name: "Hamburger" }, [preference("dislike", "ham")]).avoid).toBe(
      false,
    );
    expect(avoidsFood({ id: "f1", name: "Peanuts" }, [preference("dislike", "nut")]).avoid).toBe(
      false,
    );
  });

  it("should match in any case and ignore punctuation", () => {
    expect(
      avoidsFood({ id: "f1", name: "CORIANDER, fresh" }, [preference("dislike", " Coriander ")])
        .avoid,
    ).toBe(true);
  });

  it("should need every word of a label with several words", () => {
    const label = preference("dislike", "goat cheese");
    expect(avoidsFood({ id: "f1", name: "Cheese, goat" }, [label]).avoid).toBe(true);
    expect(avoidsFood({ id: "f1", name: "Cheese, cheddar" }, [label]).avoid).toBe(false);
  });

  it("should avoid a food by its id, whatever its name", () => {
    expect(
      avoidsFood({ id: "f1", name: "Something else" }, [
        preference("dislike", "olives", { foodId: "f1" }),
      ]),
    ).toEqual({ avoid: true, reason: "dislike" });
  });

  it("should say allergy when an allergy and a dislike both match", () => {
    expect(
      avoidsFood({ id: "f1", name: "Peanuts" }, [
        preference("dislike", "peanuts"),
        preference("allergy", "peanut"),
      ]).reason,
    ).toBe("allergy");
  });

  it("should not match anything on a correction", () => {
    expect(
      avoidsFood({ id: "f1", name: "Peanuts" }, [preference("not_usual", null, { foodId: "f1" })])
        .avoid,
    ).toBe(false);
  });

  it("should not match a blank label, and should still match a food without an id", () => {
    expect(avoidsFood({ name: "Peanuts" }, [preference("dislike", "  ")]).avoid).toBe(false);
    expect(avoidsFood({ name: "Peanuts" }, [preference("dislike", "peanuts")]).avoid).toBe(true);
  });

  it("should match by name only, so a brand or an ingredient is not read", () => {
    expect(
      avoidsFood({ id: "f1", name: "Chocolate spread" }, [preference("allergy", "hazelnuts")])
        .avoid,
    ).toBe(false);
  });

  describe("for an allergy, where hiding too much is the safe direction", () => {
    const allergy = (label: string) => [preference("allergy", label)];

    it("should read soy and soya as one word, both ways", () => {
      expect(avoidsFood({ name: "Soya milk" }, allergy("soy")).avoid).toBe(true);
      expect(avoidsFood({ name: "Soy sauce" }, allergy("soya")).avoid).toBe(true);
    });

    it("should fold accents on the label and on the name", () => {
      expect(avoidsFood({ name: "Jalapeno, pickled" }, allergy("jalapeño")).avoid).toBe(true);
      expect(avoidsFood({ name: "Jalapeño, pickled" }, allergy("Jalapeno")).avoid).toBe(true);
      expect(avoidsFood({ name: "Cafe latte" }, allergy("café")).avoid).toBe(true);
      expect(avoidsFood({ name: "Café latte" }, allergy("Cafe")).avoid).toBe(true);
    });

    it("should find a label stem inside a word of the name", () => {
      expect(avoidsFood({ name: "Walnut, shelled" }, allergy("nuts")).avoid).toBe(true);
      expect(avoidsFood({ name: "Hazelnut spread" }, allergy("nuts")).avoid).toBe(true);
      expect(avoidsFood({ name: "Peanuts, roasted" }, allergy("nuts")).avoid).toBe(true);
      expect(avoidsFood({ name: "Peanutbutter" }, allergy("peanuts")).avoid).toBe(true);
    });

    it("should not match a stem under 3 letters inside a word", () => {
      expect(avoidsFood({ name: "Hazelnut spread" }, allergy("ut")).avoid).toBe(false);
    });
  });

  describe("for a dislike", () => {
    it("should still fold accents and read soy as soya, as whole words", () => {
      expect(avoidsFood({ name: "Jalapeno" }, [preference("dislike", "jalapeño")]).avoid).toBe(
        true,
      );
      expect(avoidsFood({ name: "Soya milk" }, [preference("dislike", "soy")]).avoid).toBe(true);
    });

    it("should not find a stem inside a word", () => {
      expect(avoidsFood({ name: "Walnut" }, [preference("dislike", "nuts")]).avoid).toBe(false);
      expect(avoidsFood({ name: "Peanutbutter" }, [preference("dislike", "peanuts")]).avoid).toBe(
        false,
      );
    });
  });
});
