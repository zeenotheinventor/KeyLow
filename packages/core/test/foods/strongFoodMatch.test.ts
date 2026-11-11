import { describe, expect, it } from "vitest";

import { hasStrongFoodMatch } from "../../src/foods/strongFoodMatch";

describe("hasStrongFoodMatch", () => {
  it("is strong when one name holds every query word", () => {
    expect(hasStrongFoodMatch("basmati rice", ["Rice, white, basmati, boiled"])).toBe(true);
  });

  it("is weak when no name holds every query word", () => {
    expect(hasStrongFoodMatch("beef massaman", ["Curry, beef, homemade"])).toBe(false);
  });

  it("is weak when the words are held by different names", () => {
    expect(hasStrongFoodMatch("beef massaman", ["Beef, raw", "Massaman paste"])).toBe(false);
  });

  it("is strong when any one of several names holds every word", () => {
    expect(hasStrongFoodMatch("spinach soup", ["Spinach, boiled", "Soup, spinach, cream of"])).toBe(
      true,
    );
  });

  it("ignores query words under 3 letters", () => {
    expect(hasStrongFoodMatch("mac n cheese", ["Macaroni cheese, homemade"])).toBe(false);
    expect(hasStrongFoodMatch("rice in oil", ["Rice, basmati, with oil"])).toBe(true);
  });

  it("is strong for any result when every query word is under 3 letters", () => {
    expect(hasStrongFoodMatch("pi", ["Pie, apple"])).toBe(true);
  });

  it("matches by stem, in both directions", () => {
    expect(hasStrongFoodMatch("tomatoes", ["Tomato, raw"])).toBe(true);
    expect(hasStrongFoodMatch("tomato", ["Tomatoes, canned"])).toBe(true);
    expect(hasStrongFoodMatch("berry", ["Berries, mixed"])).toBe(true);
    expect(hasStrongFoodMatch("noodle soup", ["Soup, noodles"])).toBe(true);
    expect(hasStrongFoodMatch("casseroled chicken", ["Chicken, casserole"])).toBe(true);
  });

  it("does not match a word that only starts the same way", () => {
    expect(hasStrongFoodMatch("rice", ["Ricotta, raw", "Rich tea biscuits"])).toBe(false);
  });

  it("is case blind and reads punctuation as a break between words", () => {
    expect(hasStrongFoodMatch("CHICKEN-tikka", ["Chicken (tikka), retail"])).toBe(true);
  });

  it("is weak when there are no names", () => {
    expect(hasStrongFoodMatch("beef massaman", [])).toBe(false);
    expect(hasStrongFoodMatch("pi", [])).toBe(false);
  });
});
