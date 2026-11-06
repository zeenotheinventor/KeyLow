import { describe, expect, it } from "vitest";

import { FAVOURITES_STRIP, describeFavouriteTileName } from "../../src/copy";

describe("the Favourites strip's copy", () => {
  it("should head the strip Favourites", () => {
    expect(FAVOURITES_STRIP.heading).toBe("Favourites");
  });

  it("should name a food's tile for a screen reader by what pressing it does", () => {
    expect(describeFavouriteTileName("Porridge", "food")).toBe("Choose an amount of Porridge");
  });

  it("should say a recipe's tile is a recipe", () => {
    expect(describeFavouriteTileName("Chicken and rice", "recipe")).toBe(
      "Choose an amount of Chicken and rice, recipe",
    );
  });
});
